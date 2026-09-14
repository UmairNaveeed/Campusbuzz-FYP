import admin from '../firebaseAdmin/firebaseAdmin.js';
import { User } from '../database/index.js';

export const SUSPENDED_LOGIN_MESSAGE =
  'Your account has been suspended. Contact campus administration if you need help.';

/**
 * Find user by email and/or username (case-insensitive).
 */
export async function findUserForLogin({ email, username }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedUsername = String(username || '').trim().replace(/^@+/, '');

  if (normalizedEmail) {
    const byEmail = await User.findOne({ email: normalizedEmail }).lean();
    if (byEmail) return byEmail;
  }

  if (normalizedUsername) {
    const escaped = normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const byUsername = await User.findOne({
      username: { $regex: new RegExp(`^${escaped}$`, 'i') },
    }).lean();
    if (byUsername) return byUsername;
  }

  return null;
}

/**
 * True if Mongo says suspended or Firebase Auth user is disabled.
 */
export async function isAccountSuspended(user) {
  if (!user) return false;
  if (user.accountStatus === 'suspended') return true;

  if (user.firebaseId) {
    try {
      const fbUser = await admin.auth().getUser(user.firebaseId);
      if (fbUser.disabled) return true;
    } catch (err) {
      if (err.code === 'auth/user-not-found') return false;
      console.warn('[isAccountSuspended] Firebase lookup failed:', err.message);
    }
  }

  return false;
}

export async function getLoginSuspensionStatus({ email, username }) {
  const user = await findUserForLogin({ email, username });
  if (!user) {
    return { exists: false, suspended: false, user: null };
  }
  const suspended = await isAccountSuspended(user);
  return { exists: true, suspended, user };
}
