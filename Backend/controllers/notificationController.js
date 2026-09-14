import { Notification, User, Post } from '../database/index.js';

async function getCurrentUser(req) {
  return await User.findOne({ firebaseId: req.user.uid });
}

/**
 * GET /api/notifications
 */
export const getNotifications = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { limit = 50, skip = 0, unreadOnly, type, scope } = req.query;
    const filter = { userId: user._id };
    if (unreadOnly === 'true') filter.readAt = null;
    const forumTypes = ['group_join_request', 'group_join_accepted', 'group_join_rejected', 'group_invite'];
    if (scope === 'forum') {
      filter.type = { $in: forumTypes };
    } else if (scope === 'main') {
      filter.type = { $nin: forumTypes };
    } else if (type && ['like', 'comment', 'reply', 'follow', 'mention', 'share', ...forumTypes].includes(type)) {
      filter.type = type;
    }

    const notifications = await Notification.find(filter)
      .populate('actorId', 'name username profilePhoto firebaseId')
      .populate('postId', 'content authorId')
      .populate('commentId', 'content authorId')
      .sort({ created_at: -1 })
      .limit(Math.min(parseInt(limit, 10) || 50, 100))
      .skip(parseInt(skip, 10) || 0)
      .lean();

    const list = notifications.map((n) => {
      const j = { ...n, actor: n.actorId, post: n.postId, comment: n.commentId };
      // Preserve postId and commentId for navigation even after populating
      if (n.postId) {
        j.postId = n.postId._id || n.postId.id || n.postId; // Use _id from populated post, or original postId
        j.post = { ...n.postId, id: n.postId._id || n.postId.id, _id: n.postId._id || n.postId.id };
      }
      if (n.commentId) {
        j.commentId = n.commentId._id || n.commentId.id || n.commentId;
        j.comment = { ...n.commentId, id: n.commentId._id || n.commentId.id, _id: n.commentId._id || n.commentId.id };
      }
      delete j.actorId;
      j.createdAt = j.created_at || j.createdAt;
      return j;
    });

    res.json({ success: true, notifications: list, count: list.length });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications', details: error.message });
  }
};

/**
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { scope } = req.query;
    const filter = { userId: user._id, readAt: null };
    const forumTypes = ['group_join_request', 'group_join_accepted', 'group_join_rejected', 'group_invite'];
    if (scope === 'forum') {
      filter.type = { $in: forumTypes };
    } else if (scope === 'main') {
      filter.type = { $nin: forumTypes };
    }

    const count = await Notification.countDocuments(filter);
    res.json({ success: true, count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count', details: error.message });
  }
};

/**
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { id } = req.params;
    const n = await Notification.findOne({ _id: id, userId: user._id });
    if (!n) return res.status(404).json({ error: 'Notification not found' });

    n.readAt = new Date();
    await n.save();
    res.json({ success: true, notification: n.toObject ? n.toObject() : n });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read', details: error.message });
  }
};

/**
 * POST /api/notifications/mark-all-read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { scope } = req.body || req.query;
    const filter = { userId: user._id, readAt: null };
    const forumTypes = ['group_join_request', 'group_join_accepted', 'group_join_rejected', 'group_invite'];
    if (scope === 'forum') {
      filter.type = { $in: forumTypes };
    } else if (scope === 'main') {
      filter.type = { $nin: forumTypes };
    }

    await Notification.updateMany(filter, { readAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read', details: error.message });
  }
};

/**
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({ _id: id, userId: user._id });
    if (!deleted) return res.status(404).json({ error: 'Notification not found' });

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification', details: error.message });
  }
};
