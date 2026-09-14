import admin from '../firebaseAdmin/firebaseAdmin.js';
import { User } from '../database/index.js';
import { validatePasswordStrength } from '../utils/passwordPolicy.js';
import {
  verifyAdminPassword,
  updateAdminPasswordHash,
} from '../utils/adminPassword.js';
import { verifyAdminPin } from '../utils/adminPin.js';

/**
 * GET /api/admin/profile
 */
export const getAdminProfile = async (req, res) => {
  try {
    const email = req.admin?.email;
    const uid = req.admin?.uid;
    if (!email) {
      return res.status(401).json({ success: false, error: 'Admin session required' });
    }

    const user = uid
      ? await User.findOne({ firebaseId: uid }).select('name username profilePhoto email').lean()
      : await User.findOne({ email }).select('name username profilePhoto email').lean();

    return res.json({
      success: true,
      profile: {
        email,
        name: user?.name || 'Administrator',
        username: user?.username || null,
        profilePhoto: user?.profilePhoto || null,
      },
    });
  } catch (err) {
    console.error('getAdminProfile error:', err);
    return res.status(500).json({ success: false, error: 'Failed to load profile' });
  }
};

/**
 * POST /api/admin/profile/change-password
 * Body: { currentPassword, newPassword, confirmPassword, pin }
 */
export const changeAdminPassword = async (req, res) => {
  try {
    const email = req.admin?.email;
    const uid = req.admin?.uid;
    if (!email || !uid) {
      return res.status(401).json({ success: false, error: 'Admin session required' });
    }

    const { currentPassword, newPassword, confirmPassword, pin } = req.body || {};

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password, new password, and confirmation are required.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password and confirmation do not match.',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from the current password.',
      });
    }

    const policyError = validatePasswordStrength(newPassword);
    if (policyError) {
      return res.status(400).json({ success: false, error: policyError });
    }

    const currentOk = await verifyAdminPassword(email, currentPassword);
    if (!currentOk) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect.' });
    }

    // Verify PIN for password change
    if (!pin) {
      return res.status(400).json({
        success: false,
        error: 'PIN is required to change password.',
        requirePin: true,
      });
    }

    const pinValid = await verifyAdminPin(email, pin);
    if (!pinValid) {
      return res.status(401).json({
        success: false,
        error: 'Incorrect PIN.',
        requirePin: true,
      });
    }

    await updateAdminPasswordHash(email, newPassword);

    try {
      await admin.auth().updateUser(uid, { password: newPassword });
    } catch (firebaseErr) {
      console.error('Firebase password update failed:', firebaseErr.message);
      return res.status(500).json({
        success: false,
        error: 'Password was saved but Firebase update failed. Contact support.',
      });
    }

    return res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    console.error('changeAdminPassword error:', err);
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
};
