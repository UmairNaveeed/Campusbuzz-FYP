// import {
//   Post,
//   Hashtag,
//   PostHashtag,
//   Conversation,
//   Message,
// } from '../database/index.js';
// import {
//   batchAnalyzeSentiment,
//   analyzeSentiment,
//   checkMlServiceHealth,
// } from '../utils/sentimentAnalysis.js';
// import { buildTopicContentOrClauses, topicsFromPostContent } from '../utils/topicMatch.js';

// const RANGE_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

// function normalizeLabel(label) {
//   const l = String(label || 'neutral').toLowerCase();
//   return ['positive', 'neutral', 'negative'].includes(l) ? l : 'neutral';
// }

// function capitalize(label) {
//   const l = normalizeLabel(label);
//   return l.charAt(0).toUpperCase() + l.slice(1);
// }

// function sinceDate(rangeKey) {
//   const days = RANGE_DAYS[String(rangeKey || 'weekly').toLowerCase()] ?? 7;
//   return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
// }

// function computeDistribution(labels) {
//   let positive = 0;
//   let neutral = 0;
//   let negative = 0;
//   for (const label of labels) {
//     const l = normalizeLabel(label);
//     if (l === 'positive') positive += 1;
//     else if (l === 'negative') negative += 1;
//     else neutral += 1;
//   }
//   const total = labels.length;
//   if (total === 0) {
//     return {
//       total: 0,
//       positive: 0,
//       neutral: 0,
//       negative: 0,
//       positiveCount: 0,
//       neutralCount: 0,
//       negativeCount: 0,
//       overall: 0,
//     };
//   }
//   const positivePct = Math.round((positive / total) * 100);
//   const neutralPct = Math.round((neutral / total) * 100);
//   const negativePct = Math.round((negative / total) * 100);
//   return {
//     total,
//     positive: positivePct,
//     neutral: neutralPct,
//     negative: negativePct,
//     positiveCount: positive,
//     neutralCount: neutral,
//     negativeCount: negative,
//     overall: positivePct,
//   };
// }

// /** Confidence may be 0–1 (ML) or wrongly stored as 0–100; always normalize to 0–1. */
// function normalizeConfidence(confidence) {
//   if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0.7;
//   if (confidence > 1) return Math.min(1, confidence / 100);
//   if (confidence < 0) return 0;
//   return confidence;
// }

// /** Mood score 0–100: higher = more positive. Never negative. */
// function moodScoreFromLabelAndConfidence(label, confidence) {
//   const conf = normalizeConfidence(confidence);
//   const l = normalizeLabel(label);
//   if (l === 'positive') return Math.round(50 + conf * 50);
//   if (l === 'negative') return Math.round(50 - conf * 50);
//   return 50;
// }

// function averageMoodScore(scores) {
//   if (!scores?.length) return 0;
//   const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
//   return Math.max(0, Math.min(100, avg));
// }

// /** Posts created with schema defaults were never scored by ML (Confidence 0). */
// function postNeedsMlAnalysis(post) {
//   if (!String(post?.content || '').trim()) return false;
//   const conf = normalizeConfidence(post.Confidence);
//   const model = String(post.Model || '').toLowerCase();
//   if (model.includes('lexicon')) return true;
//   if (conf <= 0) return true;
//   return false;
// }

// async function labelPosts(posts) {
//   const labels = new Array(posts.length).fill('neutral');
//   const confidences = new Array(posts.length).fill(0);
//   const needs = [];
//   const needsTexts = [];
//   const indices = [];

//   for (let i = 0; i < posts.length; i += 1) {
//     const p = posts[i];
//     if (!postNeedsMlAnalysis(p)) {
//       labels[i] = normalizeLabel(p.SentimentLabel);
//       confidences[i] = normalizeConfidence(p.Confidence);
//       continue;
//     }
//     const text = String(p.content || '').trim();
//     if (!text) continue;
//     needs.push(p);
//     needsTexts.push(text);
//     indices.push(i);
//   }

