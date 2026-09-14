import { User, Post, Comment, Report, Conversation } from '../database/index.js';
import { ADMIN_EMAILS } from '../utils/adminConfig.js';
import {
  POST_MODERATION_REASON_KEYS,
  postModerationBreakdown,
} from '../utils/moderationReasons.js';
import {
  getTrendsSentiment,
  getDiscussionsSentiment,
} from './adminSentimentController.js';

const RANGE_DAYS = {
  'last-7-days': 7,
  'last-30-days': 30,
  'last-90-days': 90,
  'last-year': 365,
};

const RANGE_LABELS = {
  'last-7-days': 'Last 7 days',
  'last-30-days': 'Last 30 days',
  'last-90-days': 'Last 90 days',
  'last-year': 'Last year',
};

const REPORT_TITLES = {
  'user-activity': 'User Activity Report',
  'content-analytics': 'Content Analytics Report',
  'moderation-actions': 'Moderation Actions Report',
  'community-health': 'Community Health Report',
  'trends-analysis': 'Trends Analysis Report',
  'discussion-forums': 'Discussion Forums Report',
};

function reportsRangeToWidenKey(range) {
  const map = {
    'last-7-days': 'weekly',
    'last-30-days': 'monthly',
    'last-90-days': 'monthly',
    'last-year': 'yearly',
  };
  return map[range] || 'monthly';
}

function campusUserFilter() {
  return { email: { $nin: ADMIN_EMAILS } };
}

