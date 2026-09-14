import { User, UserFollow } from "../database/index.js";
import { createNotification } from "../utils/createNotification.js";
import { Notification } from "../database/index.js";
import { parseRollNumber } from "../utils/rollNumberParser.js";
import { validateUsername } from "../utils/validateUsername.js";
import { normalizeDepartmentName } from "../utils/departmentLabel.js";
import {
  resolveDepartmentBucketFromUserDepartment,
  getProgramsForSchool,
} from "../utils/giftSchools.js";
import { isAdminEmail } from "../utils/adminConfig.js";

const MAX_PROFILE_PHOTO_BYTES = 20 * 1024 * 1024; // decoded payload (~15MB original JPEG typical after client compress)
const MAX_COVER_PHOTO_BYTES = 20 * 1024 * 1024;
/** MongoDB BSON document max is 16MB; both photos are stored as long data URLs — cap combined string length */
const MAX_COMBINED_PHOTO_DATA_URL_CHARS = 15 * 1024 * 1024;

function getBase64ByteSize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const base64 = dataUrl.slice(comma + 1);
  return Math.ceil((base64.length * 3) / 4);
}

function combinedStoredPhotoChars(user) {
  const prof = user.profilePhoto;
  const cov = user.coverPhoto;
  return (prof?.length || 0) + (cov?.length || 0);
}

const safeTrim = (v) => (v == null ? '' : String(v).trim());

/**
 * Update own profile
 * PUT /api/profile/update
 */