//   if (needsTexts.length > 0) {
//     const results = await batchAnalyzeSentiment(needsTexts);
//     for (let j = 0; j < needs.length; j += 1) {
//       const label = normalizeLabel(results[j]?.sentiment_label);
//       const conf = normalizeConfidence(results[j]?.confidence ?? 0);
//       labels[indices[j]] = label;
//       confidences[indices[j]] = conf;
//       Post.updateOne(
//         { _id: needs[j]._id },
//         {
//           SentimentLabel: label,
//           Confidence: conf,
//           Model: results[j]?.model || 'iumairr/xlm-t-roman-urdu-sentiment',
//         }
//       ).catch(() => {});
//     }
//   }

//   return { labels, confidences };
// }

// async function labelMessages(messages) {
//   const labels = [];
//   const needs = [];
//   const needsTexts = [];

//   for (const msg of messages) {
//     if (msg.SentimentLabel) {
//       labels.push(normalizeLabel(msg.SentimentLabel));
//       continue;
//     }
//     const text = String(msg.content || '').trim();
//     if (!text) {
//       labels.push('neutral');
//       continue;
//     }
//     needs.push(msg);
//     needsTexts.push(text);
//   }

//   if (needsTexts.length > 0) {
//     const results = await batchAnalyzeSentiment(needsTexts);
//     for (let i = 0; i < needs.length; i += 1) {
//       const label = normalizeLabel(results[i]?.sentiment_label);
//       labels.push(label);
//       Message.updateOne(
//         { _id: needs[i]._id },
//         { SentimentLabel: label, Confidence: results[i]?.confidence ?? 0 }
//       ).catch(() => {});
//     }
//   }

//   return labels;
// }

// async function getPostsSentiment(since, keyword) {
//   const filter = { isDeleted: false, createdAt: { $gte: since } };
//   if (keyword) {
//     const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     filter.content = new RegExp(escaped, 'i');
//   }

//   const posts = await Post.find(filter)
//     .select('content SentimentLabel Confidence Model createdAt')
//     .sort({ createdAt: -1 })
//     .limit(200)
//     .lean();

//   const { labels, confidences } = await labelPosts(posts);
//   const distribution = computeDistribution(labels);
//   if (posts.length > 0) {
//     const scores = labels.map((label, i) => moodScoreFromLabelAndConfidence(label, confidences[i]));
//     distribution.overall = averageMoodScore(scores);
//   }

//   const samples = posts.slice(0, 12).map((p, i) => ({
//     id: String(p._id),
//     text: p.content,
//     sentiment: capitalize(labels[i]),
//     confidence: Math.round(normalizeConfidence(confidences[i]) * 100),
//   }));

//   return { distribution, samples };
// }

// function normalizeTrendKeyword(raw) {
//   return String(raw || '').replace(/^#/, '').trim().toLowerCase();
// }

// function isValidTrendName(name) {
//   const n = normalizeTrendKeyword(name);
//   return n.length > 0 && n !== 'undefined';
// }

// async function postsForTrendTopic(topic, since) {
//   const tag = await Hashtag.findOne({
//     name: new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
//   }).lean();

//   const postIdSet = new Set();
//   if (tag) {
//     const links = await PostHashtag.find({ hashtagId: tag._id }).select('postId').lean();
//     for (const l of links) {
//       if (l.postId) postIdSet.add(l.postId);
//     }
//   }

//   const orClauses = [...buildTopicContentOrClauses(topic)];
//   if (postIdSet.size > 0) {
//     orClauses.unshift({ _id: { $in: [...postIdSet] } });
//   }
//   if (!orClauses.length) return [];

//   return Post.find({
//     isDeleted: false,
//     createdAt: { $gte: since },
//     $or: orClauses,
//   })
//     .select('content SentimentLabel Confidence Model')
//     .limit(500)
//     .lean();
// }

