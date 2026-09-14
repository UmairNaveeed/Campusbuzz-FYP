/**
 * Create or update the Firebase admin user (email + password).
 * Run from Backend: node scripts/ensureAdminUser.js
 */
import admin from '../firebaseAdmin/firebaseAdmin.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'rubabilalbutt@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Ruba123!';

async function ensureAdminUser() {
  try {
    const existing = await admin.auth().getUserByEmail(ADMIN_EMAIL);
    await admin.auth().updateUser(existing.uid, {
      password: ADMIN_PASSWORD,
      emailVerified: true,
    });
    console.log(`Updated admin user: ${ADMIN_EMAIL} (uid: ${existing.uid})`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await admin.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        emailVerified: true,
        displayName: 'CampusBuzz Admin',
      });
      console.log(`Created admin user: ${ADMIN_EMAIL} (uid: ${created.uid})`);
      return;
    }
    throw err;
  }
}

ensureAdminUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to ensure admin user:', err.message);
    process.exit(1);
  });
