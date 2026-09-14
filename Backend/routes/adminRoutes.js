import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  requestAdminLogin,
  verifyEmailToken,
  checkEmailVerified,
} from '../controllers/adminAuthController.js';
import {
  setupAdminPin,
  verifyAdminPinEndpoint,
  changeAdminPin,
  getPinStatus,
  requestPinReset,
  resetPinWithCode,
} from '../controllers/adminPinController.js';
import {
  getAdminProfile,
  changeAdminPassword,
} from '../controllers/adminProfileController.js';
import {
  listAdminUsers,
  listSuspendedAdminUsers,
  getAdminUserDetail,
  suspendAdminUser,
  unsuspendAdminUser,
  deleteAdminUser,
} from '../controllers/adminUserController.js';
import { getAdminDashboardStats } from '../controllers/adminDashboardController.js';
import { getAdminReport } from '../controllers/adminReportsController.js';
import {
  listReportedPosts,
  getReportedPostDetail,
  dismissPostReports,
  adminDeleteReportedPost,
} from '../controllers/adminPostModerationController.js';
import { getAdminSentimentOverview } from '../controllers/adminSentimentController.js';
import {
  listAlumniSignups,
  getAlumniSignupDetail,
  approveAlumniSignup,
  rejectAlumniSignup,
  downloadAlumniTranscript,
} from '../controllers/adminAlumniController.js';

const router = express.Router();

// ================= ADMIN AUTHENTICATION WITH EMAIL VERIFICATION =================

// Request login - sends verification email to admin
router.post('/login-request', requestAdminLogin);

// Verify email token from email link
router.post('/verify-email-token', verifyEmailToken);

// Check if email is verified (for frontend)
router.post('/check-email-verified', verifyFirebaseToken, requireAdmin, checkEmailVerified);

// ================= PIN MANAGEMENT =================

// Check if admin has set up PIN
router.get('/pin/status', verifyFirebaseToken, requireAdmin, getPinStatus);

// Set up PIN (first time)
router.post('/pin/setup', verifyFirebaseToken, requireAdmin, setupAdminPin);

// Verify PIN for sensitive actions
router.post('/pin/verify', verifyFirebaseToken, requireAdmin, verifyAdminPinEndpoint);

// Change PIN
router.post('/pin/change', verifyFirebaseToken, requireAdmin, changeAdminPin);

// Request PIN reset (sends code to email)
router.post('/pin/request-reset', verifyFirebaseToken, requireAdmin, requestPinReset);

// Reset PIN with code
router.post('/pin/reset-with-code', verifyFirebaseToken, requireAdmin, resetPinWithCode);

// ================= ADMIN PROFILE =================

router.get('/profile', verifyFirebaseToken, requireAdmin, getAdminProfile);

// Change password (requires PIN in request body)
router.post('/profile/change-password', verifyFirebaseToken, requireAdmin, changeAdminPassword);

// ================= ADMIN DASHBOARD =================

router.get('/stats', verifyFirebaseToken, requireAdmin, getAdminDashboardStats);
router.get('/reports', verifyFirebaseToken, requireAdmin, getAdminReport);

// ================= ADMIN USER MANAGEMENT =================

// List all users
router.get('/users', verifyFirebaseToken, requireAdmin, listAdminUsers);

// List suspended users
router.get('/users/suspended', verifyFirebaseToken, requireAdmin, listSuspendedAdminUsers);

// Get user details
router.get('/users/:userId', verifyFirebaseToken, requireAdmin, getAdminUserDetail);

// Suspend user (requires PIN in request body)
router.patch('/users/:userId/suspend', verifyFirebaseToken, requireAdmin, suspendAdminUser);

// Unsuspend user
router.patch('/users/:userId/unsuspend', verifyFirebaseToken, requireAdmin, unsuspendAdminUser);

// Delete user (requires PIN in request body)
router.delete('/users/:userId', verifyFirebaseToken, requireAdmin, deleteAdminUser);

// ================= ADMIN POST MODERATION =================

router.get('/posts/reported', verifyFirebaseToken, requireAdmin, listReportedPosts);
router.get('/posts/reported/:postId', verifyFirebaseToken, requireAdmin, getReportedPostDetail);
router.patch('/posts/reported/:postId/dismiss', verifyFirebaseToken, requireAdmin, dismissPostReports);
router.delete('/posts/reported/:postId', verifyFirebaseToken, requireAdmin, adminDeleteReportedPost);

// ================= ADMIN SENTIMENT ANALYSIS =================

router.get('/sentiment/overview', verifyFirebaseToken, requireAdmin, getAdminSentimentOverview);

// ================= ADMIN ALUMNI SIGNUPS =================
router.get('/alumni-signups', verifyFirebaseToken, requireAdmin, listAlumniSignups);
router.get('/alumni-signups/:id', verifyFirebaseToken, requireAdmin, getAlumniSignupDetail);
router.get('/alumni-signups/:id/transcript', verifyFirebaseToken, requireAdmin, downloadAlumniTranscript);
router.patch('/alumni-signups/:id/approve', verifyFirebaseToken, requireAdmin, approveAlumniSignup);
router.patch('/alumni-signups/:id/reject', verifyFirebaseToken, requireAdmin, rejectAlumniSignup);

export default router;
