/**
 * Match posts to a trend topic: #tag, bare word, or similar spelling.
 */

const STOPWORDS = new Set([
  "about", "after", "again", "also", "been", "being", "both", "campus", "come",
  "could", "does", "done", "from", "have", "here", "just", "like", "make",
  "more", "most", "much", "must", "only", "over", "some", "such", "than", "that",
  "their", "them", "then", "there", "these", "they", "this", "time", "very", "what",
  "when", "where", "which", "while", "will", "with", "would", "your", "week", "year",
  "today", "tomorrow", "alhamdulillah", "anyone", "else", "near", "main", "block",
]);

export function normalizeTopic(raw) {
  return String(raw || "")
    .replace(/^#/, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Levenshtein distance (small strings only). */
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = a[i - 1] === b[j - 1] ? row[j - 1] : Math.min(row[j], row[j - 1], prev) + 1;
      row[j - 1] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function wordsSimilar(a, b) {
  const x = normalizeTopic(a);
  const y = normalizeTopic(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4) {
    if (x.includes(y) || y.includes(x)) return true;
    const maxDist = Math.max(1, Math.floor(Math.min(x.length, y.length) * 0.28));
    if (levenshtein(x, y) <= maxDist) return true;
  }
  return false;
}

export function contentMatchesTopic(content, topic) {
  const t = normalizeTopic(topic);
  if (!t || !content) return false;
  const text = String(content);
  const lower = text.toLowerCase();

  if (lower.includes(`#${t}`)) return true;

  const hashTags = text.match(/#(\w+)/g) || [];
  for (const ht of hashTags) {
    if (wordsSimilar(ht.slice(1), t)) return true;
  }

  const words = lower.match(/\b[a-z0-9]{3,}\b/g) || [];
  for (const w of words) {
    if (wordsSimilar(w, t)) return true;
  }
  return false;
}

/** MongoDB $or clauses for Post.find content matching topic. */
export function buildTopicContentOrClauses(topic) {
  const t = normalizeTopic(topic);
  if (!t) return [];
  const esc = escapeRegex(t);
  const clauses = [
    { content: { $regex: `#${esc}\\b`, $options: "i" } },
    { content: { $regex: `\\b${esc}\\b`, $options: "i" } },
  ];
  if (t.length >= 4) {
    clauses.push({ content: { $regex: esc, $options: "i" } });
    clauses.push({ content: { $regex: `\\b${esc}\\w{0,4}\\b`, $options: "i" } });
  }
  return clauses;
}

export function extractHashtagsFromText(text) {
  const matches = String(text || "").match(/#(\w+)/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** Topics from one post (hashtags + significant words, once per post). */
export function topicsFromPostContent(content) {
  const found = new Set();
  for (const tag of extractHashtagsFromText(content)) {
    if (tag.length >= 2) found.add(tag);
  }
  const words = String(content || "").toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  for (const w of words) {
    if (!STOPWORDS.has(w)) found.add(w);
  }
  return [...found];
}
