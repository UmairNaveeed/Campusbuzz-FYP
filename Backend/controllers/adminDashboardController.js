import { User, Post, Report, Conversation } from '../database/index.js';
import { ADMIN_EMAILS } from '../utils/adminConfig.js';
import {
  POST_MODERATION_REASON_KEYS,
  postModerationBreakdown,
} from '../utils/moderationReasons.js';

function normalizeLabel(label) {
  const l = String(label || 'neutral').toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(l) ? l : 'neutral';
}

function computeSentimentPercentages(labels) {
  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const label of labels) {
    const l = normalizeLabel(label);
    if (l === 'positive') positive += 1;
    else if (l === 'negative') negative += 1;
    else neutral += 1;
  }
  const total = labels.length;
  if (!total) {
    return [
      { label: 'Positive', percentage: 0, color: '#22c55e' },
      { label: 'Neutral', percentage: 0, color: '#9ca3af' },
      { label: 'Negative', percentage: 0, color: '#ef4444' },
    ];
  }
  return [
    { label: 'Positive', percentage: Math.round((positive / total) * 100), color: '#22c55e' },
    { label: 'Neutral', percentage: Math.round((neutral / total) * 100), color: '#9ca3af' },
    { label: 'Negative', percentage: Math.round((negative / total) * 100), color: '#ef4444' },
  ];
}

/**
 * GET /api/admin/stats
 * Query params: startDate, endDate (ISO 8601 format)
 */
export const getAdminDashboardStats = async (req, res) => {
  try {
    const campusUserFilter = { email: { $nin: ADMIN_EMAILS } };
    
    // Parse date range from query params or use default (last 30 days)
    let startDate, endDate;
    if (req.query.startDate && req.query.endDate) {
      try {
        startDate = new Date(req.query.startDate);
        endDate = new Date(req.query.endDate);
        
        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid date format');
        }
        
        // Set end date to end of day (23:59:59)
        endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        console.log(`[📅 Dashboard Filter] Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      } catch (dateErr) {
        console.warn('Invalid date parameters:', dateErr.message);
        // Fall back to default 30 days
        endDate = new Date();
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
    } else {
      // Default: last 30 days
      endDate = new Date();
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const dateFilter = { createdAt: { $gte: startDate, $lte: endDate } };

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalPosts,
      postsInRange,
      pendingReportedPosts,
      activeDiscussionGroups,
      reportReasonAgg,
      recentPosts,
      approvedAlumniCount,
      approvedAlumni,
    ] = await Promise.all([
      User.countDocuments(campusUserFilter),
      User.countDocuments({ ...campusUserFilter, accountStatus: { $ne: 'suspended' } }),
      User.countDocuments({ ...campusUserFilter, accountStatus: 'suspended' }),
      Post.countDocuments({ isDeleted: false }),
      Post.countDocuments({ isDeleted: false, ...dateFilter }),
      Promise.all([
        Report.distinct('postId', {
          itemType: 'post',
          status: 'pending',
          reason: { $in: POST_MODERATION_REASON_KEYS },
        }),
        Post.distinct('_id', {
          $or: [
            { 'hateSpeech.isHateSpeech': true },
            { moderationFlagged: true },
          ],
          isDeleted: false,
        }),
      ]).then(([reportedIds, mlIds]) => {
        const unique = new Set([
          ...reportedIds.filter(Boolean).map(String),
          ...mlIds.filter(Boolean).map(String),
        ]);
        return unique.size;
      }),
      Conversation.countDocuments({ isGroup: true }),
      Report.aggregate([
        {
          $match: {
            itemType: 'post',
            status: 'pending',
            reason: { $in: ['hate_speech', 'inappropriate_content'] },
          },
        },
        { $group: { _id: '$reason', count: { $sum: 1 } } },
      ]),
      Post.find({ isDeleted: false, ...dateFilter })
        .select('SentimentLabel')
        .limit(2000)
        .lean(),
      User.countDocuments({ ...campusUserFilter, accountType: 'alumni' }),
      User.find({ ...campusUserFilter, accountType: 'alumni' })
        .select('name email username accountStatus createdAt')
        .sort({ createdAt: -1 })
        .limit(8)
        .lean(),
    ]);

    const reportOverview = postModerationBreakdown(reportReasonAgg).map((row) => ({
      type: row.label,
      count: row.value,
    }));

    const sentimentSummary = computeSentimentPercentages(
      recentPosts.map((p) => p.SentimentLabel)
    );

    const moodPositive = sentimentSummary.find((s) => s.label === 'Positive')?.percentage ?? 0;

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        suspendedUsers,
        totalPosts,
        postsInRange,
        pendingReportedPosts,
        activeDiscussionGroups,
        approvedAlumniCount,
        moodScore: moodPositive,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
      reportOverview,
      sentimentSummary,
      approvedAlumni,
    });
  } catch (err) {
    console.error('getAdminDashboardStats error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
  }
};
