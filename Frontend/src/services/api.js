import axios from 'axios';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

/**
 * Axios base URL should be the API origin only (no `/api` suffix — every request path starts with `/api/...`).
 * If `VITE_API_URL` mistakenly ends with `/api`, strip it so calls don't become `/api/api/...`.
 */
function normalizeApiBase(url) {
  const fallback = 'http://localhost:5000';
  if (url == null || url === '') return fallback;
  let u = String(url).trim();
  if (!u) return fallback;
  u = u.replace(/\/+$/, '');
  if (u.endsWith('/api')) u = u.slice(0, -4).replace(/\/+$/, '') || fallback;
  return u || fallback;
}

const envApi = import.meta.env.VITE_API_URL;
const envTrimmed = envApi == null ? '' : String(envApi).trim();
/** Dev + no explicit URL → relative `/api/*` hits Vite proxy (see vite.config.js). Prod → default localhost. */
const API_URL =
  envTrimmed !== ''
    ? normalizeApiBase(envTrimmed)
    : import.meta.env.DEV
      ? ''
      : 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, refresh token once and retry so user doesn't disappear from frontend until they log out
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && auth.currentUser) {
      originalRequest._retry = true;
      try {
        const token = await auth.currentUser.getIdToken(true);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        // Token refresh failed; sign out so UI session state stays in sync
        try {
          await signOut(auth);
        } catch (_) {}
      }
    }

    return Promise.reject(error);
  }
);

/** Resolve username to email for login (no auth required). */
export const resolveUsernameToEmail = async (username) => {
  const response = await api.post('/api/auth/resolve-username', { username: String(username).trim() });
  return response.data;
};

/** Check if email/username belongs to a suspended account (before Firebase sign-in). */
export const checkAccountStatus = async ({ email, username } = {}) => {
  const response = await api.post('/api/auth/account-status', {
    ...(email ? { email: String(email).trim().toLowerCase() } : {}),
    ...(username ? { username: String(username).trim().replace(/^@+/, '') } : {}),
  });
  return response.data;
};

export const getPosts = async () => {
  const response = await api.get('/api/posts/feed');
  return response.data;
};

/** Get logged-in user's posts (same source as profile Posts tab). */
export const getMyPosts = async () => {
  const response = await api.get('/api/posts/my');
  return response.data;
};

/** Get posts by username (for profile pages). */
export const getPostsByUsername = async (username) => {
  if (!username) return { success: false, posts: [] };
  const response = await api.get(`/api/posts/user/${encodeURIComponent(username)}`);
  return response.data;
};

/** Get user's liked posts. */
export const getUserLikedPosts = async () => {
  const response = await api.get('/api/posts/my/liked');
  return response.data;
};

/** Get posts where user has commented (for Replies tab). */
export const getPostsAndReplies = async () => {
  const response = await api.get('/api/posts/my/posts-and-replies');
  return response.data;
};

/** Get user's media posts (posts with images/videos). */
export const getUserMedia = async () => {
  const response = await api.get('/api/posts/my/media');
  return response.data;
};

export const createPost = async (content, image = null) => {
  const response = await api.post('/api/posts', { content, image });
  return response.data;
};

/** Search users by username/name for @mentions (e.g. in CreatePost). */
export const searchUsersForMention = async (q) => {
  if (!q || !String(q).trim()) return { success: true, users: [] };
  const response = await api.get('/api/profile/search', { params: { q: String(q).trim() } });
  return response.data;
};

export const getAdminPinStatus = async () => {
  const response = await api.get('/api/admin/pin/status');
  return response.data;
};

/** Update post visibility (public / private). Author only. */
export const updatePostVisibility = async (postId, visibility) => {
  const response = await api.patch(`/api/posts/${postId}/visibility`, { visibility });
  return response.data;
};

/** Update a post (content and/or image). Author only. */
export const updatePost = async (postId, content, image = null) => {
  const payload = { content: String(content).trim() };
  if (image !== null) payload.image = image;
  const response = await api.put(`/api/posts/${postId}`, payload);
  return response.data;
};

/** Delete a post. Author only. */
export const deletePost = async (postId) => {
  const response = await api.delete(`/api/posts/${postId}`);
  return response.data;
};

// ================= MESSAGING API (CHATS ONLY) =================
// Direct messages / chats only. Separate from discussion forum (/api/discussion).
// Every message is stored with conversationId = its chat; use these for /messages UI only.

// Get all conversations (chats)
export const getConversations = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get('/api/messaging/conversations', { params });
  return response.data;
};

