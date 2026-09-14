/**
 * GIFT Trend Analytics — schools (SAAS) and department buckets.
 * Each `programs` entry must match User.department (canonical names, no block/after-14 suffixes).
 */

import { uniqueProgramList, normalizeDepartmentName } from "./departmentLabel.js";

const P = {
  textileB: "B Des (Hons) Textile and Fashion",
  textileAD: "AD Textile and Fashion Design",
  graphicB: "B Des (Hons) Graphic Design",
  graphicAD: "AD Graphic Design",
  interior: "BS Interior Design",
  bcom: "BCom (Hons)",
  adAcc: "AD Accounting and Finance",
  bsAcc: "BS Accounting and Finance",
  bsBiz: "BS Business Administration",
  adMgmt: "AD Management Sciences",
  mphilMgmt: "MPhil Management Sciences",
  phdMgmt: "PhD Management Sciences",
  mba: "MBA for Business Graduates (Morning)",
  adEconomics: "AD Economics",
  mPhilEco: "M Phil Economics",
  bsBusEco: "BS Business Economics and Data Intelligence",
  bsFinTech: "BS Financial Technology",
  bsIslamBank: "BS Islamic Banking and Digital Finance",
  adEntrepreneur: "AD Business Innovation and Entrepreneurship",
  bsBI: "BS Business Intelligence",
  adcp: "ADCP",
  bsCS: "BS Computer Science",
  adCS: "AD Computer Science",
  bsSE: "BS Software Engineering",
  bsDS: "BS Data Science",
  bsDA: "BS Data Analytics",
  bsMathAI: "BS Mathematics and Artificial Intelligence",
  phdCS: "PhD Computer Science",
  bsEng: "BS English",
  mphilEng: "MPhil English",
  mPhilAppLing: "M Phil Applied Linguistics",
  bsSocMed: "BS Social Media",
  bsMass: "BS Mass Communication and Media Studies",
  adMass: "AD Mass Communication and Media Studies",
  mPhilMass: "M Phil Mass Communication and Media Studies",
  bsSoc: "BS Sociology",
  adSoc: "AD Sociology",
  bsPoly: "BS Political Science",
  adPoly: "AD Political Science",
  bsIR: "BS International Relations",
  adIR: "AD International Relations",
  bsIslam: "BS Islamic Studies",
  adIslam: "AD Islamic Studies",
  mphilIslam: "MPhil Islamic Studies",
  bsPsych: "BS Psychology",
  bsClinP: "BS Clinical Psychology",
  adPsych: "AD Psychology",
  adClinP: "AD Clinical Psychology",
  mphilPsych: "MPhil Psychology",
  msClinPsych: "MS Clinical Psychology",
  phdPsych: "PhD Psychology",
  bed: "B.Ed.",
  bed15: "B.Ed. (1.5)",
  adEdu: "AD Education",
  mphilEdu: "MPhil Education",
  homeG: "BS Home Economics (Food & Nutrition)",
  homeM: "BS Home Economics Food and Nutrition",
};

