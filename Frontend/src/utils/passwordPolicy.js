export function validatePasswordStrength(password) {
  const p = String(password || '');
  if (p.length < 8) return 'Password must be at least 8 characters.';
  if (/\s/.test(p)) return 'Password must not contain spaces.';
  if (!/[A-Z]/.test(p)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(p)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(p)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Password must include at least one special character.';
  return '';
}