// function buildTrendItem(topic, posts, labeled) {
//   const { labels, confidences } = labeled;
//   const dist = computeDistribution(labels);
//   const scores = labels.map((label, i) => moodScoreFromLabelAndConfidence(label, confidences[i]));
//   const counts = { positive: 0, neutral: 0, negative: 0 };
//   for (const l of labels) counts[normalizeLabel(l)] += 1;
//   const topLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

//   return {
//     id: `topic-${topic}`,
//     trend: `#${topic}`,
//     mentions: posts.length,
//     sentiment: capitalize(topLabel),
//     avgSentiment: Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1)),
//     positive: dist.positive,
//     neutral: dist.neutral,
//     negative: dist.negative,
//   };
// }

// async function discoverHotTopics(since, limit = 20) {
//   const posts = await Post.find({ isDeleted: false, createdAt: { $gte: since } })
//     .select('content')
//     .sort({ createdAt: -1 })
//     .limit(800)
//     .lean();

//   const counts = {};
//   for (const p of posts) {
//     for (const topic of topicsFromPostContent(p.content)) {
//       if (!isValidTrendName(topic)) continue;
//       counts[topic] = (counts[topic] || 0) + 1;
//     }
//   }

//   return Object.entries(counts)
//     .sort((a, b) => b[1] - a[1])
//     .slice(0, limit)
//     .map(([topic]) => topic);
// }

// async function postsForTrendTopicWithWiden(topic, since, rangeKey) {
//   let posts = await postsForTrendTopic(topic, since);
//   let effectiveRange = rangeKey;
//   let rangeNote = null;

//   if (posts.length > 0) {
//     return { posts, effectiveRange, rangeNote };
//   }

//   const widenOrder = [];
//   if (rangeKey === 'weekly') widenOrder.push('monthly', 'yearly');
//   else if (rangeKey === 'monthly') widenOrder.push('yearly');

//   for (const wider of widenOrder) {
//     const widerSince = sinceDate(wider);
//     posts = await postsForTrendTopic(topic, widerSince);
//     if (posts.length > 0) {
//       effectiveRange = wider;
//       const label =
//         wider === 'monthly' ? 'last 30 days' : wider === 'yearly' ? 'last year' : wider;
//       rangeNote = `No #${topic} posts in your selected range. Showing ${label} (${posts.length} posts).`;
//       break;
//     }
//   }

//   return { posts, effectiveRange, rangeNote };
// }

// export async function getTrendsSentiment(since, keyword, rangeKey = 'weekly') {
//   const trendKeyword = normalizeTrendKeyword(keyword);

//   if (trendKeyword) {
//     const { posts, effectiveRange, rangeNote } = await postsForTrendTopicWithWiden(
//       trendKeyword,
//       since,
//       rangeKey
//     );
//     const labeled = await labelPosts(posts);
//     const distribution = computeDistribution(labeled.labels);
//     if (posts.length > 0) {
//       const scores = labeled.labels.map((label, i) =>
//         moodScoreFromLabelAndConfidence(label, labeled.confidences[i])
//       );
//       distribution.overall = averageMoodScore(scores);
//     }
//     return {
//       distribution,
//       items: posts.length ? [buildTrendItem(trendKeyword, posts, labeled)] : [],
//       effectiveRange,
//       rangeNote,
//     };
//   }

//   const seen = new Set();
//   const items = [];
//   const allLabels = [];
//   const allScores = [];

//   const dbTags = await Hashtag.find({ postsCount: { $gt: 0 } })
//     .sort({ postsCount: -1 })
//     .limit(20)
//     .lean();
//   const hotTopics = await discoverHotTopics(since, 15);
//   const topicQueue = [];

//   for (const tag of dbTags) {
//     if (isValidTrendName(tag.name)) topicQueue.push(tag.name.toLowerCase());
//   }
//   for (const t of hotTopics) {
//     if (!topicQueue.includes(t)) topicQueue.push(t);
//   }

//   for (const topic of topicQueue) {
//     if (seen.has(topic) || items.length >= 12) continue;
//     seen.add(topic);

