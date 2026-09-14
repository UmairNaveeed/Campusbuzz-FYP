/** Characters allowed immediately before an @ or # trigger. */
const TRIGGER_BOUNDARY = new Set(['', ' ', '\n', '\t', '(', '[', '@', '#']);

function getTriggerContext(value, selectionStart, trigger) {
  const textBefore = value.slice(0, selectionStart);
  const lastIndex = textBefore.lastIndexOf(trigger);
  if (lastIndex === -1) return null;

  let startIndex = lastIndex;
  while (startIndex > 0 && textBefore[startIndex - 1] === trigger) {
    startIndex -= 1;
  }

  const charBefore = startIndex === 0 ? '' : textBefore[startIndex - 1];
  if (!TRIGGER_BOUNDARY.has(charBefore)) {
    return null;
  }

  const query = textBefore.slice(lastIndex + 1);
  if (/\s/.test(query)) {
    return null;
  }

  return { startIndex, query };
}

/**
 * Returns mention autocomplete context while the cursor is inside an
 * unfinished @username (no whitespace between @ and cursor).
 * Supports `@@` by treating the last @ as the active mention.
 */
export function getMentionContext(value, selectionStart) {
  return getTriggerContext(value, selectionStart, '@');
}

/**
 * Same rules as mentions, for hashtag autocomplete while typing.
 */
export function getHashtagContext(value, selectionStart) {
  return getTriggerContext(value, selectionStart, '#');
}
