/**
 * Seed CampusBuzz with users (all GIFT departments), posts, and engagements.
 *
 * Usage (from Backend folder):
 *   node scripts/seedCampusData.js
 *   node scripts/seedCampusData.js --users-per-dept=5 --posts-per-user=6 --media-ratio=0.8
 *   node scripts/seedCampusData.js --year-min=20 --year-max=25   (admission batch codes)
 *
 * Default password pattern: {firstname}{lastname}123!  (lowercase, no spaces)
 * Example: Ahmed Khan -> ahmedkhan123!
 *
 * Credentials are written to scripts/seed-credentials.json
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import {
  buildRollEmail,
  getAllDepartmentConfigs,
  parseRollNumber,
} from "../utils/rollNumberParser.js";
import {
  User,
  Post,
  Comment,
  Share,
  Repost,
  PostLike,
  UserFollow,
  UserLikedPost,
  UserCommentedPost,
  Hashtag,
  PostHashtag,
  UserMedia,
} from "../database/index.js";
import {
  MALE_FIRST,
  FEMALE_FIRST,
  LAST_NAMES,
  BIOS,
  LOCATIONS,
  SAMPLE_MEDIA_URLS,
  COMMENT_TEMPLATES,
  SHARE_MESSAGES,
} from "./seedData.js";
import { generateUniquePostContent } from "../utils/postContentGenerator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const CREDENTIALS_PATH = path.join(__dirname, "seed-credentials.json");

const args = process.argv.slice(2);
const usersPerDept = parseInt(args.find((a) => a.startsWith("--users-per-dept="))?.split("=")[1] || "5", 10);
const postsPerUser = parseInt(args.find((a) => a.startsWith("--posts-per-user="))?.split("=")[1] || "5", 10);
const mediaRatioParsed = parseFloat(args.find((a) => a.startsWith("--media-ratio="))?.split("=")[1] ?? "0.72");
const mediaRatio =
  Number.isFinite(mediaRatioParsed) ? Math.min(1, Math.max(0, mediaRatioParsed)) : 0.72;

/** Max batch code allowed by signup (matches server validation: 18 … current YY). */
const MAX_ADMISSION_YEAR_CODE = new Date().getFullYear() - 2000;
const yearMinArg = parseInt(args.find((a) => a.startsWith("--year-min="))?.split("=")[1] ?? "", 10);
const yearMaxArg = parseInt(args.find((a) => a.startsWith("--year-max="))?.split("=")[1] ?? "", 10);
const YEAR_MIN_DEFAULT = 18;

function buildAdmissionYearCodes() {
  let lo = Number.isFinite(yearMinArg) ? yearMinArg : YEAR_MIN_DEFAULT;
  let hi = Number.isFinite(yearMaxArg) ? yearMaxArg : MAX_ADMISSION_YEAR_CODE;
  lo = Math.max(18, Math.min(lo, MAX_ADMISSION_YEAR_CODE));
  hi = Math.max(18, Math.min(hi, MAX_ADMISSION_YEAR_CODE));
  if (lo > hi) [lo, hi] = [hi, lo];
  const codes = [];
  for (let y = lo; y <= hi; y++) codes.push(String(y).padStart(2, "0"));
  return codes;
}

const ADMISSION_YEAR_CODES = buildAdmissionYearCodes();
const FEMALE_CODES = new Set(["0109", "0110", "46"]);

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

function pickMediaUrl(userId, postIndex) {
  const s = `${userId}${postIndex}`;
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return SAMPLE_MEDIA_URLS[sum % SAMPLE_MEDIA_URLS.length];
}

function slugName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function makePassword(fullName) {
  const parts = fullName.trim().split(/\s+/);
  const base = parts.map((p) => p.toLowerCase()).join("");
  return `${base}123!`;
}