export const updateProfile = async (req, res) => {
  try {
    const { uid } = req.user;
    const { name, username, bio, location, department, program, profilePhoto, coverPhoto } = req.body;

    let user = await User.findOne({ firebaseId: uid });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (name !== undefined) user.name = safeTrim(name) || '';
    if (username !== undefined) {
      const trimmedUsername = safeTrim(username).replace(/^@+/, '');
      if (trimmedUsername) {
        const uCheck = validateUsername(trimmedUsername);
        if (!uCheck.valid) return res.status(400).json({ success: false, error: uCheck.error });
        const finalUsername = uCheck.value;
        const existing = await User.findOne({
          username: finalUsername,
          firebaseId: { $ne: uid },
        });
        if (existing) {
          return res.status(400).json({ success: false, error: "Username already taken" });
        }
        user.username = finalUsername;
      } else {
        user.username = null;
      }
    }
    if (bio !== undefined) user.bio = safeTrim(bio) || null;
    if (location !== undefined) user.location = safeTrim(location) || null;
    if (department !== undefined) {
      const d = safeTrim(department);
      user.department = d ? normalizeDepartmentName(d) : null;
    }
    if (program !== undefined) user.program = safeTrim(program) || null;
    // currentStatus is read-only: set during signup (student/alumni), not editable in edit profile
    
    // Validate photo sizes (maintain high quality, but ensure reasonable limits)
    if (profilePhoto !== undefined) {
      if (profilePhoto && profilePhoto.trim()) {
        const photoBytes = getBase64ByteSize(profilePhoto.trim());
        if (photoBytes > MAX_PROFILE_PHOTO_BYTES) {
          return res.status(400).json({
            success: false,
            error: `Profile photo is too large. Maximum size: ${Math.round(MAX_PROFILE_PHOTO_BYTES / (1024 * 1024))}MB.`,
          });
        }
        user.profilePhoto = profilePhoto.trim();
      } else {
        user.profilePhoto = null;
      }
    }
    
    if (coverPhoto !== undefined) {
      if (coverPhoto && coverPhoto.trim()) {
        const photoBytes = getBase64ByteSize(coverPhoto.trim());
        if (photoBytes > MAX_COVER_PHOTO_BYTES) {
          return res.status(400).json({
            success: false,
            error: `Cover photo is too large. Maximum size: ${Math.round(MAX_COVER_PHOTO_BYTES / (1024 * 1024))}MB.`,
          });
        }
        user.coverPhoto = coverPhoto.trim();
      } else {
        user.coverPhoto = null;
      }
    }

    const combinedChars = combinedStoredPhotoChars(user);
    if (combinedChars > MAX_COMBINED_PHOTO_DATA_URL_CHARS) {
      return res.status(400).json({
        success: false,
        error:
          'Profile and cover images together are too large for storage. Save one image first, or use smaller files.',
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        firebaseId: user.firebaseId,
        name: user.name,
        username: user.username,
        rollNumber: user.rollNumber,
        startYear: user.startYear,
        endYear: user.endYear,
        department: user.department,
        startSemester: user.startSemester,
        bio: user.bio || null,
        location: user.location || null,
        program: user.program || null,
        currentStatus: user.currentStatus || null,
        profilePhoto: user.profilePhoto || null,
        coverPhoto: user.coverPhoto || null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    if (error.name === "MongoServerError" && error.code === 11000 && (error.keyPattern?.username || error.keyPattern?.firebaseId)) {
      return res.status(400).json({ success: false, error: "Username already taken" });
    }
    if (
      error?.message?.includes('maximum allowed BSON size') ||
      error?.message?.includes('document is larger than maximum') ||
      error?.message?.includes('BSONObjTooLarge') ||
      error?.code === 17419
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Images are too large to store together. Save your profile photo first, then edit again to add the cover (or use smaller images).',
      });
    }
    res.status(500).json({ success: false, error: "Failed to update profile", details: error.message });
  }
};

/**
 * GET /api/profile/me
 */
export const getMyProfile = async (req, res) => {
  try {
    console.log("🔍 getMyProfile called");
    
    if (!req.user || !req.user.uid) {
      console.error("❌ No user or uid in req.user:", req.user);
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const isAdminSession =
      !!req.user.isAdmin ||
      !!req.user.adminEmail ||
      isAdminEmail(req.user.email) ||
      String(req.user.uid || '').includes('@');
    if (isAdminSession) {
      console.warn("⚠️ Admin session attempted to access student profile endpoint:", req.user.email || req.user.uid);
      return res.status(403).json({ success: false, error: "Admin users do not have a student profile." });
    }
    
    const { uid } = req.user;
    const { email, name } = req.user;
    console.log("🔍 Looking for user with firebaseId:", uid);
    
    let user = await User.findOne({ firebaseId: uid });
    
    console.log("🔍 Found user:", user ? `id=${user.id}` : "not found");
    
    if (!user) {
      return res.status(200).json({ success: false, error: "Complete signup by choosing a username", needsUsername: true });
    }

    if (user.accountStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Contact campus administration.',
        suspended: true,
      });
    }

    let followingRows = [];
    let followersCount = 0;
    let followingCount = 0;
    let following = [];

    try {
      if (user && user._id) {
        followingRows = await UserFollow.find({ followerId: user._id }).select('followingId').lean();
        const followingIds = followingRows.map((r) => r.followingId).filter(Boolean);
        followingCount = followingIds.length;

        followersCount = await UserFollow.countDocuments({ followingId: user._id });

        if (followingIds.length > 0) {
          const users = await User.find({ _id: { $in: followingIds } }).select('username').limit(500).lean();
          following = users.map((u) => ({ username: u.username || null })).filter((u) => u.username);
        }
      }
    } catch (followError) {
      console.error("❌ Error fetching follow data:", followError);
      // Continue with default values if follow query fails
    }

    if (!user.email && req.user.email) {
      const normalized = String(req.user.email).trim().toLowerCase();
      await User.updateOne({ firebaseId: uid }, { email: normalized }).catch(() => {});
    }

    res.json({
      success: true,
      user: {
        firebaseId: user.firebaseId,
        name: user.name,
        username: user.username,
        rollNumber: user.rollNumber,
        startYear: user.startYear,
        endYear: user.endYear,
        department: user.department,
        startSemester: user.startSemester,
        bio: user.bio || null,
        location: user.location || null,
        program: user.program || null,
        currentStatus: user.currentStatus || null,
        profilePhoto: user.profilePhoto || null,
        coverPhoto: user.coverPhoto || null,
        followersCount,
        followingCount,
        following,
        createdAt: user.createdAt || user.created_at || null,
      },
    });
  } catch (error) {
    console.error("❌ Get my profile error:", error);
    console.error("❌ Error stack:", error.stack);
    console.error("❌ Error details:", { message: error.message, name: error.name });
    res.status(500).json({ 
      success: false, 
      error: "Failed to fetch profile", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

/**
 * GET /api/profile/:username
 */
export const getUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    const { uid } = req.user;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const loggedInUser = await User.findOne({ firebaseId: uid });
    const isFollowing = loggedInUser
      ? await UserFollow.findOne({ followerId: loggedInUser._id, followingId: user._id }).then((r) => !!r)
      : false;

    const followersCount = await UserFollow.countDocuments({ followingId: user._id });
    const followingCount = await UserFollow.countDocuments({ followerId: user._id });

    res.json({
      success: true,
      user: {
        id: user._id,
        firebaseId: user.firebaseId,
        name: user.name,
        username: user.username,
        rollNumber: user.rollNumber,
        startYear: user.startYear,
        endYear: user.endYear,
        department: user.department,
        startSemester: user.startSemester,
        bio: user.bio || null,
        location: user.location || null,
        program: user.program || null,
        currentStatus: user.currentStatus || null,
        profilePhoto: user.profilePhoto || null,
        coverPhoto: user.coverPhoto || null,
        followersCount,
        followingCount,
        isFollowing: isFollowing || false,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch profile", details: error.message });
  }
};

/**
 * GET /api/profile/public/:username
 * Public profile preview for logged-out users (no posts).
 */
export const getPublicUserProfile = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const user = await User.findOne({ username })
      .select('_id name username bio department profilePhoto coverPhoto created_at')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const followersCount = await UserFollow.countDocuments({ followingId: user._id });
    const followingCount = await UserFollow.countDocuments({ followerId: user._id });

    return res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        bio: user.bio || null,
        department: user.department || null,
        profilePhoto: user.profilePhoto || null,
        coverPhoto: user.coverPhoto || null,
        followersCount,
        followingCount,
        createdAt: user.createdAt || user.created_at || null,
      },
    });
  } catch (error) {
    console.error("Get public user profile error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch public profile", details: error.message });
  }
};

