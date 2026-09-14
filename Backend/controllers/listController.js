import mongoose from 'mongoose';
import { CustomList, User, Post, PostLike } from '../database/index.js';
import { getUserByFirebaseId } from '../utils/dbHelpers.js';
import { enrichPostsWithAuthorDetails, AUTHOR_PUBLIC_FIELDS } from './postController.js';

const MEMBER_PUBLIC_FIELDS = 'name username profilePhoto firebaseId department program';

function isValidObjectId(id) {
  if (!id) return false;
  return mongoose.Types.ObjectId.isValid(id) && String(id).length === 24;
}

function formatList(list, membersDetail = []) {
  const memberIds = (list.memberIds || []).map((m) =>
    typeof m === 'object' && m?._id ? String(m._id) : String(m)
  );
  const count = memberIds.length;
  return {
    id: String(list._id),
    name: list.name,
    description: list.description || '',
    members: count,
    memberCount: count,
    memberIds,
    membersDetail,
    isOwner: true,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

async function resolveMemberUsers(memberIds) {
  if (!memberIds?.length) return [];
  const ids = memberIds.filter((id) => isValidObjectId(id));
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids } })
    .select(MEMBER_PUBLIC_FIELDS)
    .lean();
  return users.map((u) => ({
    _id: u._id,
    id: String(u._id),
    name: u.name,
    username: u.username,
    profilePhoto: u.profilePhoto || null,
    firebaseId: u.firebaseId,
    department: u.department || u.program || null,
  }));
}

async function getOwnedList(listId, ownerId) {
  if (!isValidObjectId(listId)) return null;
  return CustomList.findOne({ _id: listId, ownerId }).lean();
}

/**
 * GET /api/lists — all lists for current user
 */
export const getMyLists = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const lists = await CustomList.find({ ownerId: user._id })
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = lists.map((list) => formatList(list, []));

    res.json({ success: true, lists: formatted });
  } catch (error) {
    console.error('Get lists error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch lists', details: error.message });
  }
};

/**
 * GET /api/lists/:listId — single list with member details
 */
export const getListById = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const list = await getOwnedList(req.params.listId, user._id);
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    const membersDetail = await resolveMemberUsers(list.memberIds || []);
    res.json({ success: true, list: formatList(list, membersDetail) });
  } catch (error) {
    console.error('Get list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch list', details: error.message });
  }
};

/**
 * POST /api/lists — create custom list
 */
export const createList = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!name) {
      return res.status(400).json({ success: false, error: 'List name is required' });
    }
    if (name.length > 80) {
      return res.status(400).json({ success: false, error: 'List name must be 80 characters or less' });
    }

    const duplicate = await CustomList.findOne({ ownerId: user._id, name }).lean();
    if (duplicate) {
      return res.status(409).json({ success: false, error: 'You already have a list with this name' });
    }

    const list = await CustomList.create({
      ownerId: user._id,
      name,
      description: description.slice(0, 200),
      memberIds: [],
    });

    res.status(201).json({
      success: true,
      list: formatList(list.toObject(), []),
      message: 'List created successfully',
    });
  } catch (error) {
    console.error('Create list error:', error);
    res.status(500).json({ success: false, error: 'Failed to create list', details: error.message });
  }
};

/**
 * PATCH /api/lists/:listId — update name/description
 */
export const updateList = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const list = await CustomList.findOne({ _id: req.params.listId, ownerId: user._id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    const name = req.body?.name != null ? String(req.body.name).trim() : null;
    const description = req.body?.description != null ? String(req.body.description).trim() : null;

    if (name !== null) {
      if (!name) return res.status(400).json({ success: false, error: 'List name cannot be empty' });
      const duplicate = await CustomList.findOne({
        ownerId: user._id,
        name,
        _id: { $ne: list._id },
      }).lean();
      if (duplicate) {
        return res.status(409).json({ success: false, error: 'You already have a list with this name' });
      }
      list.name = name.slice(0, 80);
    }
    if (description !== null) {
      list.description = description.slice(0, 200);
    }

    await list.save();
    const membersDetail = await resolveMemberUsers(list.memberIds || []);
    res.json({ success: true, list: formatList(list.toObject(), membersDetail) });
  } catch (error) {
    console.error('Update list error:', error);
    res.status(500).json({ success: false, error: 'Failed to update list', details: error.message });
  }
};

/**
 * DELETE /api/lists/:listId
 */
export const deleteList = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const result = await CustomList.deleteOne({ _id: req.params.listId, ownerId: user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, error: 'List not found' });
    }

    res.json({ success: true, message: 'List deleted successfully' });
  } catch (error) {
    console.error('Delete list error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete list', details: error.message });
  }
};

