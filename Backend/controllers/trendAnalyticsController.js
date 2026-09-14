import {
  Post,
  User,
  PostHashtag,
  Hashtag,
} from "../database/index.js";
import {
  getTrendAnalyticsMeta as buildSchoolsTrendMeta,
  getBucketByDepartmentId,
  getSchoolById,
  getProgramsForSchool,
  resolveDepartmentBucketFromUserDepartment,
} from "../utils/giftSchools.js";
import { topicsFromPostContent } from "../utils/topicMatch.js";
import { uniqueProgramList } from "../utils/departmentLabel.js";

/** engagement = likes + comments + shares + reposts (saves not in schema → 0) */
function engagementParts(p) {
  const likes = p.likesCount || 0;
  const comments = p.commentsCount || 0;
  const shares = p.sharesCount || 0;
  const reposts = p.repostsCount || 0;
  const saves = 0;
  return {
    likes,
    comments,
    shares,
    reposts,
    saves,
    total: likes + comments + shares + reposts + saves,
  };
}

export const getTrendAnalyticsSchoolsMeta = (_req, res) => {
  try {
    res.json({ success: true, schools: buildSchoolsTrendMeta() });
  } catch (error) {
    console.error("getTrendAnalyticsSchoolsMeta:", error);
    res.status(500).json({ error: "Failed to load schools meta" });
  }
};