function makeUsername(fullName, deptCode, index) {
  const parts = fullName.trim().split(/\s+/);
  const first = (parts[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "");
  const last = (parts[parts.length - 1] || "gift").toLowerCase().replace(/[^a-z0-9]/g, "");
  const code = deptCode.replace(/^0+/, "") || deptCode;
  let username = `${first}_${last}_${code}${index}`;
  if (username.length > 30) username = `${first.slice(0, 8)}_${code}${index}`;
  return username;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractHashtags(text) {
  const matches = text.match(/#(\w+)/g);
  return matches ? matches.map((t) => t.slice(1).toLowerCase()) : [];
}

async function initFirebase() {
  const serviceAccountPath = path.join(__dirname, "..", "firebaseAdmin", "serviceAccountKey.json");
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
}

async function getOrCreateFirebaseUser(email, password, displayName) {
  try {
    const existing = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(existing.uid, {
      password,
      displayName,
      emailVerified: true,
    });
    return existing.uid;
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const created = await admin.auth().createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

async function upsertMongoUser(firebaseId, email, fullName, username, rollData) {
  const currentYear = new Date().getFullYear();
  const currentStatus = currentYear > rollData.endYear ? "alumni" : "student";

  let user = await User.findOne({ email });
  if (!user) user = await User.findOne({ firebaseId });

  const fields = {
    firebaseId,
    email,
    name: fullName,
    username,
    rollNumber: rollData.rollNumber,
    startYear: rollData.startYear,
    startSemester: rollData.startSemester,
    department: rollData.department,
    endYear: rollData.endYear,
    program: rollData.program,
    currentStatus,
    bio: pick(BIOS),
    location: rollData.department.includes("Girls") ? "Girls Block, GIFT" : pick(LOCATIONS),
  };

  if (user) {
    Object.assign(user, fields);
    await user.save();
    return user;
  }

  return User.create(fields);
}

async function seedUsers(departments) {
  const credentials = [];
  const createdUsers = [];
  let nameIndex = 0;

  console.log(`\n👥 Creating ${usersPerDept} users per department (${departments.length} departments)...\n`);
  if (!ADMISSION_YEAR_CODES.length) {
    console.error("❌ No valid admission year codes (check --year-min / --year-max)");
    return createdUsers;
  }
  const yFirst = ADMISSION_YEAR_CODES[0];
  const yLast = ADMISSION_YEAR_CODES[ADMISSION_YEAR_CODES.length - 1];
  console.log(
    `   Admission batches: 20${yFirst}–20${yLast} (${ADMISSION_YEAR_CODES.length} year codes: ${ADMISSION_YEAR_CODES.join(", ")})`
  );

  let yearRotation = 0;
  for (const dept of departments) {
    const useFemale = dept.femaleOnly || FEMALE_CODES.has(dept.code);
    const firstPool = useFemale ? FEMALE_FIRST : MALE_FIRST;

    for (let i = 1; i <= usersPerDept; i++) {
      const firstName = firstPool[nameIndex % firstPool.length];
      const lastName = LAST_NAMES[(nameIndex + i) % LAST_NAMES.length];
      nameIndex += 1;
      const fullName = `${firstName} ${lastName}`;
      const semester = i % 2 === 0 ? "2" : "1";
      const yy = ADMISSION_YEAR_CODES[yearRotation % ADMISSION_YEAR_CODES.length];
      yearRotation += 1;
      const email = buildRollEmail(yy, semester, dept.code, 1000 + i).toLowerCase();
      const rollData = parseRollNumber(email);
      if (!rollData || rollData.department === "General Studies") {
        console.warn(`⚠️ Skipping invalid roll: ${email}`);
        continue;
      }

      const password = makePassword(fullName);
      let username = makeUsername(fullName, dept.code, i);
      let suffix = 0;
      while (await User.findOne({ username })) {
        suffix += 1;
        username = makeUsername(fullName, dept.code, i + suffix * 100);
        if (username.length > 30) username = `${username.slice(0, 27)}${suffix}`;
      }

      try {
        const firebaseId = await getOrCreateFirebaseUser(email, password, fullName);
        const user = await upsertMongoUser(firebaseId, email, fullName, username, rollData);
        createdUsers.push(user);
        credentials.push({
          name: fullName,
          email,
          username,
          password,
          department: rollData.department,
          rollNumber: rollData.rollNumber,
        });
        if (createdUsers.length % 25 === 0) {
          console.log(`   ... ${createdUsers.length} users created`);
        }
        await delay(80);
      } catch (err) {
        console.error(`❌ Failed ${email}:`, err.message);
      }
    }
  }

  fs.writeFileSync(CREDENTIALS_PATH, JSON.stringify(credentials, null, 2), "utf-8");
  console.log(`\n✅ Users: ${createdUsers.length} (credentials → ${CREDENTIALS_PATH})`);
  return createdUsers;
}

async function seedPosts(users) {
  console.log(`\n📝 Creating ~${postsPerUser} posts per user (media ~${Math.round(mediaRatio * 100)}%)...\n`);
  const allPosts = [];
  let globalPostIndex = 0;

  for (const user of users) {
    const userPostCount = Math.max(2, postsPerUser + Math.floor(Math.random() * 5) - 2);
    for (let p = 0; p < userPostCount; p++) {
      const content = generateUniquePostContent(globalPostIndex++, {
        userId: String(user._id),
        department: user.department || "",
      });
      const withMedia = Math.random() < mediaRatio;
      const imageUrl = withMedia ? pickMediaUrl(user._id, p) : null;
      const post = await Post.create({
        authorId: user._id,
        content,
        image: imageUrl,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        repostsCount: 0,
        isDeleted: false,
        visibility: "public",
        SentimentLabel: pick(["positive", "neutral", "negative"]),
        Confidence: Math.floor(Math.random() * 40) + 60,
      });
      allPosts.push(post);

      if (imageUrl) {
        try {
          await UserMedia.create({ userId: user._id, postId: post._id, imageUrl });
        } catch (_) {
          /* duplicate or schema edge case */
        }
      }

      const tags = extractHashtags(content);
      for (const tag of tags) {
        let hashtag = await Hashtag.findOne({ name: tag });
        if (!hashtag) hashtag = await Hashtag.create({ name: tag, postsCount: 0 });
        await Hashtag.updateOne({ _id: hashtag._id }, { $inc: { postsCount: 1 }, lastUsed: new Date() });
        await PostHashtag.create({ postId: post._id, hashtagId: hashtag._id }).catch(() => {});
      }
    }
    if (allPosts.length % 100 === 0 && allPosts.length > 0) {
      console.log(`   ... ${allPosts.length} posts`);
    }
  }

  console.log(`✅ Posts: ${allPosts.length}`);
  return allPosts;
}

async function seedFollows(users) {
  console.log("\n🤝 Creating follow relationships...\n");
  let count = 0;
  const byDept = {};
  for (const u of users) {
    const key = u.department || "unknown";
    if (!byDept[key]) byDept[key] = [];
    byDept[key].push(u);
  }

  for (const u of users) {
    const sameDept = (byDept[u.department] || []).filter((x) => String(x._id) !== String(u._id));
    const others = users.filter((x) => String(x._id) !== String(u._id) && x.department !== u.department);
    const toFollow = [
      ...pickN(sameDept, Math.min(4, sameDept.length)),
      ...pickN(others, Math.min(3, others.length)),
    ];

    for (const target of toFollow) {
      try {
        await UserFollow.create({ followerId: u._id, followingId: target._id });
        count += 1;
      } catch (_) {
        /* duplicate */
      }
    }
  }
  console.log(`✅ Follows: ${count}`);
}

async function seedEngagements(users, posts) {
  console.log("\n💬 Adding likes, comments, shares, and reposts...\n");

  let likes = 0;
  let comments = 0;
  let shares = 0;
  let reposts = 0;

  for (const post of posts) {
    const author = users.find((u) => String(u._id) === String(post.authorId));
    const others = users.filter((u) => String(u._id) !== String(post.authorId));
    const likeTarget = Math.min(others.length, Math.floor(Math.random() * 22) + 1);
    const commentTarget = Math.min(others.length, Math.floor(Math.random() * 9));
    const shareTarget = Math.min(others.length, Math.floor(Math.random() * 6));
    const repostTarget = Math.min(others.length, Math.floor(Math.random() * 7));
    const likers = pickN(others, likeTarget);
    const commenters = pickN(others, commentTarget);
    const sharers = pickN(others, shareTarget);
    const reposters = pickN(others, repostTarget);

    for (const liker of likers) {
      try {
        await PostLike.create({ postId: post._id, userId: liker._id });
        likes += 1;
        if (author) {
          await UserLikedPost.create({
            userId: liker._id,
            postId: post._id,
            postContent: (post.content || "").substring(0, 280),
            postAuthorId: author._id,
            postAuthorName: author.name,
            postAuthorUsername: author.username,
            likedAt: new Date(),
          }).catch(() => {});
        }
      } catch (_) {}
    }
    await Post.updateOne({ _id: post._id }, { $set: { likesCount: likers.length } });

    for (const commenter of commenters) {
      const text = pick(COMMENT_TEMPLATES);
      try {
        const comment = await Comment.create({
          postId: post._id,
          authorId: commenter._id,
          content: text,
          likesCount: Math.floor(Math.random() * 5),
          repliesCount: 0,
        });
        comments += 1;
        if (author) {
          await UserCommentedPost.create({
            userId: commenter._id,
            postId: post._id,
            commentId: comment._id,
            postContent: (post.content || "").substring(0, 280),
            commentContent: text,
            postAuthorId: author._id,
            postAuthorName: author.name,
            postAuthorUsername: author.username,
            commentedAt: new Date(),
          }).catch(() => {});
        }
      } catch (_) {}
    }
    await Post.updateOne({ _id: post._id }, { $set: { commentsCount: commenters.length } });

    let shareCount = 0;
    for (const sharer of sharers) {
      const targets = pickN(
        others.filter((u) => String(u._id) !== String(sharer._id)),
        Math.min(2, users.length - 2)
      );
      for (const target of targets) {
        if (!target?.username) continue;
        try {
          await Share.create({
            postId: post._id,
            sharedById: sharer._id,
            sharedWithId: target._id,
            message: pick(SHARE_MESSAGES),
            status: "pending",
          });
          shares += 1;
          shareCount += 1;
        } catch (_) {}
      }
    }
    await Post.updateOne({ _id: post._id }, { $set: { sharesCount: shareCount } });

    for (const reposter of reposters) {
      try {
        await Repost.create({ postId: post._id, userId: reposter._id });
        reposts += 1;
      } catch (_) {}
    }
    await Post.updateOne({ _id: post._id }, { $set: { repostsCount: reposters.length } });
  }

  console.log(`✅ Likes: ${likes}, Comments: ${comments}, Shares: ${shares}, Reposts: ${reposts}`);
}

async function main() {
  if (!MONGO_URI) {
    console.error("❌ Set MONGODB_URI in Backend/.env");
    process.exit(1);
  }

  console.log("🌱 CampusBuzz seed — all departments, Pakistani names, full engagements");
  const y0 = ADMISSION_YEAR_CODES[0];
  const y1 = ADMISSION_YEAR_CODES[ADMISSION_YEAR_CODES.length - 1];
  console.log(
    `   Users/dept: ${usersPerDept} | Posts/user: ${postsPerUser} | Media: ${Math.round(mediaRatio * 100)}% | Admission years: 20${y0}–20${y1} (${ADMISSION_YEAR_CODES.length} cohorts)`
  );

  await initFirebase();
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  const departments = getAllDepartmentConfigs();
  const users = await seedUsers(departments);
  if (!users.length) {
    console.error("❌ No users created. Aborting.");
    process.exit(1);
  }

  const posts = await seedPosts(users);
  await seedFollows(users);
  await seedEngagements(users, posts);

  console.log("\n🎉 Seed complete!");
  console.log(`   Login with any email from ${CREDENTIALS_PATH}`);
  console.log("   Password pattern: firstname+lastname+123! (e.g. ahmedkhan123!)");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