// Get count of conversations with unread messages (for sidebar badge)
export const getUnreadConversationsCount = async () => {
  const response = await api.get('/api/messaging/conversations/unread-count');
  return response.data;
};

// Get or create conversation by participant
export const getConversationByParticipant = async (participantId) => {
  const response = await api.get(`/api/messaging/conversations/participant/${participantId}`);
  return response.data;
};

// Get messages in a chat (conversationId = chat id)
export const getMessages = async (conversationId, page = 1, limit = 50) => {
  const response = await api.get(`/api/messaging/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });
  return response.data;
};

// Send message (stored with conversationId = chat id)
export const sendMessage = async (recipientId, content, media = null, link = null) => {
  const response = await api.post('/api/messaging/messages', {
    recipientId,
    content,
    media,
    link,
  });
  return response.data;
};

// Delete message
export const deleteMessage = async (messageId) => {
  const response = await api.delete(`/api/messaging/messages/${messageId}`);
  return response.data;
};

// Search messages in conversation
export const searchMessages = async (conversationId, query) => {
  const response = await api.get(`/api/messaging/conversations/${conversationId}/search`, {
    params: { query },
  });
  return response.data;
};

// React to message
export const reactToMessage = async (messageId, emoji) => {
  const response = await api.post(`/api/messaging/messages/${messageId}/react`, { emoji });
  return response.data;
};

// Report message
export const reportMessage = async (messageId, reason, description = '') => {
  const response = await api.post(`/api/messaging/messages/${messageId}/report`, {
    reason,
    description,
  });
  return response.data;
};

// Update delivery status
export const updateDeliveryStatus = async (messageId, status) => {
  const response = await api.patch(`/api/messaging/messages/${messageId}/status`, { status });
  return response.data;
};

// Star/unstar message
export const starMessage = async (messageId) => {
  const response = await api.post(`/api/messaging/messages/${messageId}/star`);
  return response.data;
};

// Get starred messages
export const getStarredMessages = async () => {
  const response = await api.get('/api/messaging/messages/starred');
  return response.data;
};

// Block/unblock user
export const blockUser = async (userId) => {
  const response = await api.post(`/api/messaging/users/${userId}/block`);
  return response.data;
};

// Accept message request
export const acceptMessageRequest = async (conversationId) => {
  const response = await api.post(`/api/messaging/conversations/${conversationId}/accept`);
  return response.data;
};

// Decline message request
export const declineMessageRequest = async (conversationId) => {
  const response = await api.post(`/api/messaging/conversations/${conversationId}/decline`);
  return response.data;
};

// Block user from message request
export const blockUserFromRequest = async (conversationId) => {
  const response = await api.post(`/api/messaging/conversations/${conversationId}/block`);
  return response.data;
};

// Clear chat history (delete all messages from user's view)
export const clearChatHistory = async (conversationId) => {
  const response = await api.post(`/api/messaging/conversations/${conversationId}/clear`);
  return response.data;
};

// Delete conversation (remove from user's chat list)
export const deleteConversation = async (conversationId) => {
  const response = await api.delete(`/api/messaging/conversations/${conversationId}`);
  return response.data;
};

// Get all blocked users
export const getBlockedUsers = async () => {
  const response = await api.get('/api/messaging/users/blocked');
  return response.data;
};

// ================= DISCUSSION FORUM API =================

export const getDiscussionGroups = async () => {
  const response = await api.get('/api/discussion/groups');
  return response.data;
};

export const getForumMessageCount = async () => {
  const response = await api.get('/api/discussion/forum-message-count');
  return response.data;
};

export const createDiscussionGroup = async ({ name, description = '', isPrivate = false, groupPhoto = null }) => {
  const response = await api.post('/api/discussion/groups', { name, description, isPrivate, groupPhoto });
  return response.data;
};

export const updateDiscussionGroup = async (groupId, payload) => {
  const response = await api.patch(`/api/discussion/groups/${groupId}`, payload);
  return response.data;
};

export const deleteDiscussionGroup = async (groupId) => {
  const response = await api.delete(`/api/discussion/groups/${groupId}`);
  return response.data;
};

export const joinDiscussionGroup = async (groupId) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/join`);
  return response.data;
};

export const getGroupJoinRequests = async (groupId) => {
  const response = await api.get(`/api/discussion/groups/${groupId}/join-requests`);
  return response.data;
};

export const respondToJoinRequest = async (groupId, requestId, action) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/join-requests/${requestId}/respond`, { action });
  return response.data;
};

export const respondToJoinRequestByUser = async (groupId, requesterUserId, action) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/join-requests/respond-by-user`, { userId: requesterUserId, action });
  return response.data;
};

