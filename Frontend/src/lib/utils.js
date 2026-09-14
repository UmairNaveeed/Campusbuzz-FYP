import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Password validation (same rules as SignUp): 8+ chars, upper, lower, number, special, no spaces */
export function validatePasswordStrength(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (/\s/.test(password)) return 'Password must not contain spaces.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter (A-Z).';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter (a-z).';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number (0-9).';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
  return '';
}

/** Username validation (same rules as backend): 3–30 chars, letters, numbers, underscores, dots only */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') return { valid: false, error: 'Username is required' };
  const trimmed = username.trim().replace(/^@+/, '');
  if (trimmed.length < 3) return { valid: false, error: 'Username must be at least 3 characters' };
  if (trimmed.length > 30) return { valid: false, error: 'Username must be at most 30 characters' };
  if (!/^[a-zA-Z0-9_.]+$/.test(trimmed)) return { valid: false, error: 'Username can only contain letters, numbers, underscores, and dots' };
  return { valid: true, value: trimmed };
}
