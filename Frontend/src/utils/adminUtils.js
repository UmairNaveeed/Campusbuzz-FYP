const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'rubabilalbutt@gmail.com').trim().toLowerCase();

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || ADMIN_EMAIL)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}
