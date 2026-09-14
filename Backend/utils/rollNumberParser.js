import { normalizeDepartmentName } from "./departmentLabel.js";

/**
 * Parse roll number from email and extract user information
 *
 * Roll number format (official from university administration):
 * - First 2 digits: session start year (e.g., 25 = 2025)
 * - 3rd digit: 1 = Fall, 2 = Spring
 * - 9-digit roll: 4th–5th digit = department code (2 digits)
 * - 11-digit roll: 4th–7th digit = department code (4 digits)
 * - Last 4 digits (right to left): student roll number
 */

/** Department code mapping from university administration (Programs with Roll Numbers) */
export const departmentCodeMap = {
  // 2-digit codes (9-digit roll numbers)
  "04": "B Des (Hons) Textile and Fashion",
  "18": "BCom (Hons)",
  "30": "AD Accounting and Finance",
  "35": "BS Accounting and Finance",
  "36": "BS Business Administration",
  "37": "BS Computer Science",
  "38": "AD Computer Science",
  "40": "BS Software Engineering",
  "46": "BS Home Economics (Food & Nutrition) - Girls Block",
  "50": "B Des (Hons) Graphic Design",
  "52": "BS Clinical Psychology - Main Block",
  "57": "BS Sociology - Main Block",
  "59": "BS Political Science",
  "61": "MPhil Management Sciences",
  "65": "AD Mass Communication and Media Studies",
  "67": "BS English",
  "68": "AD Economics",
  "69": "AD Psychology",
  "70": "AD Islamic Studies",
  "84": "AD Graphic Design",
  "85": "AD Textile and Fashion Design",
  "87": "BS Psychology - Main Block",
  "88": "BS Islamic Studies",
  "93": "BS Mass Communication and Media Studies",
  "94": "BS International Relations",
  "98": "BS Data Science",

  // 4-digit codes (11-digit roll numbers)
  "0109": "BS Clinical Psychology - Girls Block (Only for Females)",
  "0110": "BS Psychology - Girls Block (Only for Females)",
  "0119": "MPhil English",
  "0122": "MPhil Islamic Studies",
  "0123": "M Phil Economics",
  "0124": "MBA for Business Graduates (Morning)",
  "0127": "M Phil Applied Linguistics",
  "0129": "ADCP",
  "0133": "PhD Management Sciences",
  "0134": "MPhil Psychology",
  "0135": "M Phil Mass Communication and Media Studies",
  "0136": "BS English (After 14 years edu)",
  "0137": "BS Accounting and Finance",
  "0138": "BS Clinical Psychology - Main Block (After 14 years edu)",
  "0139": "BS Mass Communication and Media Studies (After 14 years edu)",
  "0140": "BCom (Hons) (After 14 years edu)",
  "0143": "BS Business Administration (After 14 years edu)",
  "0146": "BS Political Science (After 14 years edu)",
  "0148": "BS International Relations (After 14 years edu)",
  "0159": "BS Social Media",
  "0162": "BS Interior Design",
  "0163": "BS Home Economics Food and Nutrition at Main Block",
  "0164": "PhD Computer Science",
  "0165": "AD Management Sciences",
  "0167": "B.Ed.",
  "0168": "B.Ed. (1.5)",
  "0170": "B. Ed. - (After 14 years edu)",
  "0171": "AD Clinical Psychology",
  "0172": "AD Education",
  "0173": "AD Sociology",
  "0174": "AD Political Science",
  "0175": "AD International Relations",
  "0176": "BS Business Intelligence",
  "0183": "MS Clinical Psychology",
  "0184": "MPhil Education",
  "0191": "BS Data Analytics",
  "0192": "BS Mathematics and Artificial Intelligence",
  "0193": "BS Financial Technology",
  "0194": "BS Business Economics and Data Intelligence",
  "0195": "BS Islamic Banking and Digital Finance",
  "0196": "AD Business Innovation and Entrepreneurship",
  "0197": "PhD Psychology",
};

for (const key of Object.keys(departmentCodeMap)) {
  departmentCodeMap[key] = normalizeDepartmentName(departmentCodeMap[key]);
}

/** Build roll email from components (for seeding / testing). Year is 2-digit (e.g. 24 → 2024). */
export function buildRollEmail(yearCode, semesterCode, deptCode, studentNum) {
  const yy = String(yearCode).trim().replace(/\D/g, "");
  const yearPart = yy.length <= 2 ? yy.padStart(2, "0").slice(-2) : yy.slice(-2);
  const student = String(studentNum).padStart(4, "0");
  return `${yearPart}${semesterCode}${deptCode}${student}@gift.edu.pk`;
}

const FEMALE_ONLY_DEPT_CODES = new Set(["46", "0109", "0110"]);

/** All department configs for seeding. */
export function getAllDepartmentConfigs() {
  return Object.entries(departmentCodeMap).map(([code, name]) => ({
    code,
    name,
    rollLength: code.length === 2 ? 9 : 11,
    femaleOnly: FEMALE_ONLY_DEPT_CODES.has(code),
  }));
}

export function parseRollNumber(email) {
  const match = email.match(/^(\d{9,11})@gift\.edu\.pk$/i);
  if (!match) return null;

  const rollNumber = match[1];
  const len = rollNumber.length;

  // Only 9-digit or 11-digit roll numbers are valid
  if (len !== 9 && len !== 11) return null;

  // First 2 digits: start year (e.g., 25 = 2025)
  const startYear = 2000 + parseInt(rollNumber.substring(0, 2), 10);

  // 3rd digit: 1 = Fall, 2 = Spring
  const semesterCode = parseInt(rollNumber.substring(2, 3), 10);
  const startSemester = semesterCode === 1 ? "Fall" : semesterCode === 2 ? "Spring" : "Unknown";

  // Department code: 4th–5th for 9-digit, 4th–7th for 11-digit
  const departmentCode = len === 9 ? rollNumber.substring(3, 5) : rollNumber.substring(3, 7);

  // Last 4 digits: student roll number
  const studentRollNumber = rollNumber.slice(-4);

  const department =
    normalizeDepartmentName(departmentCodeMap[departmentCode] || "General Studies") ||
    "General Studies";

  // Determine program type and duration
  let program = "";
  let endYear = startYear + 4;

  if (department.startsWith("AD ")) {
    program = "Associate Degree";
    endYear = startYear + 2;
  } else if (department.startsWith("B. Ed.") || department.startsWith("B.Ed.")) {
    program = "Bachelor of Education";
    endYear = startYear + (department.includes("1.5") ? 1.5 : 4);
  } else if (department.startsWith("BCom")) {
    program = "Bachelor of Commerce";
    endYear = startYear + 4;
  } else if (department.startsWith("B Des")) {
    program = "Bachelor of Design";
    endYear = startYear + 4;
  } else if (department.startsWith("BS ")) {
    program = "Bachelor of Science";
    endYear = startYear + 4;
  } else if (department.startsWith("M Phil") || department.startsWith("MPhil")) {
    program = "Master of Philosophy";
    endYear = startYear + 2;
  } else if (department.startsWith("MBA")) {
    program = "Master of Business Administration";
    endYear = startYear + 2;
  } else if (department.startsWith("MS ")) {
    program = "Master of Science";
    endYear = startYear + 2;
  } else if (department.startsWith("PhD")) {
    program = "Doctor of Philosophy";
    endYear = startYear + 4;
  } else {
    program = "Bachelor's";
    endYear = startYear + 4;
  }

  return {
    rollNumber,
    studentRollNumber,
    startYear,
    startSemester,
    department,
    endYear: Math.floor(endYear),
    program,
  };
}
