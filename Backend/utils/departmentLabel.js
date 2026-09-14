/**
 * Canonical degree/department labels (strip block, after-14-years, etc.).
 */

/** Remove suffixes after the degree name for storage and display. */
export function normalizeDepartmentName(department) {
  if (!department || typeof department !== "string") return "";
  let d = department.trim();

  d = d.replace(/\s*\(After\s+14\s+years\s+edu\)\s*/gi, " ");
  d = d.replace(/\s*-\s*\(After\s+14\s+years\s+edu\)\s*/gi, " ");

  d = d.replace(/\s*-\s*Girls\s+Block\s*(\(Only\s+for\s+Females\))?/gi, "");
  d = d.replace(/\s*\(Only\s+for\s+Females\)\s*/gi, "");

  d = d.replace(/\s*-\s*Main\s+Block\s*/gi, " ");
  d = d.replace(/\s+at\s+Main\s+Block\s*/gi, " ");

  d = d.replace(/^B\.\s*Ed\.\s*-\s*/i, "B.Ed. ");

  d = d.replace(/\s+/g, " ").trim();
  d = d.replace(/\s+-\s*$/g, "").trim();

  return d;
}

/** @alias normalizeDepartmentName */
export function formatDepartmentLabel(department) {
  return normalizeDepartmentName(department);
}

/** Unique canonical program names for analytics bucket matching. */
export function uniqueProgramList(programs) {
  const out = [];
  const seen = new Set();
  for (const p of programs || []) {
    const n = normalizeDepartmentName(p);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}
