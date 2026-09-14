import admin from '../firebaseAdmin/firebaseAdmin.js';
import {
  User,
  Post,
  Comment,
  PostLike,
  PostHashtag,
  PostMention,
  CommentLike,
  Share,
  Repost,
  Report,
  PostReport,
  MessageReport,
  UserFollow,
  UserMedia,
  UserLikedPost,
  UserCommentedPost,
  Notification,
  Message,
  MessageReadBy,
  MessageReaction,
  MessageStarredBy,
  MessageDeletedBy,
  Conversation,
  ConversationParticipant,
  ConversationBlockedBy,
  ConversationDeletedBy,
  GroupInvite,
  GroupJoinRequest,
  CustomList,
} from '../database/index.js';

/**
 * Remove a user and related MongoDB data, then delete Firebase Auth account.
 */
export async function deleteUserById(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const uid = user._id;
  const postIds = (await Post.find({ authorId: uid }).select('_id').lean()).map((p) => p._id);

  if (postIds.length > 0) {
    const commentIds = (
      await Comment.find({ postId: { $in: postIds } }).select('_id').lean()
    ).map((c) => c._id);
    const authorCommentIds = (
      await Comment.find({ authorId: uid }).select('_id').lean()
    ).map((c) => c._id);
    const allCommentIds = [...new Set([...commentIds, ...authorCommentIds].map(String))];

    if (allCommentIds.length > 0) {
      await CommentLike.deleteMany({ commentId: { $in: allCommentIds } });
      await UserCommentedPost.deleteMany({
        $or: [{ commentId: { $in: allCommentIds } }, { userId: uid }],
      });
      await Comment.deleteMany({ _id: { $in: allCommentIds } });
    }

    await Promise.all([
      PostLike.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      PostMention.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      PostHashtag.deleteMany({ postId: { $in: postIds } }),
      Share.deleteMany({ $or: [{ postId: { $in: postIds } }, { sharedById: uid }, { sharedWithId: uid }] }),
      Repost.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      UserMedia.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      UserLikedPost.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      UserCommentedPost.deleteMany({ $or: [{ postId: { $in: postIds } }, { userId: uid }] }),
      Post.deleteMany({ _id: { $in: postIds } }),
    ]);
  } else {
    await Comment.deleteMany({ authorId: uid });
    await PostLike.deleteMany({ userId: uid });
    await UserLikedPost.deleteMany({ userId: uid });
    await UserCommentedPost.deleteMany({ userId: uid });
  }

  const userMessageIds = (
    await Message.find({ senderId: uid }).select('_id').lean()
  ).map((m) => m._id);

  if (userMessageIds.length > 0) {
    await Promise.all([
      MessageReadBy.deleteMany({ messageId: { $in: userMessageIds } }),
      MessageReaction.deleteMany({ messageId: { $in: userMessageIds } }),
      MessageStarredBy.deleteMany({ messageId: { $in: userMessageIds } }),
      MessageDeletedBy.deleteMany({ messageId: { $in: userMessageIds } }),
      MessageReport.deleteMany({ messageId: { $in: userMessageIds } }),
    ]);
    await Message.deleteMany({ _id: { $in: userMessageIds } });
  }

  await Promise.all([
    Notification.deleteMany({ $or: [{ userId: uid }, { actorId: uid }] }),
    UserFollow.deleteMany({ $or: [{ followerId: uid }, { followingId: uid }] }),
    Report.deleteMany({ $or: [{ reportedById: uid }, { reviewedById: uid }] }),
    GroupInvite.deleteMany({ $or: [{ invitedUserId: uid }, { invitedById: uid }] }),
    GroupJoinRequest.deleteMany({ $or: [{ userId: uid }, { respondedById: uid }] }),
    ConversationParticipant.deleteMany({ userId: uid }),
    ConversationBlockedBy.deleteMany({ userId: uid }),
    ConversationDeletedBy.deleteMany({ userId: uid }),
    CustomList.deleteMany({ $or: [{ ownerId: uid }, { memberIds: uid }] }),
    Conversation.deleteMany({ requestedById: uid }),
  ]);

  const firebaseId = user.firebaseId;
  await User.deleteOne({ _id: uid });

  if (firebaseId) {
    try {
      await admin.auth().deleteUser(firebaseId);
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
    }
  }

  return user;
}
