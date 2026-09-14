import {
  Post,
  Comment,
  Hashtag,
  PostLike,
  PostHashtag,
  PostMention,
  Share,
  UserMedia,
  UserLikedPost,
  UserCommentedPost,
} from '../database/index.js';

/**
 * Soft-delete a post and clean up related junction data (shared by user + admin).
 */
export async function softDeletePost(post) {
  const postHashtags = await PostHashtag.find({ postId: post._id }).select('hashtagId').lean();

  await Post.updateOne({ _id: post._id }, { isDeleted: true });
  await Comment.updateMany({ postId: post._id }, { isDeleted: true });

  await Promise.all([
    UserMedia.deleteMany({ postId: post._id }),
    PostLike.deleteMany({ postId: post._id }),
    PostMention.deleteMany({ postId: post._id }),
    Share.deleteMany({ postId: post._id }),
    UserLikedPost.deleteMany({ postId: post._id }),
    UserCommentedPost.deleteMany({ postId: post._id }),
    PostHashtag.deleteMany({ postId: post._id }),
  ]);

  const hashtagIds = [...new Set(postHashtags.map((ph) => ph.hashtagId).filter(Boolean))];
  if (hashtagIds.length > 0) {
    const tags = await Hashtag.find({ _id: { $in: hashtagIds } }).select('postsCount').lean();
    for (const tag of tags) {
      await Hashtag.updateOne(
        { _id: tag._id },
        { postsCount: Math.max(0, (tag.postsCount || 0) - 1) }
      );
    }
  }
}
