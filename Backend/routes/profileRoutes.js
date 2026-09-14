import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  getMyProfile,
  updateProfile,
  getUserProfile,
  getPublicUserProfile,
  searchUsers,
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getSuggestions,
  removeFollower
} from '../controllers/profileController.js';

const router = express.Router();

// Test route to verify router is working
router.get('/test', (req, res) => {
  res.json({ message: 'Profile routes are working!' });
});

// Logged-in user's profile
router.get('/me', verifyFirebaseToken, getMyProfile);

// Search users (MUST be before /:username route to avoid route conflicts)
router.get('/search', verifyFirebaseToken, (req, res, next) => {
  console.log('🔍 Search route hit! Query:', req.query);
  next();
}, searchUsers);

// Get user suggestions (MUST be before /:username route to avoid route conflicts)
router.get('/suggestions', verifyFirebaseToken, getSuggestions);

// Public preview route for logged-out profile access by username
router.get('/public/:username', getPublicUserProfile);

// Follow/Unfollow routes (must be before /:username to avoid conflicts)
router.post('/:username/follow', verifyFirebaseToken, followUser);
router.post('/:username/unfollow', verifyFirebaseToken, unfollowUser);
router.post('/:username/remove-follower', verifyFirebaseToken, (req, res, next) => {
  console.log('🗑️ Remove follower route hit! Username:', req.params.username);
  next();
}, removeFollower);

// Get followers and following lists (must be before /:username to avoid conflicts)
router.get('/:username/followers', verifyFirebaseToken, getFollowers);
router.get('/:username/following', verifyFirebaseToken, getFollowing);

// Get user profile by username (public route, but requires authentication)
// This must be LAST to avoid catching /search or /me routes
router.get('/:username', verifyFirebaseToken, getUserProfile);

// Update own profile
router.put('/update', verifyFirebaseToken, updateProfile);

export default router;
