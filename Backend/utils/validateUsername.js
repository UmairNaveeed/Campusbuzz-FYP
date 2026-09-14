/**
 * Shared username validation (used by signup/username page and edit profile).
 * Rules: 3–30 chars, only letters, numbers, underscores, and dots.
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
  const trimmed = username.trim().replace(/^@+/, '');
  if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (trimmed.length > 30) return { valid: false, error: 'Username must be at most 30 characters' };
  if (!/^[a-zA-Z0-9_.]+$/.test(trimmed)) return { valid: false, error: 'Username can only contain letters, numbers, underscores, and dots' };
  return { valid: true, value: trimmed };
}
