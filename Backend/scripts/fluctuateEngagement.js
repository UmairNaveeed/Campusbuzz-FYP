/**
 * Give each post varied engagement counts (fixes uniform likes/comments from old seed).
 * Run: node scripts/fluctuateEngagement.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Post } from "../database/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function main() {
  if (!MONGO_URI) {
    console.error("Set MONGODB_URI in Backend/.env");
    process.exit(1);
  }
  await mongoose.connect(MONGO_URI);
  const posts = await Post.find({ isDeleted: false }).select("_id").lean();
  let updated = 0;
  for (const post of posts) {
    const likesCount = Math.floor(Math.random() * 24) + 1;
    const commentsCount = Math.floor(Math.random() * 11);
    const sharesCount = Math.floor(Math.random() * 7);
    const repostsCount = Math.floor(Math.random() * 8);
    await Post.updateOne(
      { _id: post._id },
      { $set: { likesCount, commentsCount, sharesCount, repostsCount } }
    );
    updated += 1;
    if (updated % 200 === 0) console.log(`  ... ${updated} posts`);
  }
  console.log(`Done. Updated engagement on ${updated} posts.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
