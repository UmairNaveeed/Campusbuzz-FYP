import mongoose from 'mongoose';
import {
  Post,
  User,
  Report,
} from '../database/index.js';
import { getUserByFirebaseId } from '../utils/dbHelpers.js';
import { softDeletePost } from '../utils/softDeletePost.js';
import {
  POST_MODERATION_REASONS,
  POST_MODERATION_REASON_KEYS,
} from '../utils/moderationReasons.js';

const REASON_LABELS = Object.fromEntries(
  POST_MODERATION_REASONS.map((r) => [r.key, r.label])
);

const FLAGGED_SECTION_KEY = 'flagged_content';
const FLAGGED_SECTION_LABEL = 'Hate/Inappropriate Content';

function reasonLabel(code) {
  return REASON_LABELS[code] || code || 'Other';
}

function reportPostId(report) {
  const raw = report?.postId || report?.reportedItemId;
  if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return null;
  return new mongoose.Types.ObjectId(raw).toString();
}

function postMatchesSearch(post, author, q) {
  if (!q) return true;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  const content = String(post?.content || '');
  const username = String(author?.username || '');
  const name = String(author?.name || '');
  const email = String(author?.email || '');
  return (
    regex.test(content) ||
    regex.test(username) ||
    regex.test(name) ||
    regex.test(email)
  );
}

function buildPostItem(post, meta, author, options = {}) {
  const reports = meta?.reports || [];
  const hateReports = reports.filter((r) => r.reason === 'hate_speech');
  const inappropriateReports = reports.filter((r) => r.reason === 'inappropriate_content');
  const latestReport = reports[0];
  const isMlHate = post?.hateSpeech?.isHateSpeech === true;
  const hasHateReport = hateReports.length > 0;
  const hasInappropriateReport = inappropriateReports.length > 0;

  let category = options.category || 'Hate Speech';
  if (isMlHate && hasInappropriateReport) category = 'Hate Speech & Inappropriate';
  else if (hasInappropriateReport && !isMlHate && !hasHateReport) category = 'Inappropriate Content';
  else if (isMlHate && hasHateReport) category = 'Hate Speech (ML + Report)';
  else if (isMlHate) category = 'Hate Speech (ML)';
  else if (hasHateReport) category = 'Hate Speech (Report)';
  else if (hasInappropriateReport) category = 'Inappropriate Content';

  let detectionSource = 'user_report';
  if (isMlHate && reports.length > 0) detectionSource = 'both';
  else if (isMlHate) detectionSource = 'ml';

  return {
    id: String(post?._id || meta?.postId),
    content: post?.content || '(Post content unavailable)',
    image: post?.image || null,
    isDeleted: !post || !!post.isDeleted,
    postMissing: !post,
    reportsCount: reports.length,
    reason: category,
    reasonCode: hasInappropriateReport && !isMlHate && !hasHateReport
      ? 'inappropriate_content'
      : 'hate_speech',
    category,
    reportedAt:
      latestReport?.createdAt ||
      post?.hateSpeech?.analyzedAt ||
      post?.createdAt ||
      null,
    detectionSource,
    hateConfidence: post?.hateSpeech?.confidence ?? null,
    author: {
      id: author?._id ? String(author._id) : null,
      name: author?.name || 'Unknown',
      username: author?.username || '—',
      email: author?.email || '—',
    },
    isMlDetected: isMlHate,
  };
}

/**
 * GET /api/admin/posts/reported?q=
 * Returns all hate/inappropriate posts as a single admin record list.
 */