/**
 * POST /api/lists/:listId/members — add users by username or userId
 * Body: { usernames: string[] } or { userIds: string[] }
 */
export const addMembers = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const list = await CustomList.findOne({ _id: req.params.listId, ownerId: user._id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    const { usernames = [], userIds = [] } = req.body || {};
    const toAdd = new Set();

    if (Array.isArray(usernames) && usernames.length > 0) {
      const clean = usernames.map((u) => String(u).replace(/^@/, '').trim()).filter(Boolean);
      const found = await User.find({ username: { $in: clean } }).select('_id').lean();
      found.forEach((u) => toAdd.add(String(u._id)));
    }

    if (Array.isArray(userIds) && userIds.length > 0) {
      for (const id of userIds) {
        if (isValidObjectId(id)) toAdd.add(String(id));
      }
    }

    if (toAdd.size === 0) {
      return res.status(400).json({ success: false, error: 'No valid users to add' });
    }

    // Cannot add yourself
    toAdd.delete(String(user._id));

    const existing = new Set((list.memberIds || []).map((id) => String(id)));
    for (const id of toAdd) {
      if (!existing.has(id)) existing.add(id);
    }
    list.memberIds = [...existing].map((id) => new mongoose.Types.ObjectId(id));
    await list.save();

    const membersDetail = await resolveMemberUsers(list.memberIds);
    res.json({
      success: true,
      list: formatList(list.toObject(), membersDetail),
      addedCount: toAdd.size,
    });
  } catch (error) {
    console.error('Add members error:', error);
    res.status(500).json({ success: false, error: 'Failed to add members', details: error.message });
  }
};

/**
 * DELETE /api/lists/:listId/members — remove users
 * Body: { usernames: string[] } or { userIds: string[] }
 */
export const removeMembers = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const list = await CustomList.findOne({ _id: req.params.listId, ownerId: user._id });
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    const { usernames = [], userIds = [] } = req.body || {};
    const toRemove = new Set();

    if (Array.isArray(usernames) && usernames.length > 0) {
      const clean = usernames.map((u) => String(u).replace(/^@/, '').trim()).filter(Boolean);
      const found = await User.find({ username: { $in: clean } }).select('_id').lean();
      found.forEach((u) => toRemove.add(String(u._id)));
    }

    if (Array.isArray(userIds) && userIds.length > 0) {
      for (const id of userIds) {
        if (isValidObjectId(id)) toRemove.add(String(id));
      }
    }

    if (toRemove.size === 0) {
      return res.status(400).json({ success: false, error: 'No valid users to remove' });
    }

    list.memberIds = (list.memberIds || []).filter((id) => !toRemove.has(String(id)));
    await list.save();

    const membersDetail = await resolveMemberUsers(list.memberIds);
    res.json({ success: true, list: formatList(list.toObject(), membersDetail) });
  } catch (error) {
    console.error('Remove members error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove members', details: error.message });
  }
};

/**
 * GET /api/lists/:listId/feed — posts only from list members
 */
export const getListFeed = async (req, res) => {
  try {
    const { limit = 30, skip = 0 } = req.query;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const list = await getOwnedList(req.params.listId, user._id);
    if (!list) return res.status(404).json({ success: false, error: 'List not found' });

    const memberIds = (list.memberIds || []).filter((id) => isValidObjectId(id));
    if (memberIds.length === 0) {
      return res.json({
        success: true,
        posts: [],
        count: 0,
        listName: list.name,
        message: 'Add members to this list to see their posts here.',
      });
    }

    const limitNum = Math.min(parseInt(limit, 10) || 30, 50);
    const skipNum = parseInt(skip, 10) || 0;

    const posts = await Post.find({
      authorId: { $in: memberIds },
      isDeleted: { $ne: true },
    })
      .populate('authorId', AUTHOR_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(limitNum)
      .lean();

    const postIds = posts.map((p) => p._id);
    const likedRows = postIds.length
      ? await PostLike.find({ postId: { $in: postIds }, userId: user._id }).select('postId').lean()
      : [];
    const likedSet = new Set(likedRows.map((r) => String(r.postId)));

    let postsWithLikes = posts.map((p) => ({
      ...p,
      id: p._id,
      author: p.authorId,
      isLiked: likedSet.has(String(p._id)),
      userReposted: false,
      isReposted: false,
    }));

    postsWithLikes = await enrichPostsWithAuthorDetails(postsWithLikes);

    res.json({
      success: true,
      posts: postsWithLikes,
      count: postsWithLikes.length,
      listId: String(list._id),
      listName: list.name,
      memberCount: memberIds.length,
    });
  } catch (error) {
    console.error('List feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch list feed', details: error.message });
  }
};