export const TREND_ANALYTICS_SCHOOLS = [
  {
    id: "GBS",
    shortName: "GBS",
    fullName: "Gift Business School",
    description: "Commerce, accounting, finance, management & graduate business",
    departments: [
      {
        id: "gbs-accounting-finance",
        label: "Accounting & Finance",
        programs: uniqueProgramList([P.adAcc, P.bsAcc]),
      },
      {
        id: "gbs-commerce",
        label: "Commerce",
        programs: uniqueProgramList([P.bcom]),
      },
      {
        id: "gbs-business-admin",
        label: "Business Administration & Management",
        programs: uniqueProgramList([P.bsBiz, P.adMgmt, P.bsBI]),
      },
      {
        id: "gbs-mba-graduate",
        label: "MBA & Doctoral Management",
        programs: uniqueProgramList([P.mba, P.mphilMgmt, P.phdMgmt]),
      },
      {
        id: "gbs-economics-fintech",
        label: "Economics, FinTech & Islamic Finance",
        programs: uniqueProgramList([
          P.adEconomics,
          P.mPhilEco,
          P.bsBusEco,
          P.bsFinTech,
          P.bsIslamBank,
          P.adEntrepreneur,
        ]),
      },
      { id: "gbs-adcp", label: "Continuing Professional Education (ADCP)", programs: uniqueProgramList([P.adcp]) },
    ],
  },
  {
    id: "SEAS",
    shortName: "SEAS",
    fullName: "School of Engineering & Applied Sciences",
    description: "Computing, software, data science & emerging technology",
    departments: [
      {
        id: "seas-computer-science",
        label: "Computer Science",
        programs: uniqueProgramList([P.bsCS, P.adCS, P.phdCS]),
      },
      {
        id: "seas-software-engineering",
        label: "Software Engineering",
        programs: uniqueProgramList([P.bsSE]),
      },
      {
        id: "seas-data-ai",
        label: "Data Science, Analytics & AI",
        programs: uniqueProgramList([P.bsDS, P.bsDA, P.bsMathAI]),
      },
    ],
  },
  {
    id: "SAAS",
    shortName: "SAAS",
    fullName: "School of Arts & Social Sciences",
    description: "Humanities, social sciences, psychology, education & communication",
    departments: [
      {
        id: "saas-english-linguistics",
        label: "English & Linguistics",
        programs: uniqueProgramList([P.bsEng, P.mphilEng, P.mPhilAppLing]),
      },
      {
        id: "saas-psychology",
        label: "Psychology & Behavioral Sciences",
        programs: uniqueProgramList([
          P.bsPsych,
          P.bsClinP,
          P.adPsych,
          P.adClinP,
          P.mphilPsych,
          P.msClinPsych,
          P.phdPsych,
        ]),
      },
      {
        id: "saas-social-sciences",
        label: "Social Sciences & International Relations",
        programs: uniqueProgramList([P.bsSoc, P.adSoc, P.bsPoly, P.adPoly, P.bsIR, P.adIR]),
      },
      {
        id: "saas-mass-comm",
        label: "Mass Communication & Media",
        programs: uniqueProgramList([P.bsMass, P.adMass, P.mPhilMass, P.bsSocMed]),
      },
      {
        id: "saas-islamic-education",
        label: "Islamic Studies & Education",
        programs: uniqueProgramList([P.bsIslam, P.adIslam, P.mphilIslam, P.bed, P.bed15, P.adEdu, P.mphilEdu]),
      },
      {
        id: "saas-home-economics",
        label: "Home Economics & Community Sciences",
        programs: uniqueProgramList([P.homeG, P.homeM]),
      },
    ],
  },
  {
    id: "SFADA",
    shortName: "SFADA",
    fullName: "School of Fine Arts, Design & Architecture",
    description: "Fashion, graphic arts, interior & spatial design",
    departments: [
      {
        id: "sfada-fashion",
        label: "Fashion Designing",
        programs: uniqueProgramList([P.textileB, P.textileAD]),
      },
      {
        id: "sfada-graphic",
        label: "Graphic Design",
        programs: uniqueProgramList([P.graphicB, P.graphicAD]),
      },
      {
        id: "sfada-architecture",
        label: "Architecture",
        programs: uniqueProgramList([P.interior]),
      },
      {
        id: "sfada-interior",
        label: "Interior Design",
        programs: uniqueProgramList([P.interior]),
      },
      {
        id: "sfada-fine-arts",
        label: "Fine Arts",
        programs: uniqueProgramList([P.textileB, P.graphicB, P.textileAD, P.graphicAD, P.interior]),
      },
    ],
  },
];

export function getTrendAnalyticsMeta() {
  return TREND_ANALYTICS_SCHOOLS.map((s) => ({
    id: s.id,
    shortName: s.shortName,
    fullName: s.fullName,
    description: s.description,
    departments: s.departments.map((d) => ({
      id: d.id,
      label: d.label,
      programCount: d.programs.length,
    })),
  }));
}

export function getBucketByDepartmentId(departmentId) {
  if (!departmentId || typeof departmentId !== "string") return null;
  for (const school of TREND_ANALYTICS_SCHOOLS) {
    const dep = school.departments.find((d) => d.id === departmentId);
    if (dep) return { school, department: dep };
  }
  return null;
}

export function getSchoolById(schoolId) {
  if (!schoolId || typeof schoolId !== "string") return null;
  return TREND_ANALYTICS_SCHOOLS.find((s) => s.id === schoolId) || null;
}

/** All degree programs under a school (for school-wide trend aggregation). */
export function getProgramsForSchool(school) {
  if (!school?.departments?.length) return [];
  const merged = school.departments.flatMap((d) => d.programs || []);
  return uniqueProgramList(merged);
}

/** Map a user's stored degree/department string to an analytics bucket. */
export function resolveDepartmentBucketFromUserDepartment(userDepartment) {
  const normalized = normalizeDepartmentName(userDepartment);
  if (!normalized) return null;

  const lower = normalized.toLowerCase();

  for (const school of TREND_ANALYTICS_SCHOOLS) {
    for (const department of school.departments) {
      const programs = uniqueProgramList(department.programs || []);
      const labelNorm = normalizeDepartmentName(department.label).toLowerCase();

      if (labelNorm === lower || department.label.toLowerCase() === lower) {
        return { school, department };
      }

      if (programs.some((p) => p.toLowerCase() === lower)) {
        return { school, department };
      }

      if (
        labelNorm.length > 3 &&
        (lower.includes(labelNorm) || labelNorm.includes(lower))
      ) {
        return { school, department };
      }
    }
  }

  return null;
}
