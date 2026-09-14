import crypto from 'crypto';
import { promisify } from 'util';
import { AdminCredential } from '../database/index.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LEN = 64;

/**
 * Hash a PIN using scrypt (same as password hashing)
 */
export async function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(pin, salt, KEY_LEN);
  return `${salt}:${derived.toString('hex')}`;
}

/**
 * Verify a PIN against stored hash
 */
export async function verifyPin(pin, storedHash) {
  if (!storedHash || !String(storedHash).includes(':')) return false;
  const [salt, keyHex] = String(storedHash).split(':');
  if (!salt || !keyHex) return false;
  try {
    const derived = await scrypt(pin, salt, KEY_LEN);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (keyBuf.length !== derived.length) return false;
    return crypto.timingSafeEqual(keyBuf, derived);
  } catch {
    return false;
  }
}

/**
 * Validate PIN format (4-6 digits)
 */
export function validatePinFormat(pin) {
  if (!pin || typeof pin !== 'string') {
    return { valid: false, error: 'PIN is required' };
  }
  const trimmed = pin.trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { valid: false, error: 'PIN must be 4-6 digits' };
  }
  return { valid: true };
}

/**
 * Set or update admin PIN
 */
export async function setAdminPin(email, pin) {
  const normalized = String(email || '').trim().toLowerCase();
  const pinHash = await hashPin(pin);
  await AdminCredential.findOneAndUpdate(
    { email: normalized },
    { pinHash, updatedAt: new Date() },
    { new: true }
  );
}

/**
 * Verify admin PIN
 */
export async function verifyAdminPin(email, pin) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = await AdminCredential.findOne({ email: normalized }).lean();
  if (!row?.pinHash) {
    return false;
  }
  return verifyPin(pin, row.pinHash);
}

/**
 * Check if admin has set up PIN
 */
export async function hasAdminPin(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = await AdminCredential.findOne({ email: normalized }).lean();
  return !!row?.pinHash;
}

/**
 * Generate a PIN reset code and store it (10 minutes expiry)
 */
export async function generatePinResetCode(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const resetCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const existing = await AdminCredential.findOne({ email: normalized }).lean();
  if (!existing) {
    console.error('[PIN RESET] generatePinResetCode failed: AdminCredential document missing', { email: normalized });
    throw new Error(`AdminCredential not found for email ${normalized}`);
  }

  const updated = await AdminCredential.findOneAndUpdate(
    { email: normalized },
    { pinResetCode: resetCode, pinResetCodeExpiresAt: expiresAt },
    { new: true }
  );

  console.log('[PIN RESET] generatePinResetCode', {
    email: normalized,
    generatedResetCode: resetCode,
    saved: !!updated,
    savedResetCode: updated?.pinResetCode,
    savedExpiresAt: updated?.pinResetCodeExpiresAt,
  });

  if (!updated) {
    throw new Error(`Failed to save PIN reset code for email ${normalized}`);
  }

  return resetCode;
}

/**
 * Verify PIN reset code
 */
export async function verifyPinResetCode(email, code) {
  const normalized = String(email || '').trim().toLowerCase();
  const enteredCode = String(code || '').trim().toUpperCase();
  const row = await AdminCredential.findOne({ email: normalized }).lean();

  const storedCode = row?.pinResetCode || null;
  const storedExpiresAt = row?.pinResetCodeExpiresAt ? new Date(row.pinResetCodeExpiresAt) : null;
  const now = new Date();
  const isCodeValid = storedCode === enteredCode;
  const isExpired = !storedExpiresAt || now >= storedExpiresAt;

  console.log('[PIN RESET] verifyPinResetCode', {
    email: normalized,
    enteredResetCode: enteredCode,
    storedResetCode: storedCode,
    storedExpiresAt,
    now,
    isCodeValid,
    isExpired,
    rowExists: !!row,
  });

  if (!row?.pinResetCode || !row?.pinResetCodeExpiresAt) {
    return false;
  }

  return isCodeValid && !isExpired;
}

/**
 * Clear PIN reset code
 */
export async function clearPinResetCode(email) {
  const normalized = String(email || '').trim().toLowerCase();
  await AdminCredential.findOneAndUpdate(
    { email: normalized },
    { pinResetCode: null, pinResetCodeExpiresAt: null },
    { new: true }
  );
}
