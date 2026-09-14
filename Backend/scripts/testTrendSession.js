import mongoose from 'mongoose';
import { Post } from '../database/index.js';
import { buildTopicContentOrClauses } from '../utils/topicMatch.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campusbuzz');
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const posts = await Post.find({
  isDeleted: false,
  createdAt: { $gte: since },
  $or: buildTopicContentOrClauses('session'),
}).limit(5).lean();
console.log('session posts:', posts.length);
if (posts[0]) console.log('sample:', posts[0].content?.slice(0, 80));
await mongoose.disconnect();