export const inviteUserToDiscussionGroup = async (groupId, payload) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/invite`, payload);
  return response.data;
};

export const removeMemberFromDiscussionGroup = async (groupId, userId) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/remove-member`, { userId });
  return response.data;
};

export const leaveDiscussionGroup = async (groupId) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/leave`);
  return response.data;
};

export const getDiscussionGroupMembers = async (groupId) => {
  const response = await api.get(`/api/discussion/groups/${groupId}/members`);
  return response.data;
};

export const getDiscussionMessages = async (groupId, page = 1, limit = 50) => {
  const response = await api.get(`/api/discussion/groups/${groupId}/messages`, {
    params: { page, limit },
  });
  return response.data;
};

export const sendDiscussionMessage = async (groupId, payload) => {
  const response = await api.post(`/api/discussion/groups/${groupId}/messages`, payload);
  return response.data;
};

export const deleteDiscussionMessage = async (groupId, messageId) => {
  const response = await api.delete(`/api/discussion/groups/${groupId}/messages/${messageId}`);
  return response.data;
};

export const searchDiscussionUsers = async (q) => {
  const response = await api.get('/api/discussion/users/search', { params: { q } });
  return response.data;
};

export const getGroupInvitesSent = async (groupId) => {
  const response = await api.get(`/api/discussion/groups/${groupId}/invites-sent`);
  return response.data;
};

export const getMyDiscussionInvites = async () => {
  const response = await api.get('/api/discussion/groups/invites/my');
  return response.data;
};

export const respondDiscussionInvite = async (inviteId, action) => {
  const response = await api.post(`/api/discussion/groups/invites/${inviteId}/respond`, { action });
  return response.data;
};

// ================= TRENDING HASHTAGS =================

export const getTrendingHashtags = async (limit = 10) => {
  const response = await api.get('/api/posts/hashtags/trending', { params: { limit } });
  return response.data;
};

// ================= ADMIN: Alumni signups =================
export const getAlumniSignups = async (status = 'pending') => {
  const response = await api.get('/api/admin/alumni-signups', { params: { status } });
  return response.data;
};

export const getAlumniSignup = async (id) => {
  const response = await api.get(`/api/admin/alumni-signups/${id}`);
  return response.data;
};

export const approveAlumniSignup = async (id) => {
  const response = await api.patch(`/api/admin/alumni-signups/${id}/approve`);
  return response.data;
};

export const rejectAlumniSignup = async (id) => {
  const response = await api.patch(`/api/admin/alumni-signups/${id}/reject`);
  return response.data;
};

export const downloadAlumniTranscript = async (id) => {
  // return full axios response so caller can access headers (e.g., filename)
  const response = await api.get(`/api/admin/alumni-signups/${id}/transcript`, { responseType: 'blob' });
  return response;
};

/** GBS / SEAS / SAAS / SFADA schools and department buckets for trend analytics. */
export const getTrendAnalyticsSchoolsMeta = async () => {
  const response = await api.get('/api/posts/analytics/trends/schools');
  return response.data;
};

/** Per-department aggregates: topics, active users, top posts, monthly engagement. `departmentId` is a bucket id (e.g. sfada-fashion). */
export const getDepartmentTrendAnalytics = async (departmentId) => {
  const response = await api.get('/api/posts/analytics/trends/department', {
    params: { departmentId: String(departmentId).trim() },
  });
  return response.data;
};

/** School-wide trending topics (GBS, SEAS, SAAS, SFADA). */
export const getSchoolTrendAnalytics = async (schoolId) => {
  const response = await api.get('/api/posts/analytics/trends/school', {
    params: { schoolId: String(schoolId).trim() },
  });
  return response.data;
};

/** Trending topics for the logged-in user's department bucket. */
export const getMyDepartmentTrendAnalytics = async () => {
  const response = await api.get('/api/posts/analytics/trends/mine');
  return response.data;
};

/** Paginated follow suggestions (department/school aware). */
export const getFollowSuggestions = async ({ limit = 5, skip = 0 } = {}) => {
  const response = await api.get('/api/profile/suggestions', {
    params: { limit, skip },
  });
  return response.data;
};

/** Search hashtags by query (for autocomplete). */
export const searchHashtags = async (q) => {
  if (!q || !String(q).trim()) return { success: true, hashtags: [] };
  const response = await api.get('/api/posts/hashtags/search', { params: { q: String(q).trim() } });
  return response.data;
};

/** Posts for a trend topic; optional departmentId scopes to that dept's students. */
export const getPostsByHashtag = async (hashtag, { limit = 50, skip = 0, departmentId } = {}) => {
  const tag = String(hashtag || '').replace(/^#/, '').trim();
  const params = { limit, skip };
  if (departmentId) params.departmentId = String(departmentId).trim();
  const response = await api.get(`/api/posts/hashtag/${encodeURIComponent(tag)}`, { params });
  return response.data;
};

// ================= COMMENTS API =================

/** Create a comment or reply on a post. */
export const createComment = async (postId, content, parentCommentId = null) => {
  const payload = { content: String(content).trim() };
  if (parentCommentId) payload.parentCommentId = parentCommentId;
  const response = await api.post(`/api/posts/${postId}/comments`, payload);
  return response.data;
};

/** Get all comments for a post (with nested replies). */
export const getPostComments = async (postId, limit = 50, skip = 0) => {
  const response = await api.get(`/api/posts/${postId}/comments`, {
    params: { limit, skip },
  });
  return response.data;
};

/** Get replies to a specific comment. */
export const getCommentReplies = async (commentId, limit = 50, skip = 0) => {
  const response = await api.get(`/api/posts/comments/${commentId}/replies`, {
    params: { limit, skip },
  });
  return response.data;
};

/** Like or unlike a comment. */
export const likeComment = async (commentId) => {
  const response = await api.put(`/api/posts/comments/${commentId}/like`);
  return response.data;
};

// ================= NOTIFICATIONS API =================

export const getNotifications = async (params = {}) => {
  const response = await api.get('/api/notifications', { params });
  return response.data;
};

export const getUnreadNotificationsCount = async (scope = null) => {
  const params = scope ? { scope } : {};
  const response = await api.get('/api/notifications/unread-count', { params });
  return response.data;
};

export const getForumNotifications = async () => {
  const response = await api.get('/api/notifications', { params: { scope: 'forum' } });
  return response.data;
};

export const markNotificationAsRead = async (notificationId) => {
  const response = await api.patch(`/api/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async (scope = null) => {
  const response = await api.post('/api/notifications/mark-all-read', scope ? { scope } : {});
  return response.data;
};