//     const posts = await postsForTrendTopic(topic, since);
//     if (!posts.length) continue;

//     const labeled = await labelPosts(posts);
//     allLabels.push(...labeled.labels);
//     for (let i = 0; i < labeled.labels.length; i += 1) {
//       allScores.push(moodScoreFromLabelAndConfidence(labeled.labels[i], labeled.confidences[i]));
//     }
//     items.push(buildTrendItem(topic, posts, labeled));
//   }

//   const distribution = computeDistribution(allLabels);
//   if (allScores.length > 0) {
//     distribution.overall = averageMoodScore(allScores);
//   }

//   return { distribution, items };
// }

// export async function getDiscussionsSentiment(since, keyword) {
//   const groupFilter = { isGroup: true };
//   const q = String(keyword || '').trim();

//   if (q) {
//     const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//     const regex = new RegExp(escaped, 'i');
//     groupFilter.$or = [{ groupName: regex }, { groupDescription: regex }];
//   }

//   const groups = await Conversation.find(groupFilter)
//     .select('groupName groupDescription lastMessageAt')
//     .sort({ lastMessageAt: -1 })
//     .limit(q ? 50 : 20)
//     .lean();

//   const items = [];
//   const allLabels = [];
//   const allScores = [];

//   for (const group of groups) {
//     const msgFilter = {
//       conversationId: group._id,
//       isDeleted: false,
//       createdAt: { $gte: since },
//       content: { $exists: true, $nin: [null, ''] },
//     };

//     const messages = await Message.find(msgFilter)
//       .select('content SentimentLabel Confidence')
//       .sort({ createdAt: -1 })
//       .limit(200)
//       .lean();

//     if (!messages.length) continue;

//     const labels = await labelMessages(messages);
//     allLabels.push(...labels);
//     messages.forEach((m, i) => {
//       allScores.push(moodScoreFromLabelAndConfidence(labels[i], m.Confidence));
//     });

//     const dist = computeDistribution(labels);
//     const scores = messages.map((m, i) => moodScoreFromLabelAndConfidence(labels[i], m.Confidence));
//     const counts = { positive: 0, neutral: 0, negative: 0 };
//     for (const l of labels) counts[normalizeLabel(l)] += 1;
//     const topLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

//     items.push({
//       id: String(group._id),
//       forumName: group.groupName || 'Unnamed group',
//       postsCount: messages.length,
//       sentiment: capitalize(topLabel),
//       avgSentiment: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
//       positive: dist.positive,
//       neutral: dist.neutral,
//       negative: dist.negative,
//     });
//   }

//   const distribution = computeDistribution(allLabels);
//   if (allScores.length > 0) {
//     distribution.overall = averageMoodScore(allScores);
//   }

//   return { distribution, items };
// }

// export const getAdminSentimentOverview = async (req, res) => {
//   try {
//     const tab = String(req.query.tab || 'posts').toLowerCase();
//     const range = String(req.query.range || 'weekly').toLowerCase();
//     const keyword = String(req.query.q || '').trim();
//     const since = sinceDate(range);

//     let distribution = computeDistribution([]);
//     let samples = [];
//     let items = [];

//     let forumOptions = [];
//     let rangeNote = null;
//     let effectiveRange = range;
//     const mlServiceAvailable = await checkMlServiceHealth();

//     if (tab === 'discussions') {
//       const data = await getDiscussionsSentiment(since, keyword);
//       distribution = data.distribution;
//       items = data.items;
//       const allForums = await Conversation.find({ isGroup: true })
//         .select('groupName')
//         .sort({ groupName: 1 })
//         .lean();
//       forumOptions = allForums
//         .map((g) => g.groupName)
//         .filter((name) => name && String(name).trim());
//     } else if (tab === 'trends') {
//       const data = await getTrendsSentiment(since, keyword, range);
//       distribution = data.distribution;
//       items = data.items;
//       rangeNote = data.rangeNote || null;
//       effectiveRange = data.effectiveRange || range;
//     } else {
//       const data = await getPostsSentiment(since, keyword);
//       distribution = data.distribution;
//       samples = data.samples;
//     }

