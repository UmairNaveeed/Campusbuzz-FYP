import crypto from 'crypto';
import { promisify } from 'util';
import { AdminCredential } from '../database/index.js';
import { ADMIN_EMAILS } from './adminConfig.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LEN = 64;

export async function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(plain, salt, KEY_LEN);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(plain, storedHash) {
  if (!storedHash || !String(storedHash).includes(':')) return false;
  const [salt, keyHex] = String(storedHash).split(':');
  if (!salt || !keyHex) return false;
  try {
    const derived = await scrypt(plain, salt, KEY_LEN);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

export async function ensureAdminCredentials() {
  const defaultPassword = process.env.ADMIN_PASSWORD || 'Ruba123!';
  for (const email of ADMIN_EMAILS) {
    const normalized = email.toLowerCase();
    const exists = await AdminCredential.findOne({ email: normalized }).lean();
    if (!exists) {
      const passwordHash = await hashPassword(defaultPassword);
      await AdminCredential.create({ email: normalized, passwordHash });
      console.log(`[admin] Initialized password hash for ${normalized}`);
    }
  }
}

export async function verifyAdminPassword(email, password) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = await AdminCredential.findOne({ email: normalized }).lean();
  if (row?.passwordHash) {
    return verifyPassword(password, row.passwordHash);
  }
  const fallback = process.env.ADMIN_PASSWORD || 'Ruba123!';
  return password === fallback;
}

export async function updateAdminPasswordHash(email, newPassword) {
  const normalized = String(email || '').trim().toLowerCase();
  const passwordHash = await hashPassword(newPassword);
  await AdminCredential.findOneAndUpdate(
    { email: normalized },
    { passwordHash, updatedAt: new Date() },
    { upsert: true, new: true }
  );
}