export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/api/notifications/${notificationId}`);
  return response.data;
};

// ================= REPOST API =================

/** Repost or unrepost a post. */
export const repostPost = async (postId) => {
  const response = await api.post(`/api/posts/${postId}/repost`);
  return response.data;
};

/** Get user's reposted posts. */
export const getUserReposts = async () => {
  const response = await api.get('/api/posts/my/reposts');
  return response.data;
};

// ================= SHARE API =================

/** Share a post with a user. */
export const sharePost = async (postId, sharedWithUsername, message) => {
  const response = await api.post(`/api/posts/${postId}/share`, {
    sharedWithUsername,
    message: message || undefined,
  });
  return response.data;
};

// ================= CUSTOM LISTS API =================

/** Get all custom lists for the current user. */
export const getMyLists = async () => {
  const response = await api.get('/api/lists');
  return response.data;
};

/** Get a single list with member details. */
export const getListById = async (listId) => {
  const response = await api.get(`/api/lists/${encodeURIComponent(listId)}`);
  return response.data;
};

/** Create a custom list. */
export const createCustomList = async (name, description = '') => {
  const response = await api.post('/api/lists', { name, description });
  return response.data;
};

/** Update list name/description. */
export const updateCustomList = async (listId, payload) => {
  const response = await api.patch(`/api/lists/${encodeURIComponent(listId)}`, payload);
  return response.data;
};

/** Delete a custom list. */
export const deleteCustomList = async (listId) => {
  const response = await api.delete(`/api/lists/${encodeURIComponent(listId)}`);
  return response.data;
};

/** Add members to a list (by username or userId). */
export const addListMembers = async (listId, { usernames = [], userIds = [] } = {}) => {
  const response = await api.post(`/api/lists/${encodeURIComponent(listId)}/members`, {
    usernames,
    userIds,
  });
  return response.data;
};

/** Remove members from a list. */
export const removeListMembers = async (listId, { usernames = [], userIds = [] } = {}) => {
  const response = await api.delete(`/api/lists/${encodeURIComponent(listId)}/members`, {
    data: { usernames, userIds },
  });
  return response.data;
};

/** Get personalized feed for a list (posts from list members only). */
export const getListFeed = async (listId, { limit = 30, skip = 0 } = {}) => {
  const response = await api.get(`/api/lists/${encodeURIComponent(listId)}/feed`, {
    params: { limit, skip },
  });
  return response.data;
};

/** Get current user's following list. */
export const getMyFollowing = async () => {
  try {
    const response = await api.get('/api/profile/me');
    const profile = response.data?.user || response.data?.profile || response.data;
    if (!profile?.username) {
      console.error('Profile data:', response.data);
      throw new Error('User profile not found or username missing');
    }
    const followingResponse = await api.get(`/api/profile/${profile.username}/following`);
    return followingResponse.data;
  } catch (err) {
    console.error('Error in getMyFollowing:', err);
    throw err;
  }
};

/** Admin: dashboard stats, reports breakdown, sentiment summary. */
export const getAdminDashboardStats = async (startDate, endDate) => {
  const params = {};
  if (startDate && endDate) {
    params.startDate = startDate;
    params.endDate = endDate;
  }
  const response = await api.get('/api/admin/stats', { params });
  return response.data;
};

/** Admin: generate analytical report (live data). */
export const getAdminReport = async ({ type = 'user-activity', range = 'last-30-days', startDate, endDate } = {}) => {
  const params = { type, range };
  if (startDate && endDate) {
    params.startDate = startDate;
    params.endDate = endDate;
  }
  const response = await api.get('/api/admin/reports', { params });
  return response.data;
};

/** Admin: list all campus users (excludes admin accounts). */
export const getAdminUsers = async () => {
  const response = await api.get('/api/admin/users');
  return response.data;
};

/** Admin: user profile + posts. */
export const getAdminUserDetail = async (userId) => {
  const response = await api.get(`/api/admin/users/${encodeURIComponent(userId)}`);
  return response.data;
};

/** Admin: profile settings. */
export const getAdminProfile = async () => {
  const response = await api.get('/api/admin/profile');
  return response.data;
};

/** Admin: change password (hashed in DB + Firebase). */
export const changeAdminPassword = async ({ currentPassword, newPassword, confirmPassword, pin }) => {
  const response = await api.post('/api/admin/profile/change-password', {
    currentPassword,
    newPassword,
    confirmPassword,
    pin,
  });
  return response.data;
};

/** Admin: verify PIN for a future action. */
export const verifyAdminPin = async (pin) => {
  const response = await api.post('/api/admin/pin/verify', { pin });
  return response.data;
};

/** Admin: list suspended users only (optional server-side search). */
/** Report a post (student). */
export const reportPost = async (postId, reason, description = '') => {
  const response = await api.post(`/api/posts/${encodeURIComponent(postId)}/report`, {
    reason,
    description,
  });
  return response.data;
};

/** Admin: sentiment overview with % distribution. */
export const getAdminSentimentOverview = async ({ tab = 'posts', range = 'weekly', q = '', startDate, endDate } = {}) => {
  const params = {
    tab,
    range: String(range).toLowerCase(),
  };
  if (q) {
    params.q = String(q).trim();
  }
  if (startDate && endDate) {
    params.startDate = startDate;
    params.endDate = endDate;
  }
  const response = await api.get('/api/admin/sentiment/overview', { params });
  return response.data;
};

/** Admin: list posts with pending reports. */
export const getAdminReportedPosts = async (search = '') => {
  const q = String(search || '').trim();
  const response = await api.get('/api/admin/posts/reported', {
    params: q ? { q, status: 'pending' } : { status: 'pending' },
  });
  return response.data;
};

export const getAdminReportedPostDetail = async (postId) => {
  const response = await api.get(`/api/admin/posts/reported/${encodeURIComponent(postId)}`);
  return response.data;
};

export const dismissAdminReportedPost = async (postId) => {
  const response = await api.patch(`/api/admin/posts/reported/${encodeURIComponent(postId)}/dismiss`);
  return response.data;
};

export const deleteAdminReportedPost = async (postId) => {
  const response = await api.delete(`/api/admin/posts/reported/${encodeURIComponent(postId)}`);
  return response.data;
};

export const getAdminSuspendedUsers = async (search = '') => {
  const q = String(search || '').trim();
  const response = await api.get('/api/admin/users/suspended', {
    params: q ? { q } : {},
  });
  return response.data;
};

/** Admin: suspend a user account. */
export const suspendAdminUser = async (userId, pin, reason) => {
  const response = await api.patch(
    `/api/admin/users/${encodeURIComponent(userId)}/suspend`,
    { pin, reason }
  );
  return response.data;
};

/** Admin: restore a suspended user account. */
export const unsuspendAdminUser = async (userId) => {
  const response = await api.patch(`/api/admin/users/${encodeURIComponent(userId)}/unsuspend`);
  return response.data;
};

/** Admin: permanently delete a user and their data. */
export const deleteAdminUser = async (userId, pin, reason) => {
  const response = await api.delete(`/api/admin/users/${encodeURIComponent(userId)}`, {
    data: { pin, reason },
  });
  return response.data;
};

export default api;
