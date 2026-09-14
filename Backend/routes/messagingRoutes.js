/**
 * Messaging routes: direct chats (DMs) only.
 * Separate from discussion forum (/api/discussion). All messages here are stored with
 * conversationId pointing to a chat (Conversation with isGroup: false).
 */
import express from 'express';
import verifyFirebaseToken from '../middleware/verifyFirebaseToken.js';
import {
  sendMessage,
  getMessages,
  getConversations,
  getUnreadConversationsCount,
  deleteMessage,
  searchMessages,
  reactToMessage,
  reportMessage,
  updateDeliveryStatus,
  starMessage,
  getStarredMessages,
  blockUser,
  getConversationByParticipant,
  acceptMessageRequest,
  declineMessageRequest,
  blockUserFromRequest,
  deleteConversation,
  clearChatHistory,
  getBlockedUsers,
} from '../controllers/messagingController.js';

const router = express.Router();

// All routes require authentication
router.use(verifyFirebaseToken);

// Send message (stored with conversationId = chat id)
router.post('/messages', sendMessage);

// FE-3: Get messages in a conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Get all conversations for user
router.get('/conversations', getConversations);

// Get count of conversations with unread messages (for sidebar badge)
router.get('/conversations/unread-count', getUnreadConversationsCount);

// Get or create conversation by participant
router.get('/conversations/participant/:participantId', getConversationByParticipant);

// FE-4: Delete message
router.delete('/messages/:messageId', deleteMessage);

// FE-5: Search messages
router.get('/conversations/:conversationId/search', searchMessages);

// FE-6: React to message
router.post('/messages/:messageId/react', reactToMessage);

// FE-7: Report message
router.post('/messages/:messageId/report', reportMessage);

// FE-8: Update delivery status
router.patch('/messages/:messageId/status', updateDeliveryStatus);

// FE-9: Star/unstar message
router.post('/messages/:messageId/star', starMessage);

// Get starred messages
router.get('/messages/starred', getStarredMessages);

// Get all blocked users
router.get('/users/blocked', getBlockedUsers);

// FE-11: Block/unblock user
router.post('/users/:userId/block', blockUser);

// All specific routes with /conversations/:conversationId must come before the generic DELETE route
// Accept message request
router.post('/conversations/:conversationId/accept', acceptMessageRequest);

// Decline message request
router.post('/conversations/:conversationId/decline', declineMessageRequest);

// Block user from message request (blocks and deletes the request)
router.post('/conversations/:conversationId/block', blockUserFromRequest);

// Clear chat history (delete all messages from user's view)
router.post('/conversations/:conversationId/clear', clearChatHistory);

// Delete entire conversation (MUST be last to avoid route conflicts with POST routes above)
router.delete('/conversations/:conversationId', deleteConversation);

export default router;
