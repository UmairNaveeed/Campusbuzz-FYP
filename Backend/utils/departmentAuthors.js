import { User } from "../database/index.js";
import { getBucketByDepartmentId } from "./giftSchools.js";
import { uniqueProgramList } from "./departmentLabel.js";

/** User _ids whose `department` is in the analytics bucket programs list. */
export async function getAuthorIdsForDepartment(departmentId) {
  const resolved = getBucketByDepartmentId(departmentId);
  if (!resolved) return null;
  const programs = uniqueProgramList(resolved.department.programs);
  const users = await User.find({ department: { $in: programs } })
    .select("_id")
    .lean();
  return users.map((u) => u._id);
}
