/**
 * Procedural unique post text (280 char max). Each index yields a different sentence.
 */

const OPENINGS = [
  "Honestly", "Quick update:", "Small win today —", "Can we talk about how",
  "Just realized", "Plot twist:", "Main Block today:", "Library session:",
  "Between classes,", "Friday mood:", "Semester week", "Campus today —",
  "Prof said something interesting:", "Group chat is wild about",
  "Finally", "Still processing", "Hot take:", "Reminder for batchmates:",
  "Late night thought:", "Morning lecture had me thinking about",
];

const ACTIONS = [
  "finished the lab write-up", "survived a pop quiz", "found seats in the library",
  "submitted the assignment", "revised chapter notes", "joined a study circle",
  "fixed my timetable clash", "attended the society meetup", "presented our slides",
  "cleared the midterm prep list", "met the project supervisor", "uploaded the report",
  "practiced for the viva", "sorted hostel WiFi", "picked electives carefully",
  "mapped out the semester plan", "helped a junior with registration",
  "watched the alumni talk", "volunteered at the dept event", "rehearsed the demo",
];

const CONTEXTS = [
  "before the deadline.", "and it actually went well.", "— worth the effort.",
  "with the squad.", "without coffee somehow.", "in the girls block lounge.",
  "near cafeteria row.", "after a long commute.", "despite the heat.",
  "Alhamdulillah.", "InshaAllah finals go smooth.", "Need sleep now.",
  "Who else relates?", "Drop tips in replies.", "DM me if you want notes.",
];

const COURSE_LINES = [
  "Registered for {n} courses — schedule is packed but manageable.",
  "Course outline for {subject} looks intense this term.",
  "Swapped an elective; down to {n} courses now.",
  "Anyone in {subject} — which instructor is better?",
  "Course registration line at admin was long today.",
  "My {n}-course load needs better time blocking.",
  "Dropped one module; {n} courses left for the semester.",
  "Tutorial for {subject} moved to Friday morning.",
  "Course project groups forming — still need one member.",
  "Reviewed syllabi: {subject} has the heaviest readings.",
];

const SUBJECTS = [
  "Applied Linguistics", "English Literature", "Software Engineering", "Data Science",
  "Business Admin", "Graphic Design", "Psychology", "Mass Communication",
  "Accounting", "Interior Design", "Political Science", "Clinical Psychology",
  "Economics", "Textile Design", "Computer Science", "Islamic Studies",
];

const TAGS = [
  "gift", "study", "exams", "courses", "campusbuzz", "coding", "career",
  "relief", "campus", "lecture", "project", "library",
];

const EXTRA_TOPICS = [
  "courses", "lecture", "assignment", "semester", "registration", "elective",
  "syllabus", "tutorial", "midterm", "presentation",
];

function hashIndex(a, b = 0) {
  const s = `${a}:${b}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * @param {number} globalIndex — unique per post in DB
 * @param {{ department?: string, userId?: string }} meta
 */
export function generateUniquePostContent(globalIndex, meta = {}) {
  const dept = meta.department || "";
  const h = hashIndex(globalIndex, meta.userId || dept);

  if (h % 5 === 0) {
    const line = COURSE_LINES[h % COURSE_LINES.length]
      .replace("{n}", String((h % 4) + 3))
      .replace("{subject}", SUBJECTS[h % SUBJECTS.length]);
    const suffix = h % 3 === 0 ? ` #${TAGS[h % TAGS.length]}` : "";
    return `${line}${suffix}`.slice(0, 280);
  }

  const o = OPENINGS[h % OPENINGS.length];
  const a = ACTIONS[(h >> 4) % ACTIONS.length];
  const c = CONTEXTS[(h >> 8) % CONTEXTS.length];
  const topic = EXTRA_TOPICS[(h >> 3) % EXTRA_TOPICS.length];
  const variant = h % 4;

  let text;
  if (variant === 0) {
    text = `${o} ${a} ${c}`;
  } else if (variant === 1) {
    text = `${o} our ${topic} session ${c}`;
  } else if (variant === 2) {
    text = `${o} ${a} for ${topic} ${c}`;
  } else {
    text = `${o} thinking about ${topic} this week — ${a}.`;
  }

  if (h % 2 === 0) text += ` #${TAGS[(h >> 2) % TAGS.length]}`;

  return text.replace(/\s+/g, " ").trim().slice(0, 280);
}
