/** Post moderation only uses these two report reasons (see postController reportPost). */
export const POST_MODERATION_REASONS = [
  { key: 'hate_speech', label: 'Hate Speech' },
  { key: 'inappropriate_content', label: 'Inappropriate Content' },
];

export const POST_MODERATION_REASON_KEYS = POST_MODERATION_REASONS.map((r) => r.key);

export function postModerationBreakdown(reasonAggRows) {
  const counts = Object.fromEntries(
    (reasonAggRows || []).map((row) => [String(row._id), row.count])
  );
  return POST_MODERATION_REASONS.map(({ key, label }) => ({
    label,
    value: counts[key] || 0,
  }));
}