//     let keywordAnalysis = null;
//     if (keyword) {
//       const ml = await analyzeSentiment(keyword);
//       keywordAnalysis = {
//         keyword,
//         sentiment: capitalize(ml.sentiment_label),
//         confidence: Math.round(normalizeConfidence(ml.confidence) * 100),
//       };
//     }

//     distribution.overall = Math.max(0, Math.min(100, distribution.overall ?? 0));

//     return res.json({
//       success: true,
//       tab,
//       range,
//       distribution,
//       samples,
//       items,
//       keywordAnalysis,
//       mlServiceAvailable,
//       forumOptions,
//       rangeNote,
//       effectiveRange,
//     });
//   } catch (err) {
//     console.error('getAdminSentimentOverview error:', err);
//     return res.status(500).json({ success: false, error: 'Failed to load sentiment data' });
//   }
// };
import {
  Post,
  Hashtag,
  PostHashtag,
  Conversation,
  Message,
} from '../database/index.js';
import {
  batchAnalyzeSentiment,
  analyzeSentiment,
  checkMlServiceHealth,
} from '../utils/sentimentAnalysis.js';
import { buildTopicContentOrClauses, topicsFromPostContent } from '../utils/topicMatch.js';

const RANGE_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

function normalizeLabel(label) {
  const l = String(label || 'neutral').toLowerCase();
  return ['positive', 'neutral', 'negative'].includes(l) ? l : 'neutral';
}

function capitalize(label) {
  const l = normalizeLabel(label);
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function sinceDate(rangeKey) {
  const days = RANGE_DAYS[String(rangeKey || 'weekly').toLowerCase()] ?? 7;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function computeDistribution(labels) {
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
  if (total === 0) {
    return {
      total: 0,
      positive: 0,
      neutral: 0,
      negative: 0,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      overall: 0,
    };
  }
  const positivePct = Math.round((positive / total) * 100);
  const neutralPct = Math.round((neutral / total) * 100);
  const negativePct = Math.round((negative / total) * 100);
  return {
    total,
    positive: positivePct,
    neutral: neutralPct,
    negative: negativePct,
    positiveCount: positive,
    neutralCount: neutral,
    negativeCount: negative,
    overall: positivePct,
  };
}

function normalizeConfidence(confidence) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 0.7;
  if (confidence > 1) return Math.min(1, confidence / 100);
  if (confidence < 0) return 0;
  return confidence;
}

function moodScoreFromLabelAndConfidence(label, confidence) {
  const conf = normalizeConfidence(confidence);
  const l = normalizeLabel(label);
  if (l === 'positive') return Math.round(50 + conf * 50);
  if (l === 'negative') return Math.round(50 - conf * 50);
  return 50;
}

function averageMoodScore(scores) {
  if (!scores?.length) return 0;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return Math.max(0, Math.min(100, avg));
}

function postNeedsMlAnalysis(post) {
  if (!String(post?.content || '').trim()) return false;
  const conf = normalizeConfidence(post.Confidence);
  const model = String(post.Model || '').toLowerCase();
  if (model.includes('lexicon')) return true;
  if (conf <= 0) return true;
  return false;
}

async function labelPosts(posts) {
  const labels = new Array(posts.length).fill('neutral');
  const confidences = new Array(posts.length).fill(0);
  const needs = [];
  const needsTexts = [];
  const indices = [];

  for (let i = 0; i < posts.length; i += 1) {
    const p = posts[i];
    if (!postNeedsMlAnalysis(p)) {
      labels[i] = normalizeLabel(p.SentimentLabel);
      confidences[i] = normalizeConfidence(p.Confidence);
      continue;
    }
    const text = String(p.content || '').trim();
    if (!text) continue;
    needs.push(p);
    needsTexts.push(text);
    indices.push(i);
  }

  if (needsTexts.length > 0) {
    const results = await batchAnalyzeSentiment(needsTexts);
    for (let j = 0; j < needs.length; j += 1) {
      const label = normalizeLabel(results[j]?.sentiment_label);
      const conf = normalizeConfidence(results[j]?.confidence ?? 0);
      labels[indices[j]] = label;
      confidences[indices[j]] = conf;
      Post.updateOne(
        { _id: needs[j]._id },
        {
          SentimentLabel: label,
          Confidence: conf,
          Model: results[j]?.model || 'iumairr/xlm-t-roman-urdu-sentiment',
        }
      ).catch(() => {});
    }
  }

  return { labels, confidences };
}

async function labelMessages(messages) {
  const labels = [];
  const needs = [];
  const needsTexts = [];

  for (const msg of messages) {
    if (msg.SentimentLabel) {
      labels.push(normalizeLabel(msg.SentimentLabel));
      continue;
    }
    const text = String(msg.content || '').trim();
    if (!text) {
      labels.push('neutral');
      continue;
    }
    needs.push(msg);
    needsTexts.push(text);
  }

  if (needsTexts.length > 0) {
    const results = await batchAnalyzeSentiment(needsTexts);
    for (let i = 0; i < needs.length; i += 1) {
      const label = normalizeLabel(results[i]?.sentiment_label);
      labels.push(label);
      Message.updateOne(
        { _id: needs[i]._id },
        { SentimentLabel: label, Confidence: results[i]?.confidence ?? 0 }
      ).catch(() => {});
    }
  }

  return labels;
}

async function getPostsSentiment(since, keyword) {
  const filter = { isDeleted: false, createdAt: { $gte: since } };
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.content = new RegExp(escaped, 'i');
  }

  const posts = await Post.find(filter)
    .select('content SentimentLabel Confidence Model createdAt')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const { labels, confidences } = await labelPosts(posts);
  const distribution = computeDistribution(labels);
  if (posts.length > 0) {
    const scores = labels.map((label, i) => moodScoreFromLabelAndConfidence(label, confidences[i]));
    distribution.overall = averageMoodScore(scores);
  }

  const samples = posts.slice(0, 12).map((p, i) => ({
    id: String(p._id),
    text: p.content,
    sentiment: capitalize(labels[i]),
    confidence: Math.round(normalizeConfidence(confidences[i]) * 100),
  }));

  return { distribution, samples };
}