/**
 * GET /api/profile/search?q=...
 */
export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json({ success: true, users: [] });
    }
    const searchTerm = q.trim().split(/\s+/)[0];
    const re = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      username: { $ne: null },
      $or: [
        { username: re },
        { name: re },
      ],
    })
      .select('_id name username profilePhoto firebaseId')
      .limit(10)
      .lean();
    res.json({
      success: true,
      users: users.map((u) => ({
        _id: u._id,
        firebaseId: u.firebaseId,
        name: u.name,
        username: u.username,
        profilePhoto: u.profilePhoto || null,
      })),
    });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ success: false, error: "Failed to search users", details: error.message });
  }
};

/**
 * POST /api/profile/:username/follow
 */
export const followUser = async (req, res) => {
  try {
    const { username } = req.params;
    const { uid } = req.user;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const userToFollow = await User.findOne({ username });
    if (!userToFollow) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const loggedInUser = await User.findOne({ firebaseId: uid });
    if (!loggedInUser) {
      return res.status(404).json({ success: false, error: "Your account not found" });
    }

    if (userToFollow._id.toString() === loggedInUser._id.toString()) {
      return res.status(400).json({ success: false, error: "Cannot follow yourself" });
    }

    const existing = await UserFollow.findOne({
      followerId: loggedInUser._id,
      followingId: userToFollow._id,
    });
    if (existing) {
      return res.status(400).json({ success: false, error: "Already following this user" });
    }

    await UserFollow.create({ followerId: loggedInUser._id, followingId: userToFollow._id });

    await createNotification(
      { Notification },
      userToFollow._id,
      loggedInUser._id,
      'follow',
      {}
    );

    const followersCount = await UserFollow.countDocuments({ followingId: userToFollow._id });
    const followingCount = await UserFollow.countDocuments({ followerId: loggedInUser._id });

    res.json({
      success: true,
      message: "Successfully followed user",
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Follow user error:", error);
    res.status(500).json({ success: false, error: "Failed to follow user", details: error.message });
  }
};

/**
 * POST /api/profile/:username/unfollow
 */
export const unfollowUser = async (req, res) => {
  try {
    const { username } = req.params;
    const { uid } = req.user;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const userToUnfollow = await User.findOne({ username });
    if (!userToUnfollow) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const loggedInUser = await User.findOne({ firebaseId: uid });
    if (!loggedInUser) {
      return res.status(404).json({ success: false, error: "Your account not found" });
    }

    const row = await UserFollow.findOne({
      followerId: loggedInUser._id,
      followingId: userToUnfollow._id,
    });
    if (!row) {
      return res.status(400).json({ success: false, error: "Not following this user" });
    }

    await UserFollow.deleteOne({ _id: row._id });

    const followersCount = await UserFollow.countDocuments({ followingId: userToUnfollow._id });
    const followingCount = await UserFollow.countDocuments({ followerId: loggedInUser._id });

    res.json({
      success: true,
      message: "Successfully unfollowed user",
      followersCount,
      followingCount,
    });
  } catch (error) {
    console.error("Unfollow user error:", error);
    res.status(500).json({ success: false, error: "Failed to unfollow user", details: error.message });
  }
};

/**
 * GET /api/profile/:username/followers
 */
export const getFollowers = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const followerRows = await UserFollow.find({ followingId: user._id }).select('followerId').lean();
    const followerIds = followerRows.map((r) => r.followerId).filter(Boolean);
    const followerUsers = followerIds.length > 0
      ? await User.find({ _id: { $in: followerIds } }).select('firebaseId name username profilePhoto').lean()
      : [];
    const followers = followerUsers.map((f) => ({
      firebaseId: f.firebaseId,
      name: f.name,
      username: f.username,
      profilePhoto: f.profilePhoto || null,
    }));

    res.json({ success: true, followers });
  } catch (error) {
    console.error("Get followers error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch followers", details: error.message });
  }
};

