import mongoose from 'mongoose';
import { connectDB } from '../database/connect.js';
import { Conversation, Message } from '../database/index.js';

await connectDB();
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const q = 'FYP';
const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const groups = await Conversation.find({
  isGroup: true,
  $or: [{ groupName: new RegExp(escaped, 'i') }, { groupDescription: new RegExp(escaped, 'i') }],
}).lean();
console.log('groups found', groups.map((g) => g.groupName));
for (const g of groups) {
  const n = await Message.countDocuments({
    conversationId: g._id,
    isDeleted: false,
    createdAt: { $gte: since },
    content: { $exists: true, $nin: [null, ''] },
  });
  console.log(g.groupName, 'messages', n);
}
await mongoose.disconnect();
