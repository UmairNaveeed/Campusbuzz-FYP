/**
 * Discussion forum routes: groups only. Separate from messaging/chats (/api/messaging).
 * Group messages are stored with conversationId pointing to the group (Conversation with isGroup: true).
 */
import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  createGroup,
  listGroups,
  editGroup,
  deleteGroup,
  joinPublicGroup,
  inviteUserToGroup,
  removeGroupMember,
  leaveGroup,
  listGroupMembers,
  sendGroupMessage,
  getGroupMessages,
  deleteGroupMessage,
  searchUsersForInvite,
  getGroupInvitesSent,
  getMyGroupInvites,
  respondToGroupInvite,
  getGroupJoinRequests,
  respondToJoinRequest,
  respondToJoinRequestByUser,
  getForumMessageCount,
} from '../controllers/discussionController.js';

const router = express.Router();

// Groups
router.get('/groups', verifyFirebaseToken, listGroups);
router.get('/forum-message-count', verifyFirebaseToken, getForumMessageCount);
router.post('/groups', verifyFirebaseToken, createGroup);
router.patch('/groups/:groupId', verifyFirebaseToken, editGroup);
router.delete('/groups/:groupId', verifyFirebaseToken, deleteGroup);
router.post('/groups/:groupId/join', verifyFirebaseToken, joinPublicGroup);
router.get('/groups/:groupId/join-requests', verifyFirebaseToken, getGroupJoinRequests);
router.post('/groups/:groupId/join-requests/:requestId/respond', verifyFirebaseToken, respondToJoinRequest);
router.post('/groups/:groupId/join-requests/respond-by-user', verifyFirebaseToken, respondToJoinRequestByUser);
router.post('/groups/:groupId/invite', verifyFirebaseToken, inviteUserToGroup);
router.post('/groups/:groupId/remove-member', verifyFirebaseToken, removeGroupMember);
router.post('/groups/:groupId/leave', verifyFirebaseToken, leaveGroup);
router.get('/groups/:groupId/members', verifyFirebaseToken, listGroupMembers);
router.get('/groups/:groupId/invites-sent', verifyFirebaseToken, getGroupInvitesSent);
router.get('/groups/invites/my', verifyFirebaseToken, getMyGroupInvites);
router.post('/groups/invites/:inviteId/respond', verifyFirebaseToken, respondToGroupInvite);

// Messages
router.get('/groups/:groupId/messages', verifyFirebaseToken, getGroupMessages);
router.post('/groups/:groupId/messages', verifyFirebaseToken, sendGroupMessage);
router.delete('/groups/:groupId/messages/:messageId', verifyFirebaseToken, deleteGroupMessage);

// User search for invites
router.get('/users/search', verifyFirebaseToken, searchUsersForInvite);

export default router;
