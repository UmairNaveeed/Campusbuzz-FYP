import admin from '../firebaseAdmin/firebaseAdmin.js';
import { isAdminEmail } from '../utils/adminConfig.js';

/**
 * Requires valid Firebase token from an admin email (use after verifyFirebaseToken).
 */
export async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    let email = ((decoded.adminEmail || decoded.email || decoded.uid || '') + '').trim().toLowerCase();

    if (email.startsWith('admin:')) {
      email = email.slice('admin:'.length);
    }

    if (!isAdminEmail(email)) {
      return res.status(403).json({ success: false, error: 'Not an administrator.' });
    }
    req.admin = { email, uid: decoded.uid };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}
