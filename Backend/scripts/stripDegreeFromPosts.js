/**
 * Remove trailing degree names from post content (e.g. "· PhD Psychology").
 * Run: node scripts/stripDegreeFromPosts.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Post } from "../database/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEGREE_SUFFIX = /\s*·\s*.+$/;

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const posts = await Post.find({ isDeleted: false, content: /·/ }).select("_id content").lean();
  let n = 0;
  for (const p of posts) {
    const next = String(p.content).replace(DEGREE_SUFFIX, "").trim();
    if (next !== p.content) {
      await Post.updateOne({ _id: p._id }, { $set: { content: next } });
      n += 1;
    }
  }
  console.log(`Stripped degree suffix from ${n} posts.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