export const listReportedPosts = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || 'pending').trim();

    const reportMatch = {
      itemType: 'post',
      reason: { $in: POST_MODERATION_REASON_KEYS },
    };
    if (status && status !== 'all') {
      reportMatch.status = status;
    }

    const pendingReports = await Report.find(reportMatch)
      .sort({ createdAt: -1 })
      .lean();

    const byPost = new Map();
    for (const r of pendingReports) {
      const pid = reportPostId(r);
      if (!pid) continue;
      if (!byPost.has(pid)) {
        byPost.set(pid, { postId: pid, reports: [] });
      }
      byPost.get(pid).reports.push(r);
    }

    const seenIds = new Set();
    const flaggedPosts = [];

    for (const [postIdStr, meta] of byPost.entries()) {
      const post = await Post.findById(postIdStr)
        .select('content image authorId reportsCount createdAt isDeleted hateSpeech')
        .lean();

      let author = null;
      if (post?.authorId) {
        author = await User.findById(post.authorId).select('name username email').lean();
      }

      if (q && !postMatchesSearch(post, author, q)) continue;

      flaggedPosts.push(buildPostItem(post, meta, author));
      seenIds.add(postIdStr);
    }

    const mlFlaggedPosts = await Post.find({
      $or: [
        { 'hateSpeech.isHateSpeech': true },
        { moderationFlagged: true },
      ],
      isDeleted: false,
    })
      .select('content image authorId reportsCount createdAt isDeleted hateSpeech')
      .sort({ 'hateSpeech.analyzedAt': -1, createdAt: -1 })
      .limit(200)
      .lean();

    for (const post of mlFlaggedPosts) {
      const postIdStr = String(post._id);
      if (seenIds.has(postIdStr)) continue;

      let author = null;
      if (post.authorId) {
        author = await User.findById(post.authorId).select('name username email').lean();
      }
      if (q && !postMatchesSearch(post, author, q)) continue;

      flaggedPosts.push(
        buildPostItem(post, { postId: postIdStr, reports: [] }, author, { category: 'Hate Speech (ML)' })
      );
      seenIds.add(postIdStr);
    }

    flaggedPosts.sort((a, b) => new Date(b.reportedAt) - new Date(a.reportedAt));

    const sections = {
      [FLAGGED_SECTION_KEY]: {
        label: FLAGGED_SECTION_LABEL,
        posts: flaggedPosts,
      },
    };

    return res.json({
      success: true,
      total: flaggedPosts.length,
      counts: { [FLAGGED_SECTION_KEY]: flaggedPosts.length },
      sections,
      posts: flaggedPosts,
    });
  } catch (err) {
    console.error('listReportedPosts error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load flagged posts' });
  }
};

/**
 * GET /api/admin/posts/reported/:postId
 */
export const getReportedPostDetail = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    const post = await Post.findById(postId).lean();
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const author = await User.findById(post.authorId).select('name username email').lean();
    const mlDetected = post.hateSpeech?.isHateSpeech === true;
    const reports = await Report.find({ postId: post._id, itemType: 'post' })
      .sort({ createdAt: -1 })
      .populate('reportedById', 'name username')
      .lean();

    return res.json({
      success: true,
      post: {
        id: String(post._id),
        content: post.content,
        image: post.image,
        createdAt: post.createdAt,
        isDeleted: !!post.isDeleted,
        hateSpeech: post.hateSpeech || null,
        mlDetected,
        author: {
          name: author?.name,
          username: author?.username,
          email: author?.email,
        },
      },
      reports: reports.map((r) => ({
        id: String(r._id),
        reason: reasonLabel(r.reason),
        reasonCode: r.reason,
        description: r.description || '',
        status: r.status,
        createdAt: r.createdAt,
        reportedBy: r.reportedById
          ? {
              name: r.reportedById.name,
              username: r.reportedById.username,
            }
          : null,
      })),
    });
  } catch (err) {
    console.error('getReportedPostDetail error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load post' });
  }
};

/**
 * PATCH /api/admin/posts/reported/:postId/dismiss
 * Kept for API compatibility; admin UI no longer uses this.
 */
export const dismissPostReports = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    const adminUser = await getUserByFirebaseId(req.user.uid);
    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    await Report.updateMany(
      { postId: post._id, itemType: 'post', status: 'pending' },
      {
        status: 'dismissed',
        reviewedById: adminUser?._id || null,
        reviewedAt: new Date(),
      }
    );

    const pendingCount = await Report.countDocuments({
      postId: post._id,
      itemType: 'post',
      status: 'pending',
    });
    await Post.updateOne({ _id: post._id }, { reportsCount: pendingCount });

    return res.json({ success: true, message: 'Reports dismissed' });
  } catch (err) {
    console.error('dismissPostReports error:', err);
    return res.status(500).json({ success: false, error: 'Failed to dismiss reports' });
  }
};

/**
 * DELETE /api/admin/posts/reported/:postId
 * Kept for API compatibility; admin UI no longer uses this.
 */
export const adminDeleteReportedPost = async (req, res) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, error: 'Invalid post ID' });
    }

    const adminUser = await getUserByFirebaseId(req.user.uid);
    const post = await Post.findOne({ _id: postId, isDeleted: false });
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    await softDeletePost(post);

    await Report.updateMany(
      { postId: post._id, itemType: 'post', status: 'pending' },
      {
        status: 'resolved',
        reviewedById: adminUser?._id || null,
        reviewedAt: new Date(),
      }
    );

    return res.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('adminDeleteReportedPost error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
};