/**
 * GET /api/profile/:username/following
 */
export const getFollowing = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const followingRows = await UserFollow.find({ followerId: user._id }).select('followingId').lean();
    const followingIds = followingRows.map((r) => r.followingId).filter(Boolean);
    const followingUsers = followingIds.length > 0
      ? await User.find({ _id: { $in: followingIds } }).select('firebaseId name username profilePhoto').lean()
      : [];
    const following = followingUsers.map((f) => ({
      firebaseId: f.firebaseId,
      name: f.name,
      username: f.username,
      profilePhoto: f.profilePhoto || null,
    }));

    res.json({ success: true, following });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch following", details: error.message });
  }
};

/**
 * POST /api/profile/:username/remove-follower
 */
export const removeFollower = async (req, res) => {
  try {
    const { username } = req.params;
    const { uid } = req.user;
    if (!username) {
      return res.status(400).json({ success: false, error: "Username is required" });
    }

    const loggedInUser = await User.findOne({ firebaseId: uid });
    if (!loggedInUser) {
      return res.status(404).json({ success: false, error: "Your account not found" });
    }

    const followerToRemove = await User.findOne({ username });
    if (!followerToRemove) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const row = await UserFollow.findOne({
      followerId: followerToRemove._id,
      followingId: loggedInUser._id,
    });
    if (!row) {
      return res.status(400).json({ success: false, error: "This user is not following you" });
    }

    await UserFollow.deleteOne({ _id: row._id });

    const followersCount = await UserFollow.countDocuments({ followingId: loggedInUser._id });

    res.json({
      success: true,
      message: "Follower removed successfully",
      followersCount,
    });
  } catch (error) {
    console.error("Remove follower error:", error);
    res.status(500).json({ success: false, error: "Failed to remove follower", details: error.message });
  }
};

