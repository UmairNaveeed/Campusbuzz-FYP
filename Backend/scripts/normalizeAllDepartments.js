/**
 * Normalize all User.department values (remove Main Block, After 14 years, etc.)
 * Run: node scripts/normalizeAllDepartments.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "../database/index.js";
import { normalizeDepartmentName } from "../utils/departmentLabel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const users = await User.find({ department: { $exists: true, $ne: null, $ne: "" } })
    .select("_id department")
    .lean();

  let updated = 0;
  for (const u of users) {
    const next = normalizeDepartmentName(u.department);
    if (next && next !== u.department) {
      await User.updateOne({ _id: u._id }, { $set: { department: next } });
      updated += 1;
    }
  }

  console.log(`Normalized ${updated} of ${users.length} user department fields.`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
