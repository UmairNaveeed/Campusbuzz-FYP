/**
 * Orphan MongoDB users whose Firebase UID no longer exists in Firebase.
 * Run manually or via cron to keep MongoDB in sync with Firebase Auth.
 *
 * Usage (from Backend folder):
 *   node scripts/syncFirebaseMongoUsers.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function main() {
  if (!MONGO_URI) {
    console.error("❌ MONGO_URI not set in .env");
    process.exit(1);
  }

  const serviceAccountPath = path.join(__dirname, "..", "firebaseAdmin", "serviceAccountKey.json");
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  const { syncMongoUsersWithFirebase } = await import("../utils/syncFirebaseUsers.js");
  const { orphaned, checked } = await syncMongoUsersWithFirebase(admin.auth());

  console.log(`\n✅ Done. Checked ${checked} user(s), orphaned ${orphaned} not in Firebase.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
