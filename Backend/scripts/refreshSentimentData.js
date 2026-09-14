/**
 * Re-score recent group messages and posts, print admin-style sentiment %.
 * Run: node scripts/refreshSentimentData.js
 */
import mongoose from 'mongoose';
import { connectDB } from '../database/connect.js';
import { Post, Message, Conversation } from '../database/index.js';
import { batchAnalyzeSentiment, analyzeSentiment } from '../utils/sentimentAnalysis.js';
function normalizeLabel(label) {
  const l = String(label || 'neutral').toLowerCase();
  if (['positive', 'neutral', 'negative'].includes(l)) return l;
  return 'neutral';
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
  const total = labels.length || 1;
  return {
    total: labels.length,
    positive: Math.round((positive / total) * 100),
    neutral: Math.round((neutral / total) * 100),
    negative: Math.round((negative / total) * 100),
    positiveCount: positive,
    neutralCount: neutral,
    negativeCount: negative,
  };
}

async function labelMessages(messages) {
  const needs = [];
  const needsTexts = [];
  const labels = [];

  for (const msg of messages) {
    const stored = msg.SentimentLabel ? normalizeLabel(msg.SentimentLabel) : null;
    if (stored && msg.SentimentLabel) {
      labels.push(stored);
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
      await Message.updateOne(
        { _id: needs[i]._id },
        { SentimentLabel: label, Confidence: results[i]?.confidence ?? 0 }
      );
    }
  }

  return labels;
}

async function main() {
  await connectDB();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  console.log('\n=== Testing ML ===');
  const test = await analyzeSentiment('i am neagative');
  console.log('Sample:', test);

  const posts = await Post.find({ isDeleted: false, createdAt: { $gte: since } })
    .select('content SentimentLabel')
    .limit(300)
    .lean();
  const postLabels = posts.map((p) => p.SentimentLabel || 'neutral');
  console.log('\n=== Posts (last 7 days) ===');
  console.log(computeDistribution(postLabels));

  const groups = await Conversation.find({ isGroup: true })
    .sort({ lastMessageAt: -1 })
    .limit(5)
    .lean();

  const allMsgLabels = [];
  for (const g of groups) {
    const messages = await Message.find({
      conversationId: g._id,
      isDeleted: false,
      createdAt: { $gte: since },
      content: { $exists: true, $nin: [null, ''] },
    })
      .select('content SentimentLabel Confidence')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    if (messages.length === 0) continue;
    const labels = await labelMessages(messages);
    allMsgLabels.push(...labels);
    const dist = computeDistribution(labels);
    console.log(`\n=== Group: ${g.groupName || g._id} (${messages.length} messages) ===`);
    console.log(dist);
  }

  console.log('\n=== All discussions combined ===');
  console.log(computeDistribution(allMsgLabels));
  console.log('\nDone. Open admin → Sentiment Analysis → Discussions → Refresh\n');

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
