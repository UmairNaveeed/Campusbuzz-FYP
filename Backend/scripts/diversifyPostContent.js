/**
 * Replace duplicate seed post text with unique content per post.
 * Run: node scripts/diversifyPostContent.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Post, User, Hashtag, PostHashtag } from "../database/index.js";
import { generateUniquePostContent } from "../utils/postContentGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

function extractHashtags(text) {
  const matches = String(text || "").match(/#(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

async function syncHashtags(postId, oldTags, newTags) {
  await PostHashtag.deleteMany({ postId });
  for (const tag of oldTags) {
    if (!newTags.includes(tag)) {
      await Hashtag.updateOne({ name: tag }, { $inc: { postsCount: -1 } });
    }
  }
  for (const tag of newTags) {
    let hashtag = await Hashtag.findOne({ name: tag });
    if (!hashtag) hashtag = await Hashtag.create({ name: tag, postsCount: 0 });
    const exists = await PostHashtag.findOne({ postId, hashtagId: hashtag._id });
    if (!exists) {
      await PostHashtag.create({ postId, hashtagId: hashtag._id });
      await Hashtag.updateOne(
        { _id: hashtag._id },
        { $inc: { postsCount: 1 }, lastUsed: new Date() }
      );
    }
  }
}

async function main() {
  if (!MONGO_URI) {
    console.error("Set MONGODB_URI in Backend/.env");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);

  const posts = await Post.find({ isDeleted: false })
    .select("_id authorId content")
    .sort({ createdAt: 1 })
    .lean();

  const authorIds = [...new Set(posts.map((p) => String(p.authorId)))];
  const users = await User.find({ _id: { $in: authorIds } })
    .select("_id department")
    .lean();
  const deptByAuthor = new Map(users.map((u) => [String(u._id), u.department || ""]));

  const used = new Set();
  let updated = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const oldTags = extractHashtags(post.content);
    const department = deptByAuthor.get(String(post.authorId)) || "";

    let content;
    let attempt = 0;
    do {
      content = generateUniquePostContent(i + attempt * 9973, {
        userId: String(post.authorId),
        department,
      });
      attempt += 1;
    } while (used.has(content) && attempt < 20);

    const cleaned = content
      .replace(/\s*·\s*(BS|MPhil|MS|PhD|B\.?Ed|AD|MBA).+$/i, "")
      .replace(/\s*\([A-Za-z]+\s+dept\)\s*$/i, "")
      .trim();
    used.add(cleaned);
    const newTags = extractHashtags(cleaned);

    await Post.updateOne({ _id: post._id }, { $set: { content: cleaned } });
    await syncHashtags(post._id, oldTags, newTags);
    updated += 1;
    if (updated % 200 === 0) console.log(`  ... ${updated} posts`);
  }

  console.log(`Done. ${updated} posts now have unique text.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
