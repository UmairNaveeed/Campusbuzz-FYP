/**
 * Rename BS Accounting and Finance (After 14 years edu) → BS Accounting and Finance
 * Run: node scripts/normalizeBsAccountingDepartment.js
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "../database/index.js";
import { formatDepartmentLabel } from "../utils/departmentLabel.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const OLD = "BS Accounting and Finance (After 14 years edu)";
const NEW = "BS Accounting and Finance";

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI");
    process.exit(1);
  }
  await mongoose.connect(uri);

  const exact = await User.updateMany({ department: OLD }, { $set: { department: NEW } });
  console.log(`Exact match updated: ${exact.modifiedCount}`);

  const regex = await User.updateMany(
    { department: /BS Accounting and Finance.*After 14 years/i },
    [{ $set: { department: NEW } }]
  );
  console.log(`Regex match updated: ${regex.modifiedCount}`);

  const remaining = await User.countDocuments({
    department: /BS Accounting and Finance.*After 14 years/i,
  });
  console.log(`Remaining with suffix: ${remaining}`);
  console.log(`Canonical label: "${formatDepartmentLabel(OLD)}"`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