/** Aggregate hashtag/topic engagement for posts by users in given degree programs. */
async function aggregateTopTopicsForPrograms(programs, limit = 15) {
  const programList = uniqueProgramList(programs);
  const users = await User.find({ department: { $in: programList } })
    .select("_id")
    .lean();
  const userIds = users.map((u) => u._id);

  if (!userIds.length) {
    return { userCount: 0, postCount: 0, topTrendingTopics: [] };
  }

  const posts = await Post.find({
    authorId: { $in: userIds },
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();

  const postIds = posts.map((p) => p._id);
  const hashtagAgg = {};
  const postEngMap = new Map(posts.map((p) => [String(p._id), engagementParts(p)]));
  const linkedTagsByPost = new Map();

  if (postIds.length) {
    const links = await PostHashtag.find({ postId: { $in: postIds } }).lean();
    const namesNeeded = [...new Set(links.map((l) => l.hashtagId).filter(Boolean))];
    const hashtags = namesNeeded.length
      ? await Hashtag.find({ _id: { $in: namesNeeded } }).select("name").lean()
      : [];
    const idToName = new Map(hashtags.map((h) => [String(h._id), h.name]));

    for (const row of links) {
      const pname = idToName.get(String(row.hashtagId));
      if (!pname) continue;
      const pid = String(row.postId);
      if (!linkedTagsByPost.has(pid)) linkedTagsByPost.set(pid, new Set());
      linkedTagsByPost.get(pid).add(pname);
    }
  }

  for (const p of posts) {
    const eg = postEngMap.get(String(p._id));
    if (!eg) continue;
    const topicsForPost = new Set(topicsFromPostContent(p.content));
    const linked = linkedTagsByPost.get(String(p._id));
    if (linked) linked.forEach((t) => topicsForPost.add(t));
    for (const topic of topicsForPost) {
      hashtagAgg[topic] = (hashtagAgg[topic] || 0) + eg.total;
    }
  }

  const topTrendingTopics = Object.entries(hashtagAgg)
    .map(([topic, engagement]) => ({ topic, engagement, hashtag: topic }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, limit);

  return {
    userCount: users.length,
    postCount: posts.length,
    topTrendingTopics,
  };
}

/** GET /api/posts/analytics/trends/mine — trends for logged-in user's department bucket */
export const getMyDepartmentTrendAnalytics = async (req, res) => {
  try {
    const { uid } = req.user;
    const user = await User.findOne({ firebaseId: uid })
      .select("department")
      .lean();
    if (!user?.department) {
      return res.json({
        success: true,
        scope: null,
        topTrendingTopics: [],
      });
    }

    const resolved = resolveDepartmentBucketFromUserDepartment(user.department);
    if (!resolved) {
      return res.json({
        success: true,
        scope: {
          userDepartment: user.department,
          departmentId: null,
          departmentLabel: user.department,
        },
        topTrendingTopics: [],
      });
    }

    const { school, department } = resolved;
    const programs = uniqueProgramList(department.programs);
    const { userCount, postCount, topTrendingTopics } = await aggregateTopTopicsForPrograms(
      programs,
      10
    );

    res.json({
      success: true,
      scope: {
        schoolId: school.id,
        schoolName: school.fullName,
        departmentId: department.id,
        departmentLabel: department.label,
        userDepartment: user.department,
        programsIncluded: programs,
        userCount,
        postCount,
      },
      topTrendingTopics,
    });
  } catch (error) {
    console.error("getMyDepartmentTrendAnalytics:", error);
    res.status(500).json({
      error: "Failed to build your department trends",
      details: error.message,
    });
  }
};

/** GET /api/posts/analytics/trends/school?schoolId=SEAS */
export const getSchoolTrendAnalytics = async (req, res) => {
  try {
    const schoolId = String(req.query.schoolId || "").trim();
    if (!schoolId) {
      return res.status(400).json({ error: "Query schoolId is required" });
    }

    const school = getSchoolById(schoolId);
    if (!school) {
      return res.status(404).json({ error: "Unknown school" });
    }

    const programs = getProgramsForSchool(school);
    const { userCount, postCount, topTrendingTopics } = await aggregateTopTopicsForPrograms(
      programs,
      20
    );

    res.json({
      success: true,
      scope: {
        schoolId: school.id,
        schoolName: school.fullName,
        programsIncluded: programs,
        userCount,
        postCount,
      },
      topTrendingTopics,
    });
  } catch (error) {
    console.error("getSchoolTrendAnalytics:", error);
    res.status(500).json({
      error: "Failed to build school trends",
      details: error.message,
    });
  }
};

export const getDepartmentTrendAnalytics = async (req, res) => {
  try {
    const departmentId = String(req.query.departmentId || "").trim();
    if (!departmentId) {
      return res.status(400).json({ error: "Query departmentId is required" });
    }

    const resolved = getBucketByDepartmentId(departmentId);
    if (!resolved) {
      return res.status(404).json({ error: "Unknown department analytics bucket" });
    }

    const { school, department } = resolved;
    const programs = uniqueProgramList(department.programs);
    const users = await User.find({ department: { $in: programs } })
      .select("_id name username profilePhoto department")
      .lean();
    const userIds = users.map((u) => u._id);
    const authorById = new Map(users.map((u) => [String(u._id), u]));

    if (!userIds.length) {
      return res.json({
        success: true,
        scope: {
          schoolId: school.id,
          schoolName: school.fullName,
          departmentId: department.id,
          departmentLabel: department.label,
          programsIncluded: programs,
          userCount: 0,
          postCount: 0,
        },
        engagementNote:
          "Saves/bookmarks are not recorded in CampusBuzz yet; engagement = likes + comments + shares + reposts.",
        topTrendingTopics: [],
        mostActiveStudents: [],
        mostLikedPosts: [],
        mostCommentedPosts: [],
        mostSharedPosts: [],
        viralPosts: [],
        engagementByMonth: [],
      });
    }

    const posts = await Post.find({
      authorId: { $in: userIds },
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const postIds = posts.map((p) => p._id);

    /** topic → engagement (indexed tags + #words + similar bare words — once per post per topic) */
    const hashtagAgg = {};
    const postEngMap = new Map(posts.map((p) => [String(p._id), engagementParts(p)]));
    const linkedTagsByPost = new Map();

    if (postIds.length) {
      const links = await PostHashtag.find({ postId: { $in: postIds } }).lean();
      const namesNeeded = [...new Set(links.map((l) => l.hashtagId).filter(Boolean))];
      const hashtags = namesNeeded.length
        ? await Hashtag.find({ _id: { $in: namesNeeded } })
            .select("name")
            .lean()
        : [];
      const idToName = new Map(hashtags.map((h) => [String(h._id), h.name]));

      for (const row of links) {
        const pname = idToName.get(String(row.hashtagId));
        if (!pname) continue;
        const pid = String(row.postId);
        if (!linkedTagsByPost.has(pid)) linkedTagsByPost.set(pid, new Set());
        linkedTagsByPost.get(pid).add(pname);
      }
    }

    for (const p of posts) {
      const eg = postEngMap.get(String(p._id));
      if (!eg) continue;
      const topicsForPost = new Set(topicsFromPostContent(p.content));
      const linked = linkedTagsByPost.get(String(p._id));
      if (linked) linked.forEach((t) => topicsForPost.add(t));
      for (const topic of topicsForPost) {
        hashtagAgg[topic] = (hashtagAgg[topic] || 0) + eg.total;
      }
    }

    const topTrendingTopics = Object.entries(hashtagAgg)
      .map(([topic, engagement]) => ({
        topic,
        engagement,
        hashtag: topic,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 15);

    const postCounts = {};
    const postEngTotals = {};
    for (const p of posts) {
      const uid = String(p.authorId);
      postCounts[uid] = (postCounts[uid] || 0) + 1;
      const t = engagementParts(p).total;
      postEngTotals[uid] = (postEngTotals[uid] || 0) + t;
    }

    const mostActiveStudents = [...Object.entries(postCounts)]
      .map(([uid, postCount]) => {
        const u = authorById.get(uid);
        if (!u) return null;
        return {
          userId: uid,
          name: u.name,
          username: u.username,
          profilePhoto: u.profilePhoto || null,
          department: u.department,
          postCount,
          totalEngagementOnPosts: postEngTotals[uid] || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.postCount - a.postCount)
      .slice(0, 10);

    function formatBrief(p) {
      const uid = String(p.authorId);
      const u = authorById.get(uid);
      const e = engagementParts(p);
      return {
        id: String(p._id),
        contentSnippet: (p.content || "").slice(0, 220),
        createdAt: p.createdAt,
        ...e,
        author: u
          ? {
              name: u.name,
              username: u.username,
              profilePhoto: u.profilePhoto || null,
            }
          : null,
      };
    }

    const sortedByLikes = [...posts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
    const sortedByComments = [...posts].sort(
      (a, b) => (b.commentsCount || 0) - (a.commentsCount || 0)
    );
    const sortedByShares = [...posts].sort((a, b) => (b.sharesCount || 0) - (a.sharesCount || 0));
    const viral = [...posts].sort(
      (a, b) => engagementParts(b).total - engagementParts(a).total
    );

    const engagementByMonthMap = {};
    for (const p of posts) {
      const d = p.createdAt ? new Date(p.createdAt) : null;
      if (!d || Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!engagementByMonthMap[key]) {
        engagementByMonthMap[key] = { engagement: 0, posts: 0 };
      }
      engagementByMonthMap[key].engagement += engagementParts(p).total;
      engagementByMonthMap[key].posts += 1;
    }

    const engagementByMonth = Object.entries(engagementByMonthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([month, v]) => ({ month, engagement: v.engagement, posts: v.posts }));

    res.json({
      success: true,
      scope: {
        schoolId: school.id,
        schoolName: school.fullName,
        departmentId: department.id,
        departmentLabel: department.label,
        programsIncluded: programs,
        userCount: users.length,
        postCount: posts.length,
      },
      engagementFormula: "likes + comments + shares + reposts (+ saves when supported)",
      topTrendingTopics,
      mostActiveStudents,
      mostLikedPosts: sortedByLikes.slice(0, 5).map(formatBrief),
      mostCommentedPosts: sortedByComments.slice(0, 5).map(formatBrief),
      mostSharedPosts: sortedByShares.slice(0, 5).map(formatBrief),
      viralPosts: viral.slice(0, 5).map(formatBrief),
      engagementByMonth,
    });
  } catch (error) {
    console.error("getDepartmentTrendAnalytics:", error);
    res.status(500).json({
      error: "Failed to build department analytics",
      details: error.message,
    });
  }
};