function normalizeTrendKeyword(raw) {
  return String(raw || '').replace(/^#/, '').trim().toLowerCase();
}

function isValidTrendName(name) {
  const n = normalizeTrendKeyword(name);
  return n.length > 0 && n !== 'undefined';
}

async function postsForTrendTopic(topic, since) {
  const tag = await Hashtag.findOne({
    name: new RegExp(`^${topic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  }).lean();

  const postIdSet = new Set();
  if (tag) {
    const links = await PostHashtag.find({ hashtagId: tag._id }).select('postId').lean();
    for (const l of links) {
      if (l.postId) postIdSet.add(l.postId);
    }
  }

  const orClauses = [...buildTopicContentOrClauses(topic)];
  if (postIdSet.size > 0) {
    orClauses.unshift({ _id: { $in: [...postIdSet] } });
  }
  if (!orClauses.length) return [];

  return Post.find({
    isDeleted: false,
    createdAt: { $gte: since },
    $or: orClauses,
  })
    .select('content SentimentLabel Confidence Model')
    .limit(500)
    .lean();
}

function buildTrendItem(topic, posts, labeled) {
  const { labels, confidences } = labeled;
  const dist = computeDistribution(labels);
  const scores = labels.map((label, i) => moodScoreFromLabelAndConfidence(label, confidences[i]));
  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const l of labels) counts[normalizeLabel(l)] += 1;
  const topLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  return {
    id: `topic-${topic}`,
    trend: `#${topic}`,
    mentions: posts.length,
    sentiment: capitalize(topLabel),
    avgSentiment: Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1)),
    positive: dist.positive,
    neutral: dist.neutral,
    negative: dist.negative,
  };
}

async function discoverHotTopics(since, limit = 20) {
  const posts = await Post.find({ isDeleted: false, createdAt: { $gte: since } })
    .select('content')
    .sort({ createdAt: -1 })
    .limit(800)
    .lean();

  const counts = {};
  for (const p of posts) {
    for (const topic of topicsFromPostContent(p.content)) {
      if (!isValidTrendName(topic)) continue;
      counts[topic] = (counts[topic] || 0) + 1;
    }
  }

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topic);
}

