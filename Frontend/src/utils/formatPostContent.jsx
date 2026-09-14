import { Link } from 'react-router-dom';

const TOKEN_REGEX = /(#(?:[\w_]+)|@(?:[\w_]+))/g;

function stripTrailingPunctuation(value) {
  return value.replace(/[.,!?;:]+$/g, '');
}

export function normalizeHashtagName(token) {
  if (!token) return '';
  return String(token).replace(/^#+/, '').trim().toLowerCase();
}

export function extractHashtagNamesFromText(text) {
  const matches = String(text || '').match(/#([A-Za-z0-9_]+)/g) || [];
  return matches.map((tag) => normalizeHashtagName(tag)).filter(Boolean);
}

export function filterHashtagsNotInText(text, hashtags) {
  const existing = new Set(extractHashtagNamesFromText(text));
  const visible = [];
  const seen = new Set();

  (hashtags || []).forEach((tag) => {
    const normalized = normalizeHashtagName(tag);
    if (!normalized) return;
    if (existing.has(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    visible.push(normalized);
  });

  return visible;
}

export function parseMentionUsername(token) {
  if (!token?.startsWith('@')) return '';
  return stripTrailingPunctuation(token.slice(1).replace(/^@+/, ''));
}

export function parseHashtagName(token) {
  if (!token?.startsWith('#')) return '';
  return stripTrailingPunctuation(token.slice(1).replace(/^#+/, ''));
}

/**
 * Renders post/comment text with clickable @mentions and #hashtags.
 */
export function formatPostContent(text, options = {}) {
  if (!text) return null;

  const {
    mentionClassName = 'text-[#6D28D9] font-medium cursor-pointer hover:underline',
    hashtagClassName = 'text-[#6D28D9] font-medium cursor-pointer hover:underline',
    onMentionClick,
    onHashtagClick,
  } = options;

  const parts = text.split(TOKEN_REGEX);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('#')) {
      const tag = parseHashtagName(part);
      if (!tag) return <span key={index}>{part}</span>;

      if (onHashtagClick) {
        return (
          <span
            key={index}
            role="link"
            tabIndex={0}
            className={hashtagClassName}
            onClick={(e) => {
              e.stopPropagation();
              onHashtagClick(tag);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onHashtagClick(tag);
              }
            }}
          >
            {part}
          </span>
        );
      }

      return (
        <Link
          key={index}
          to={`/hashtag/${encodeURIComponent(tag)}`}
          className={hashtagClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }

    if (part.startsWith('@')) {
      const username = parseMentionUsername(part);
      if (!username) return <span key={index}>{part}</span>;

      if (onMentionClick) {
        return (
          <span
            key={index}
            role="link"
            tabIndex={0}
            className={mentionClassName}
            onClick={(e) => {
              e.stopPropagation();
              onMentionClick(username);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onMentionClick(username);
              }
            }}
          >
            {part}
          </span>
        );
      }

      return (
        <Link
          key={index}
          to={`/user/${encodeURIComponent(username)}`}
          className={mentionClassName}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      );
    }

    return <span key={index}>{part}</span>;
  });
}
