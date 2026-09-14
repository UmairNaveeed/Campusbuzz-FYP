import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  // FR-3.1: Create Post
  createPost,
  
  // Update and Delete Post
  updatePost,
  updatePostVisibility,
  deletePost,
  
  // FR-3.2: Like/Unlike Post
  likePost,
  
  // FR-3.3 & FR-3.4: Comments & Replies
  createComment,
  getPostComments,
  getCommentReplies,
  likeComment,
  
  // FR-3.5: Hashtags
  getPostsByHashtag,
  getTrendingHashtags,
  searchHashtags,
  
  // FR-3.6: Mentions
  getPostsByMention,
  
  // FR-3.7: Report Post
  reportPost,
  
  // Existing endpoints
  getFeed,
  getFollowingFeed,
  getMyPosts,
  getPostsByUsername,
  getPostById,
  
  // User activity endpoints
  getUserLikedPosts,
  getUserCommentedPosts,
  getPostsAndReplies,
  
  // Share endpoints
  sharePost,
  getUserSharedPosts,
  getUserReceivedShares,
  
  // Repost endpoints
  repostPost,
  getUserReposts,
  
  // Media endpoint
  getUserMedia,
} from '../controllers/postController.js';
import {
  getTrendAnalyticsSchoolsMeta,
  getDepartmentTrendAnalytics,
  getSchoolTrendAnalytics,
  getMyDepartmentTrendAnalytics,
} from '../controllers/trendAnalyticsController.js';

const router = express.Router();

// ==================== IMPORTANT: Specific routes MUST come before parameterized routes ====================

// ==================== FR-3.1: CREATE POST ====================
// POST /api/posts
router.post('/', verifyFirebaseToken, createPost);

// ==================== EXISTING ROUTES (Specific paths first) ====================
// GET /api/posts/feed - Get home feed posts (all posts)
router.get('/feed', verifyFirebaseToken, getFeed);

// GET /api/posts/following - Get posts from users you follow
router.get('/following', verifyFirebaseToken, getFollowingFeed);

// GET /api/posts/my/liked - Get logged-in user's liked posts (must come before /my)
router.get('/my/liked', verifyFirebaseToken, getUserLikedPosts);

// GET /api/posts/my/commented - Get logged-in user's commented posts (must come before /my)
router.get('/my/commented', verifyFirebaseToken, getUserCommentedPosts);

// GET /api/posts/my/posts-and-replies - Get posts where user has commented (Posts & replies tab)
router.get('/my/posts-and-replies', verifyFirebaseToken, getPostsAndReplies);

// GET /api/posts/my/shared - Get logged-in user's shared posts
router.get('/my/shared', verifyFirebaseToken, getUserSharedPosts);

// GET /api/posts/my/received-shares - Get logged-in user's received shares
router.get('/my/received-shares', verifyFirebaseToken, getUserReceivedShares);

// GET /api/posts/my/reposts - Get logged-in user's reposted posts
router.get('/my/reposts', verifyFirebaseToken, getUserReposts);

// GET /api/posts/my/media - Get logged-in user's media (images)
router.get('/my/media', verifyFirebaseToken, getUserMedia);

// GET /api/posts/my - Get logged-in user's posts
router.get('/my', verifyFirebaseToken, getMyPosts);

// GET /api/posts/analytics/trends/schools — static school/department catalog (no DB; public)
router.get('/analytics/trends/schools', getTrendAnalyticsSchoolsMeta);
// GET /api/posts/analytics/trends/department?departmentId=sfada-fashion
router.get('/analytics/trends/department', verifyFirebaseToken, getDepartmentTrendAnalytics);
// GET /api/posts/analytics/trends/school?schoolId=SEAS
router.get('/analytics/trends/school', verifyFirebaseToken, getSchoolTrendAnalytics);
// GET /api/posts/analytics/trends/mine — logged-in user's department
router.get('/analytics/trends/mine', verifyFirebaseToken, getMyDepartmentTrendAnalytics);

// GET /api/posts/hashtags/trending - Get trending hashtags
router.get('/hashtags/trending', verifyFirebaseToken, getTrendingHashtags);
// GET /api/posts/hashtags/search - Search hashtags by query
router.get('/hashtags/search', verifyFirebaseToken, searchHashtags);

// GET /api/posts/comments/:commentId/replies - Get replies to a specific comment
router.get('/comments/:commentId/replies', verifyFirebaseToken, getCommentReplies);

// PUT /api/posts/comments/:commentId/like - Like/unlike a comment
router.put('/comments/:commentId/like', verifyFirebaseToken, likeComment);

// ==================== Routes with prefixes ====================
// GET /api/posts/user/:username - Get posts by username
router.get('/user/:username', verifyFirebaseToken, getPostsByUsername);

// GET /api/posts/hashtag/:hashtag - Get posts by hashtag
router.get('/hashtag/:hashtag', verifyFirebaseToken, getPostsByHashtag);

// GET /api/posts/mention/:username - Get posts mentioning a user
router.get('/mention/:username', verifyFirebaseToken, getPostsByMention);

// ==================== FR-3.3 & FR-3.4: COMMENTS & REPLIES (More specific routes first) ====================
// POST /api/posts/:postId/comments - Create a comment or reply
router.post('/:postId/comments', verifyFirebaseToken, createComment);

// GET /api/posts/:postId/comments - Get all comments for a post (with replies)
router.get('/:postId/comments', verifyFirebaseToken, getPostComments);

// ==================== FR-3.2: LIKE/UNLIKE POST (More specific route) ====================
// PUT /api/posts/:postId/like
router.put('/:postId/like', verifyFirebaseToken, likePost);

// ==================== UPDATE POST VISIBILITY ====================
// PATCH /api/posts/:postId/visibility - Set post to public or private (author only)
router.patch('/:postId/visibility', verifyFirebaseToken, updatePostVisibility);

// ==================== UPDATE POST ====================
// PUT /api/posts/:postId - Update a post (must come after more specific routes)
router.put('/:postId', verifyFirebaseToken, updatePost);

// ==================== DELETE POST ====================
// DELETE /api/posts/:postId - Delete a post
router.delete('/:postId', verifyFirebaseToken, deletePost);

// ==================== SHARE POST ====================
// POST /api/posts/:postId/share - Share post with another user
router.post('/:postId/share', verifyFirebaseToken, sharePost);

// ==================== REPOST POST ====================
// POST /api/posts/:postId/repost - Repost or unrepost a post
router.post('/:postId/repost', verifyFirebaseToken, repostPost);

// ==================== FR-3.7: REPORT POST ====================
// POST /api/posts/:postId/report - Report a post
router.post('/:postId/report', verifyFirebaseToken, reportPost);

// ==================== Get single post (MUST be last - catches any remaining :postId routes) ====================
// GET /api/posts/:postId - Get a single post by ID
router.get('/:postId', verifyFirebaseToken, getPostById);

export default router;
