import mongoose from 'mongoose';
import { Post, Hashtag, PostHashtag } from '../database/index.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campusbuzz');
const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const total = await Post.countDocuments({ isDeleted: false });
const recent = await Post.countDocuments({ isDeleted: false, createdAt: { $gte: since30 } });
console.log('posts total', total, 'last 30d', recent);

const top = await Hashtag.find().sort({ postsCount: -1 }).limit(5).lean();
for (const t of top) {
  const links = await PostHashtag.find({ hashtagId: t._id }).lean();
  const ids = links.map((l) => l.postId);
  const all = await Post.countDocuments({ _id: { $in: ids }, isDeleted: false });
  const rec = await Post.countDocuments({
    _id: { $in: ids },
    isDeleted: false,
    createdAt: { $gte: since30 },
  });
  console.log(`#${t.name}: linked=${all}, last30d=${rec}, postsCount field=${t.postsCount}`);
}
await mongoose.disconnect();