function sinceDate(rangeKey) {
  const days = RANGE_DAYS[String(rangeKey || 'last-30-days').toLowerCase()] ?? 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function dateFilter(since) {
  return { $gte: since };
}

function normalizeLabel(label) {
  const l = String(label || 'neutral').toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(l) ? l : 'neutral';
}

function getActivityBucketType(since, until) {
  const diffDays = Math.ceil((until.getTime() - since.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays <= 31) return 'day';
  if (diffDays <= 365) return 'week';
  return 'month';
}

function startOf(periodType, date) {
  const d = new Date(date);
  if (periodType === 'day') {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (periodType === 'week') {
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatBucketLabel(periodType, value) {
  if (periodType === 'day') return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (periodType === 'week') return value.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return value.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function createTimeline(since, until, periodType) {
  const buckets = [];
  let cursor = startOf(periodType, since);
  const end = startOf(periodType, until);

  while (cursor <= end) {
    buckets.push({
      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
      label: formatBucketLabel(periodType, cursor),
      date: new Date(cursor),
    });

    if (periodType === 'day') {
      cursor.setDate(cursor.getDate() + 1);
    } else if (periodType === 'week') {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  return buckets;
}

function buildChartSeries(registrations, posters, timeline) {
  const registrationMap = new Map(registrations.map((row) => [row._id, row.count]));
  const posterMap = new Map(posters.map((row) => [row._id, row.count]));

  const data = timeline.map((bucket) => ({
    label: bucket.label,
    registrations: registrationMap.get(bucket.key) || 0,
    posters: posterMap.get(bucket.key) || 0,
  }));

  return {
    labels: data.map((item) => item.label),
    datasets: [
      { label: 'New registrations', data: data.map((item) => item.registrations), color: '#2563eb' },
      { label: 'Users who posted', data: data.map((item) => item.posters), color: '#16a34a' },
    ],
  };
}

async function buildUserActivityReport(since, until) {
  const base = campusUserFilter();
  const periodType = getActivityBucketType(since, until);
  const timeline = createTimeline(since, until, periodType);
  const [totalUsers, newUsers, suspendedUsers, activeAuthorIds, registrations, posters] = await Promise.all([
    User.countDocuments(base),
    User.countDocuments({ ...base, createdAt: { $gte: since, $lte: until } }),
    User.countDocuments({ ...base, accountStatus: 'suspended' }),
    Post.distinct('authorId', { isDeleted: false, createdAt: { $gte: since, $lte: until } }),
    User.aggregate([
      { $match: { ...base, createdAt: { $gte: since, $lte: until } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$createdAt',
              format: periodType === 'day' ? '%Y-%m-%d' : periodType === 'week' ? '%Y-%m-%d' : '%Y-%m',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    Post.aggregate([
      {
        $match: {
          isDeleted: false,
          createdAt: { $gte: since, $lte: until },
        },
      },
      {
        $group: {
          _id: '$authorId',
          firstSeen: { $min: '$createdAt' },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$firstSeen',
              format: periodType === 'day' ? '%Y-%m-%d' : periodType === 'week' ? '%Y-%m-%d' : '%Y-%m',
            },
          },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const activeUsers = activeAuthorIds.filter(Boolean).length;
  const chart = buildChartSeries(registrations, posters, timeline);

  return {
    metrics: [
      { label: 'Total campus users', value: totalUsers },
      { label: 'New registrations', value: newUsers },
      { label: 'Users who posted', value: activeUsers },
      { label: 'Suspended accounts', value: suspendedUsers },
    ],
    details: [
      { label: 'Total users (all time)', value: totalUsers },
      { label: 'New users in period', value: newUsers },
      { label: 'Active posters in period', value: activeUsers },
      { label: 'Currently suspended', value: suspendedUsers },
    ],
    activityChart: chart,
  };
}

async function buildContentAnalyticsReport(since) {
  const postFilter = { isDeleted: false, createdAt: dateFilter(since) };
  const commentFilter = { isDeleted: false, createdAt: dateFilter(since) };

  const [postsCreated, commentsCreated, posts] = await Promise.all([
    Post.countDocuments(postFilter),
    Comment.countDocuments(commentFilter),
    Post.find(postFilter).select('likesCount commentsCount').lean(),
  ]);

  const totalLikes = posts.reduce((sum, p) => sum + (p.likesCount || 0), 0);
  const totalCommentsOnPosts = posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0);
  const avgEngagement =
    postsCreated > 0
      ? Math.round(((totalLikes + totalCommentsOnPosts) / postsCreated) * 10) / 10
      : 0;

  return {
    metrics: [
      { label: 'Posts created', value: postsCreated },
      { label: 'Comments posted', value: commentsCreated },
      { label: 'Likes on new posts', value: totalLikes },
      { label: 'Avg engagement per post', value: `${avgEngagement}` },
    ],
    details: [
      { label: 'Posts in period', value: postsCreated },
      { label: 'Comments in period', value: commentsCreated },
      { label: 'Total likes (on period posts)', value: totalLikes },
      { label: 'Comment count on period posts', value: totalCommentsOnPosts },
      { label: 'Engagement index (likes+comments)/posts', value: avgEngagement },
    ],
  };
}

async function buildModerationReport(since) {
  const reportFilter = {
    itemType: 'post',
    reason: { $in: POST_MODERATION_REASON_KEYS },
    createdAt: dateFilter(since),
  };

  const [reportsReceived, reasonAgg] = await Promise.all([
    Report.countDocuments(reportFilter),
    Report.aggregate([
      { $match: reportFilter },
      { $group: { _id: '$reason', count: { $sum: 1 } } },
    ]),
  ]);

  const breakdown = postModerationBreakdown(reasonAgg);

  return {
    metrics: [
      { label: 'Reports received', value: reportsReceived },
    ],
    details: [],
    breakdown,
  };
}

async function buildCommunityHealthReport(since) {
  const posts = await Post.find({ isDeleted: false, createdAt: dateFilter(since) })
    .select('SentimentLabel')
    .limit(3000)
    .lean();

  let positive = 0;
  let neutral = 0;
  let negative = 0;
  for (const p of posts) {
    const l = normalizeLabel(p.SentimentLabel);
    if (l === 'positive') positive += 1;
    else if (l === 'negative') negative += 1;
    else neutral += 1;
  }

  const total = posts.length;
  const positivePct = total ? Math.round((positive / total) * 100) : 0;
  const neutralPct = total ? Math.round((neutral / total) * 100) : 0;
  const negativePct = total ? Math.round((negative / total) * 100) : 0;

  return {
    metrics: [
      { label: 'Posts analyzed', value: total },
      { label: 'Positive', value: `${positivePct}%` },
      { label: 'Neutral', value: `${neutralPct}%` },
      { label: 'Negative', value: `${negativePct}%` },
    ],
    details: [
      { label: 'Positive posts', value: positive },
      { label: 'Neutral posts', value: neutral },
      { label: 'Negative posts', value: negative },
    ],
    breakdown: [
      { label: 'Positive', value: positivePct, color: '#22c55e' },
      { label: 'Neutral', value: neutralPct, color: '#9ca3af' },
      { label: 'Negative', value: negativePct, color: '#ef4444' },
    ],
  };
}

async function buildTrendsAnalysisReport(since, rangeKey) {
  const data = await getTrendsSentiment(since, '', reportsRangeToWidenKey(rangeKey));
  const dist = data.distribution || {};

  const breakdown = (data.items || []).map((row) => ({
    label: row.trend,
    value: row.mentions,
    sentiment: row.sentiment,
    mood: row.avgSentiment,
    positive: row.positive,
    neutral: row.neutral,
    negative: row.negative,
  }));

  return {
    metrics: [
      { label: 'Trending topics', value: data.items?.length ?? 0 },
      { label: 'Posts analyzed', value: dist.total ?? 0 },
      { label: 'Campus mood', value: `${dist.overall ?? 0}%` },
      { label: 'Positive share', value: `${dist.positive ?? 0}%` },
    ],
    details: [
      { label: 'Topics with activity', value: data.items?.length ?? 0 },
      { label: 'Total posts in trends', value: dist.total ?? 0 },
      { label: 'Positive posts', value: dist.positiveCount ?? 0 },
      { label: 'Neutral posts', value: dist.neutralCount ?? 0 },
      { label: 'Negative posts', value: dist.negativeCount ?? 0 },
    ],
    breakdown,
    items: data.items || [],
    rangeNote: data.rangeNote || null,
  };
}

async function buildDiscussionForumsReport(since) {
  const data = await getDiscussionsSentiment(since, '');
  const dist = data.distribution || {};

  const [totalGroups, activeGroups] = await Promise.all([
    Conversation.countDocuments({ isGroup: true }),
    Conversation.countDocuments({
      isGroup: true,
      lastMessageAt: dateFilter(since),
    }),
  ]);

  const breakdown = (data.items || []).map((row) => ({
    label: row.forumName,
    value: row.postsCount,
    sentiment: row.sentiment,
    mood: row.avgSentiment,
    positive: row.positive,
    neutral: row.neutral,
    negative: row.negative,
  }));

  return {
    metrics: [
      { label: 'Forums with messages', value: data.items?.length ?? 0 },
      { label: 'Messages analyzed', value: dist.total ?? 0 },
      { label: 'Campus mood', value: `${dist.overall ?? 0}%` },
      { label: 'Active groups', value: activeGroups },
    ],
    details: [
      { label: 'Total discussion groups', value: totalGroups },
      { label: 'Groups active in period', value: activeGroups },
      { label: 'Messages in period', value: dist.total ?? 0 },
      { label: 'Positive messages', value: dist.positiveCount ?? 0 },
      { label: 'Neutral messages', value: dist.neutralCount ?? 0 },
      { label: 'Negative messages', value: dist.negativeCount ?? 0 },
    ],
    breakdown,
    items: data.items || [],
  };
}

/**
 * GET /api/admin/reports?type=&range=&startDate=&endDate=
 * Can use preset range OR custom startDate/endDate
 */
export const getAdminReport = async (req, res) => {
  try {
    const type = String(req.query.type || 'user-activity').toLowerCase();
    let range = String(req.query.range || 'last-30-days').toLowerCase();

    if (!REPORT_TITLES[type]) {
      return res.status(400).json({ success: false, error: 'Invalid report type' });
    }

    // Determine date range
    let since, until, rangeLabel, customRange = false;
    
    if (req.query.startDate && req.query.endDate) {
      // Custom date range
      try {
        since = new Date(req.query.startDate);
        until = new Date(req.query.endDate);
        
        if (isNaN(since.getTime()) || isNaN(until.getTime())) {
          throw new Error('Invalid date format');
        }
        
        // Set end date to end of day
        until = new Date(until.getTime() + 24 * 60 * 60 * 1000 - 1);
        
        const start = since.toLocaleDateString();
        const end = until.toLocaleDateString();
        rangeLabel = `${start} to ${end}`;
        customRange = true;
        
        console.log(`[📅 Report Filter] Custom date range: ${since.toISOString()} to ${until.toISOString()}`);
      } catch (dateErr) {
        console.warn('Invalid custom date parameters:', dateErr.message);
        return res.status(400).json({ success: false, error: 'Invalid date range format' });
      }
    } else {
      // Preset range
      if (!RANGE_DAYS[range]) {
        return res.status(400).json({ success: false, error: 'Invalid date range' });
      }
      since = sinceDate(range);
      until = new Date();
      rangeLabel = RANGE_LABELS[range];
    }

    let report;

    switch (type) {
      case 'content-analytics':
        report = await buildContentAnalyticsReport(since);
        break;
      case 'moderation-actions':
        report = await buildModerationReport(since);
        break;
      case 'community-health':
        report = await buildCommunityHealthReport(since);
        break;
      case 'trends-analysis':
        report = await buildTrendsAnalysisReport(since, range);
        break;
      case 'discussion-forums':
        report = await buildDiscussionForumsReport(since);
        break;
      default:
        report = await buildUserActivityReport(since, until);
    }

    return res.json({
      success: true,
      reportType: type,
      title: REPORT_TITLES[type],
      range: customRange ? 'custom' : range,
      rangeLabel,
      dateRange: {
        startDate: since.toISOString(),
        endDate: until.toISOString(),
      },
      generatedAt: new Date().toISOString(),
      ...report,
    });
  } catch (err) {
    console.error('getAdminReport error:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate report' });
  }
};