async function postsForTrendTopicWithWiden(topic, since, rangeKey) {
  let posts = await postsForTrendTopic(topic, since);
  let effectiveRange = rangeKey;
  let rangeNote = null;

  if (posts.length > 0) {
    return { posts, effectiveRange, rangeNote };
  }

  const widenOrder = [];
  if (rangeKey === 'weekly') widenOrder.push('monthly', 'yearly');
  else if (rangeKey === 'monthly') widenOrder.push('yearly');

  for (const wider of widenOrder) {
    const widerSince = sinceDate(wider);
    posts = await postsForTrendTopic(topic, widerSince);
    if (posts.length > 0) {
      effectiveRange = wider;
      const label =
        wider === 'monthly' ? 'last 30 days' : wider === 'yearly' ? 'last year' : wider;
      rangeNote = `No #${topic} posts in your selected range. Showing ${label} (${posts.length} posts).`;
      break;
    }
  }

  return { posts, effectiveRange, rangeNote };
}

export async function getTrendsSentiment(since, keyword, rangeKey = 'weekly') {
  const trendKeyword = normalizeTrendKeyword(keyword);

  if (trendKeyword) {
    const { posts, effectiveRange, rangeNote } = await postsForTrendTopicWithWiden(
      trendKeyword,
      since,
      rangeKey
    );
    const labeled = await labelPosts(posts);
    const distribution = computeDistribution(labeled.labels);
    if (posts.length > 0) {
      const scores = labeled.labels.map((label, i) =>
        moodScoreFromLabelAndConfidence(label, labeled.confidences[i])
      );
      distribution.overall = averageMoodScore(scores);
    }
    return {
      distribution,
      items: posts.length ? [buildTrendItem(trendKeyword, posts, labeled)] : [],
      effectiveRange,
      rangeNote,
    };
  }

  const seen = new Set();
  const items = [];
  const allLabels = [];
  const allScores = [];

  const dbTags = await Hashtag.find({ postsCount: { $gt: 0 } })
    .sort({ postsCount: -1 })
    .limit(20)
    .lean();
  const hotTopics = await discoverHotTopics(since, 15);
  const topicQueue = [];

  for (const tag of dbTags) {
    if (isValidTrendName(tag.name)) topicQueue.push(tag.name.toLowerCase());
  }
  for (const t of hotTopics) {
    if (!topicQueue.includes(t)) topicQueue.push(t);
  }

  for (const topic of topicQueue) {
    if (seen.has(topic) || items.length >= 12) continue;
    seen.add(topic);

    const posts = await postsForTrendTopic(topic, since);
    if (!posts.length) continue;

    const labeled = await labelPosts(posts);
    allLabels.push(...labeled.labels);
    for (let i = 0; i < labeled.labels.length; i += 1) {
      allScores.push(moodScoreFromLabelAndConfidence(labeled.labels[i], labeled.confidences[i]));
    }
    items.push(buildTrendItem(topic, posts, labeled));
  }

  const distribution = computeDistribution(allLabels);
  if (allScores.length > 0) {
    distribution.overall = averageMoodScore(allScores);
  }

  return { distribution, items };
}

