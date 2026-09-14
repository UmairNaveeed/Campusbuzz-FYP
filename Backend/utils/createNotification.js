/**
 * Create a notification for a user. Safe to call from any controller.
 * @param {object} models - { Notification } from database/index
 * @param {string|import('mongoose').Types.ObjectId} userId - recipient user id
 * @param {string|import('mongoose').Types.ObjectId} actorId - user who performed the action
 * @param {string} type - 'like' | 'comment' | 'reply' | 'follow' | 'mention' | 'share' | 'repost' | 'comment_like'
 * @param {object} options - { postId?, commentId?, extra? }
 */
export async function createNotification(models, userId, actorId, type, options = {}) {
  if (!userId || !actorId || String(userId) === String(actorId)) return;
  const { Notification } = models;
  if (!Notification) return;
  try {
    await Notification.create({
      userId,
      actorId,
      type,
      postId: options.postId || null,
      commentId: options.commentId || null,
      extra: options.extra ? String(options.extra).substring(0, 500) : null,
    });
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
}
