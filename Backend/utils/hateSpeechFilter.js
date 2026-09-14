/**
 * Helpers for hiding flagged hate/inappropriate posts from all users.
 * Flagged posts are admin-only records.
 */

export function isFlaggedPost(post) {
  return post?.moderationFlagged === true || post?.hateSpeech?.isHateSpeech === true;
}

/** @deprecated Use isFlaggedPost */
export function isHateSpeechPost(post) {
  return isFlaggedPost(post);
}

export function resolvePostAuthorId(post) {
  if (!post) return null;
  const raw = post.authorId ?? post.author;
  if (!raw) return null;
  if (typeof raw === 'object') return raw._id || raw.id || null;
  return raw;
}

export function isPostVisibleToViewer(post) {
  return !isFlaggedPost(post);
}

export function filterPostsForViewer(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter((p) => isPostVisibleToViewer(p));
}

/** MongoDB clause: exclude all flagged posts from user-facing queries. */
export function excludeAllHateSpeechFilter() {
  return {
    moderationFlagged: { $ne: true },
    'hateSpeech.isHateSpeech': { $ne: true },
  };
}