export async function getDiscussionsSentiment(since, keyword) {
  const groupFilter = { isGroup: true };
  const q = String(keyword || '').trim();

  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    groupFilter.$or = [{ groupName: regex }, { groupDescription: regex }];
  }

  const groups = await Conversation.find(groupFilter)
    .select('groupName groupDescription lastMessageAt')
    .sort({ lastMessageAt: -1 })
    .limit(q ? 50 : 20)
    .lean();

  const items = [];
  const allLabels = [];
  const allScores = [];

  for (const group of groups) {
    const msgFilter = {
      conversationId: group._id,
      isDeleted: false,
      createdAt: { $gte: since },
      content: { $exists: true, $nin: [null, ''] },
    };

    const messages = await Message.find(msgFilter)
      .select('content SentimentLabel Confidence')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    if (!messages.length) continue;

    const labels = await labelMessages(messages);
    allLabels.push(...labels);
    messages.forEach((m, i) => {
      allScores.push(moodScoreFromLabelAndConfidence(labels[i], m.Confidence));
    });

    const dist = computeDistribution(labels);
    const scores = messages.map((m, i) => moodScoreFromLabelAndConfidence(labels[i], m.Confidence));
    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const l of labels) counts[normalizeLabel(l)] += 1;
    const topLabel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    items.push({
      id: String(group._id),
      forumName: group.groupName || 'Unnamed group',
      postsCount: messages.length,
      sentiment: capitalize(topLabel),
      avgSentiment: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      positive: dist.positive,
      neutral: dist.neutral,
      negative: dist.negative,
    });
  }

  const distribution = computeDistribution(allLabels);
  if (allScores.length > 0) {
    distribution.overall = averageMoodScore(allScores);
  }

  return { distribution, items };
}

export const getAdminSentimentOverview = async (req, res) => {
  try {
    const tab = String(req.query.tab || 'posts').toLowerCase();
    const range = String(req.query.range || 'weekly').toLowerCase();
    const keyword = String(req.query.q || '').trim();
    
    // Determine date range
    let since, until;
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
        console.log(`[📅 Sentiment Filter] Custom date range: ${since.toISOString()} to ${until.toISOString()}`);
      } catch (dateErr) {
        console.warn('Invalid custom date parameters:', dateErr.message);
        since = sinceDate(range);
        until = new Date();
      }
    } else {
      // Preset range
      since = sinceDate(range);
      until = new Date();
    }

    let distribution = computeDistribution([]);
    let samples = [];
    let items = [];

    let forumOptions = [];
    let rangeNote = null;
    let effectiveRange = range;
    const mlServiceAvailable = await checkMlServiceHealth();

    if (tab === 'discussions') {
      const data = await getDiscussionsSentiment(since, keyword);
      distribution = data.distribution;
      items = data.items;
      const allForums = await Conversation.find({ isGroup: true })
        .select('groupName')
        .sort({ groupName: 1 })
        .lean();
      forumOptions = allForums
        .map((g) => g.groupName)
        .filter((name) => name && String(name).trim());
    } else if (tab === 'trends') {
      const data = await getTrendsSentiment(since, keyword, range);
      distribution = data.distribution;
      items = data.items;
      rangeNote = data.rangeNote || null;
      effectiveRange = data.effectiveRange || range;
    } else {
      const data = await getPostsSentiment(since, keyword);
      distribution = data.distribution;
      samples = data.samples;
    }

    let keywordAnalysis = null;
    if (keyword) {
      const ml = await analyzeSentiment(keyword);
      keywordAnalysis = {
        keyword,
        sentiment: capitalize(ml.sentiment_label),
        confidence: Math.round(normalizeConfidence(ml.sentiment_confidence) * 100),
      };
    }

    distribution.overall = Math.max(0, Math.min(100, distribution.overall ?? 0));

    return res.json({
      success: true,
      tab,
      range,
      distribution,
      samples,
      items,
      keywordAnalysis,
      mlServiceAvailable,
      forumOptions,
      rangeNote,
      effectiveRange,
      dateRange: {
        startDate: since.toISOString(),
        endDate: until.toISOString(),
      },
    });
  } catch (err) {
    console.error('getAdminSentimentOverview error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load sentiment data' });
  }
};