/**
 * GET /api/profile/suggestions?limit=5&skip=0
 * Personalized by program/department bucket and school; paginated for "Show more".
 */
export const getSuggestions = async (req, res) => {
  try {
    if (!req.user || !req.user.uid) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { uid } = req.user;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 5, 1), 50);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    let loggedInUser = await User.findOne({ firebaseId: uid }).select("_id department").lean();

    if (!loggedInUser) {
      try {
        const { email, name } = req.user;
        const rollData = email ? parseRollNumber(email) : null;
        const created = await User.create({
          firebaseId: uid,
          email: email || null,
          name: name || "User",
          ...(rollData || {}),
        });
        if (!created?._id) {
          return res.status(500).json({ success: false, error: "User created but ID not found" });
        }
        loggedInUser = { _id: created._id, department: created.department || rollData?.department || null };
      } catch (createError) {
        console.error("Error auto-creating user for suggestions:", createError);
        return res.status(500).json({ success: false, error: "Failed to create user", details: createError.message });
      }
    }

    const followingRows = await UserFollow.find({ followerId: loggedInUser._id }).select("followingId").lean();
    const followingIds = [
      ...followingRows.map((r) => r.followingId).filter(Boolean),
      loggedInUser._id,
    ];

    const baseMatch = {
      _id: { $nin: followingIds },
      firebaseId: { $ne: uid },
      username: { $exists: true, $type: "string", $regex: /\S/ },
    };

    const resolved = resolveDepartmentBucketFromUserDepartment(loggedInUser.department);
    const bucketPrograms = resolved?.department?.programs?.length ? resolved.department.programs : [];
    const schoolPrograms = resolved?.school ? getProgramsForSchool(resolved.school) : [];
    const userDepartment = loggedInUser.department || null;

    const scoreBranches = [];
    if (userDepartment) {
      scoreBranches.push({ case: { $eq: ["$department", userDepartment] }, then: 40 });
    }
    if (bucketPrograms.length > 0) {
      scoreBranches.push({ case: { $in: ["$department", bucketPrograms] }, then: 30 });
    }
    if (schoolPrograms.length > 0) {
      scoreBranches.push({ case: { $in: ["$department", schoolPrograms] }, then: 20 });
    }

    const pipeline = [
      {
        $match: baseMatch,
      },
      {
        $addFields: {
          suggestionScore: scoreBranches.length
            ? { $switch: { branches: scoreBranches, default: 10 } }
            : 10,
        },
      },
      { $sort: { suggestionScore: -1, createdAt: -1, _id: 1 } },
      { $skip: skip },
      { $limit: limit + 1 },
      {
        $project: {
          firebaseId: 1,
          name: 1,
          username: 1,
          profilePhoto: 1,
          department: 1,
          program: 1,
        },
      },
    ];

    let rows = await User.aggregate(pipeline);

    if (rows.length === 0) {
      rows = await User.find(baseMatch)
        .select("firebaseId name username profilePhoto department program")
        .sort({ createdAt: -1, _id: 1 })
        .skip(skip)
        .limit(limit + 1)
        .lean();
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      success: true,
      suggestions: page.map((u) => ({
        firebaseId: u.firebaseId,
        name: u.name,
        username: u.username,
        profilePhoto: u.profilePhoto || null,
        department: u.department || u.program || null,
      })),
      hasMore,
      skip,
      limit,
    });
  } catch (error) {
    console.error("Get suggestions error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch suggestions",
      details: error.message,
    });
  }
};
