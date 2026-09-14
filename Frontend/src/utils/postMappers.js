import { formatDepartmentLabel } from './departmentLabel';

/**
 * Format a date string to relative time (e.g. "2h ago")
 */
export function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

/**
 * Merge multiple post arrays (e.g. home feed + profile posts), newest first, deduped by id.
 */
export function mergeFeedPostLists(...lists) {
  const byId = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const id = String(p?.id || p?._id || '');
      if (!id || id === 'undefined') continue;
      byId.set(id, p);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const ta = new Date(a.createdAt || a.created_at || 0).getTime();
    const tb = new Date(b.createdAt || b.created_at || 0).getTime();
    return tb - ta;
  });
}

/**
 * Map backend feed post to PostCard shape
 */
export function mapBackendPostToCard(p) {
  const author = p.author || p.authorId || {};
  const username = author.username
    ? (author.username.startsWith('@') ? author.username.replace(/^@+/, '') : author.username)
    : 'user';
  const hashtags = (p.content && p.content.match(/#\w+/g))
    ? p.content.match(/#\w+/g).map((t) => t.slice(1))
    : [];
  const mentions = (p.mentions || []).map((m) => `@${(m.username || m).replace(/^@/, '')}`);
  
  // Handle repost information
  const repostedBy = p.repostedBy || null;
  const repostedByUsername = repostedBy?.username
    ? (repostedBy.username.startsWith('@') ? repostedBy.username.replace(/^@+/, '') : repostedBy.username)
    : p.repostedByUsername
    ? (p.repostedByUsername.startsWith('@') ? p.repostedByUsername.replace(/^@+/, '') : p.repostedByUsername)
    : null;
  
  return {
    id: String(p.id || p._id),
    author: {
      name: author.name || 'User',
      username,
      avatar: author.profilePhoto || '',
      department: formatDepartmentLabel(author.department || author.program || ''),
      // Preserve identification fields for ownership checks
      firebaseId: author.firebaseId || null,
      _id: author._id || author.id || null,
      id: author.id || author._id || null,
    },
    content: p.content || '',
    hashtags,
    mentions,
    likes: p.likesCount ?? 0,
    comments: p.commentsCount ?? 0,
    shares: p.sharesCount ?? 0,
    repostsCount: p.repostsCount ?? 0,
    timestamp: formatTimeAgo(p.created_at || p.createdAt),
    liked: !!p.isLiked,
    image: p.image || null,
    createdAt: p.created_at || p.createdAt || null,
    created_at: p.created_at || p.createdAt || null,
    // Repost information
    isReposted: !!p.isReposted, // Indicates if post was reposted by someone (for display)
    userReposted: !!p.userReposted, // Indicates if current user reposted it (for button state)
    repostedBy: repostedBy ? {
      name: repostedBy.name || p.repostedByName || 'User',
      username: repostedByUsername || (repostedBy?.username || '').replace(/^@+/, '') || 'user',
      firebaseId: repostedBy.firebaseId || p.repostedByFirebaseId || null,
      _id: repostedBy._id || repostedBy.id || null,
      id: repostedBy.id || repostedBy._id || null,
    } : null,
    repostedByName: p.repostedByName || repostedBy?.name || null,
    repostedByUsername: repostedByUsername || p.repostedByUsername || null,
    repostedAt: p.repostedAt || null,
    sentiment: {
      label: (
        (typeof p.sentiment === 'string' ? p.sentiment : p.sentiment?.label) ||
        p.SentimentLabel ||
        p.sentimentLabel ||
        p.sentiment_label ||
        'neutral'
      ).toLowerCase(),
      confidence:
        p.Confidence ??
        (typeof p.sentiment === 'object' ? p.sentiment?.confidence : null) ??
        p.sentimentConfidence ??
        p.confidence ??
        null,
    },
    hateSpeech: {
      isHateSpeech: !!(p.hateSpeech?.isHateSpeech),
      label: p.hateSpeech?.label || 'normal',
      confidence: p.hateSpeech?.confidence ?? null,
    },
  };
}

/**
 * Map backend hashtag to TrendCard shape
 */
export function mapBackendHashtagToTrend(h, rankIndex) {
  return {
    id: String(h.id || rankIndex),
    hashtag: h.name || '',
    posts: h.postsCount ?? h.posts_count ?? 0,
    department: 'University-wide',
    trending: true,
  };
}
