export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'rubabilalbutt@gmail.com').trim().toLowerCase();

export const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  : [ADMIN_EMAIL];

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}
