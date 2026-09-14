import {
  Message,
  Conversation,
  User,
  Report,
  ConversationParticipant,
  ConversationBlockedBy,
  ConversationDeletedBy,
  MessageReadBy,
  MessageReaction,
  MessageStarredBy,
  MessageDeletedBy,
  MessageReport,
  UserFollow,
} from '../database/index.js';
import { getUserByFirebaseId } from '../utils/dbHelpers.js';
import { emitNewMessage, emitMessageDeleted } from '../utils/socketHelper.js';

const USER_ATTRS = ['_id', 'firebaseId', 'name', 'username', 'profilePhoto'];
const POST_MESSAGE_SELECT = 'content image authorId createdAt likesCount commentsCount sharesCount';
const POST_AUTHOR_SELECT = 'name username firebaseId profilePhoto department program';

function postMessagePopulate() {
  return {
    path: 'postId',
    select: POST_MESSAGE_SELECT,
    populate: { path: 'authorId', select: POST_AUTHOR_SELECT },
  };
}

function toPublicUser(user) {
  if (!user) return null;
  const id = user.id ?? user._id;
  return {
    _id: id,
    id,
    firebaseId: user.firebaseId,
    name: user.name,
    username: user.username,
    profilePhoto: user.profilePhoto || null,
  };
}

function toPublicMessage(message, sender, reactions = [], isStarred = false) {
  const base = message.toJSON ? message.toJSON() : message;
  const post = base.postId && typeof base.postId === 'object' ? {
    _id: base.postId._id || base.postId,
    id: base.postId._id || base.postId,
    content: base.postId.content || null,
    image: base.postId.image || null,
    createdAt: base.postId.createdAt || base.postId.created_at || null,
    likesCount: base.postId.likesCount ?? 0,
    commentsCount: base.postId.commentsCount ?? 0,
    sharesCount: base.postId.sharesCount ?? 0,
    author: base.postId.authorId ? {
      ...toPublicUser({ ...base.postId.authorId, id: base.postId.authorId._id || base.postId.authorId }),
      department: base.postId.authorId.department || base.postId.authorId.program || null,
    } : null,
  } : null;
  
  return {
    ...base,
    _id: base.id || base._id,
    sender: sender ? toPublicUser(sender) : base.sender,
    media: base.media || (base.mediaType ? { type: base.mediaType, url: base.mediaUrl } : null),
    link: base.link || (base.linkUrl ? {
      url: base.linkUrl,
      title: base.linkTitle || null,
      description: base.linkDescription || null,
      thumbnail: base.linkThumbnail || null,
    } : null),
    postId: base.postId ? (base.postId._id || base.postId) : null,
    post,
    reactions,
    isStarred,
  };
}

function parsePositiveInt(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeObjectId(value) {
  if (value == null) return '';
  if (typeof value === 'object' && value._id != null) return String(value._id);
  return String(value);
}

async function getOtherParticipantUserId(conversationId, currentUserId) {
  const rows = await ConversationParticipant.find({ conversationId }).select('userId').lean();
  const currentStr = String(currentUserId);
  const other = rows.find((r) => String(r.userId) !== currentStr);
  return other?.userId ?? null;
}

// Must stay under MySQL max_allowed_packet (default often 4MB–16MB). To allow larger media, set in MySQL:
// SET GLOBAL max_allowed_packet=33554432;  (32MB) and restart or reconnect.
const MAX_MEDIA_IMAGE_BYTES = 8 * 1024 * 1024;   // 8MB decoded/base64 payload
const MAX_MEDIA_VIDEO_BYTES = 16 * 1024 * 1024; // 16MB decoded payload

function getBase64ByteSize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return 0;
  const base64 = dataUrl.slice(comma + 1);
  return Math.ceil((base64.length * 3) / 4);
}

// ========== MESSAGING MODULE: CHATS ONLY ==========
// This controller handles direct messages (chats) only. It must never operate on discussion forum
// conversations (isGroup: true). Every message is stored with conversationId pointing to its chat.

async function isConversationParticipant(conversationId, userId) {
  const row = await ConversationParticipant.findOne({ conversationId, userId });
  return !!row;
}

/** Find a chat (DM) between two users. Only returns conversations with isGroup: false. */
async function findConversationBetween(userId1, userId2) {
  const id1 = userId1?.toString?.() ?? userId1;
  const id2 = userId2?.toString?.() ?? userId2;
  const ids = [id1, id2];
  const participants = await ConversationParticipant.find({ userId: { $in: ids } }).lean();
  const byConv = new Map();
  for (const p of participants) {
    const cid = p.conversationId?.toString?.() ?? p.conversationId;
    if (!byConv.has(cid)) byConv.set(cid, new Set());
    byConv.get(cid).add(p.userId?.toString?.() ?? p.userId);
  }
  for (const [cid, userIds] of byConv) {
    if (userIds.has(id1) && userIds.has(id2)) {
      const conv = await Conversation.findById(cid);
      if (conv && !conv.isGroup) return conv;
    }
  }
  return null;
}

/** Ensure the conversation is a chat (DM), not a discussion group. Messaging module is chats only. */
function ensureIsChat(conversation) {
  if (!conversation) return false;
  if (conversation.isGroup) return false;
  return true;
}

/** Get or create a chat (DM) between two users. Always creates with isGroup: false. */
async function getOrCreateConversation(user1Id, user2Id, status = 'accepted', requestedById = null) {
  let conversation = await findConversationBetween(user1Id, user2Id);
  if (!conversation) {
    conversation = await Conversation.create({
      status,
      requestedById: requestedById || null,
      lastMessageAt: new Date(),
      isGroup: false, // messaging = chats only; discussion forum uses isGroup: true
    });
    const participantRows = user1Id?.toString?.() === user2Id?.toString?.()
      ? [{ conversationId: conversation._id, userId: user1Id }]
      : [
          { conversationId: conversation._id, userId: user1Id },
          { conversationId: conversation._id, userId: user2Id },
        ];
    await ConversationParticipant.insertMany(participantRows);
  }
  return conversation;
}

/** Resolve participant by MongoDB _id (24-char hex), username, or firebaseId. */
async function resolveRecipient(recipientId) {
  if (!recipientId) return null;
  const str = String(recipientId).trim();
  if (/^[a-fA-F0-9]{24}$/.test(str)) {
    const byId = await User.findById(str);
    if (byId) return byId;
  }
  const numeric = parsePositiveInt(str);
  if (numeric) {
    const byId = await User.findById(str);
    if (byId) return byId;
  }
  const byUsername = await User.findOne({ username: str.startsWith('@') ? str.slice(1) : str });
  if (byUsername) return byUsername;
  return User.findOne({ firebaseId: str });
}

async function doesUserFollow(followerId, followingId) {
  const row = await UserFollow.findOne({ followerId, followingId });
  return !!row;
}

/** True if both users follow each other (mutual follow). Used for immediate chat. */
async function isMutualFollow(userId1, userId2) {
  const [aFollowsB, bFollowsA] = await Promise.all([
    doesUserFollow(userId1, userId2),
    doesUserFollow(userId2, userId1),
  ]);
  return aFollowsB && bFollowsA;
}

async function formatConversationForUser(conv, currentUserId) {
  const c = conv.toObject ? conv.toObject() : conv;
  if (c.isGroup) return null;

  const participantRows = await ConversationParticipant.find({ conversationId: c._id }).lean();
  const participantIds = participantRows.map((r) => r.userId).filter(Boolean);
  const users = participantIds.length
    ? await User.find({ _id: { $in: participantIds } }).select(USER_ATTRS.join(' ')).lean()
    : [];
  const currentStr = currentUserId?.toString?.() ?? currentUserId;
  const other = users.find((u) => (u._id?.toString?.() ?? u._id) !== currentStr) || users[0] || null;

  let requestedBy = null;
  if (c.requestedById) {
    const reqUser = await User.findById(c.requestedById).select(USER_ATTRS.join(' ')).lean();
    requestedBy = toPublicUser(reqUser ? { ...reqUser, id: reqUser._id } : null);
  }

  let lastMessage = null;
  if (c.lastMessageId) {
    const lm = await Message.findById(c.lastMessageId)
      .populate('senderId', USER_ATTRS.join(' '))
      .populate(postMessagePopulate())
      .lean();
    if (lm && !lm.isDeleted) {
      lastMessage = toPublicMessage(lm, lm.senderId ? { ...lm.senderId, id: lm.senderId._id } : null);
    }
  }

  const messagesInConv = await Message.find({
    conversationId: c._id,
    senderId: { $ne: currentUserId },
    isDeleted: { $ne: true },
  }).select('_id').lean();
  const messageIds = messagesInConv.map((m) => m._id);
  if (messageIds.length === 0) {
    return {
      _id: c._id,
      id: c._id,
      participant: toPublicUser(other ? { ...other, id: other._id } : null),
      lastMessage,
      lastMessageAt: c.lastMessageAt,
      status: c.status,
      requestedBy,
      unreadCount: 0,
    };
  }
  const readByMe = await MessageReadBy.find({
    messageId: { $in: messageIds },
    userId: currentUserId,
  }).select('messageId').lean();
  const readSet = new Set(readByMe.map((r) => String(r.messageId)));
  const deletedByMe = await MessageDeletedBy.find({
    messageId: { $in: messageIds },
    userId: currentUserId,
  }).select('messageId').lean();
  const deletedSet = new Set(deletedByMe.map((d) => String(d.messageId)));
  let unread = 0;
  for (const mid of messageIds) {
    if (!readSet.has(String(mid)) && !deletedSet.has(String(mid))) unread++;
  }

  return {
    _id: c._id,
    id: c._id,
    participant: toPublicUser(other ? { ...other, id: other._id } : null),
    lastMessage,
    lastMessageAt: c.lastMessageAt,
    status: c.status,
    requestedBy,
    unreadCount: unread,
  };
}

export const sendMessage = async (req, res) => {
  try {
    const { recipientId, content, media, link } = req.body;
    const senderFirebaseId = req.user.uid;

    if (!recipientId) return res.status(400).json({ error: 'Recipient ID is required' });
    if (!content && !media && !link) {
      return res.status(400).json({ error: 'Message content, media, or link is required' });
    }

    if (media?.url) {
      const mediaBytes = getBase64ByteSize(media.url);
      const isImage = media.type === 'image';
      const maxBytes = isImage ? MAX_MEDIA_IMAGE_BYTES : MAX_MEDIA_VIDEO_BYTES;
      if (mediaBytes > maxBytes) {
        const maxMB = Math.round(maxBytes / (1024 * 1024));
        return res.status(400).json({
          error: `Media file is too large. Maximum size: ${maxMB}MB for ${isImage ? 'images' : 'videos'}.`,
        });
      }
    }

    const sender = await getUserByFirebaseId(senderFirebaseId);
    if (!sender) return res.status(404).json({ error: 'Sender not found' });

    const recipient = await resolveRecipient(recipientId);
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    const isSelfMessage = (recipient._id?.toString?.() ?? recipient.id) === (sender._id?.toString?.() ?? sender.id);

    let existingConversation = await findConversationBetween(sender._id, recipient._id);

    if (existingConversation) {
      const blockedByRecipient = await ConversationBlockedBy.findOne({
        conversationId: existingConversation._id,
        userId: recipient._id,
      });
      if (blockedByRecipient) {
        return res.status(403).json({
          error: 'You cannot send messages to this user. You have been blocked.',
        });
      }
    }

    const mutualFollow = await isMutualFollow(sender._id, recipient._id);
    const shouldBeAccepted = isSelfMessage || mutualFollow;

    let conv;
    let isNewRequest = false;
    if (!shouldBeAccepted) {
      if (existingConversation) {
        // If conversation was already accepted, keep it accepted (don't downgrade to pending)
        if (existingConversation.status === 'accepted') {
          // Conversation was previously accepted, keep it accepted
          // Ensure requestedById is set if missing
          if (!existingConversation.requestedById) {
            await Conversation.updateOne({ _id: existingConversation._id }, { requestedById: sender._id });
          }
          conv = existingConversation;
        } else if (existingConversation.status === 'pending') {
          // Sender is the original requester: they can keep sending (request still pending).
          // Sender is the other party (e.g. they declined and now message again): allow send and flip request to them.
          const senderIsRequester = existingConversation.requestedById &&
            String(existingConversation.requestedById) === String(sender._id);
          if (!senderIsRequester) {
            // Allow the person who declined to send a new message — treat as new request from them
            await Conversation.updateOne(
              { _id: existingConversation._id },
              { requestedById: sender._id }
            );
            existingConversation.requestedById = sender._id;
          }
          isNewRequest = true; // This is a request that needs acceptance
          conv = existingConversation;
        }
      } else {
        // Brand new conversation - this is definitely a new request
        isNewRequest = true;
        conv = await getOrCreateConversation(sender._id, recipient._id, 'pending', sender._id);
      }
    } else {
      if (existingConversation) {
        // If recipient follows sender, ensure conversation is accepted
        if (existingConversation.status === 'pending') {
          await existingConversation.update({
            status: 'accepted',
            acceptedAt: new Date(),
            requestedById: existingConversation.requestedById || sender._id,
          });
        } else if (existingConversation.status === 'accepted') {
          // Keep accepted status, but ensure requestedById is set if missing
          if (!existingConversation.requestedById) {
            await Conversation.updateOne({ _id: existingConversation._id }, { requestedById: sender._id });
          }
        }
        conv = existingConversation;
      } else {
        conv = await getOrCreateConversation(sender._id, recipient._id, 'accepted', sender._id);
      }
    }

    const message = await Message.create({
      conversationId: conv._id,
      senderId: sender._id,
      content: content || null,
      mediaType: media?.type || null,
      mediaUrl: media?.url || null,
      linkUrl: link?.url || null,
      linkTitle: link?.title || null,
      linkDescription: link?.description || null,
      linkThumbnail: link?.thumbnail || null,
      deliveryStatus: 'sent',
    });

    await ConversationDeletedBy.deleteOne({
      conversationId: conv._id,
      userId: recipient._id,
    });
    await ConversationDeletedBy.deleteOne({
      conversationId: conv._id,
      userId: sender._id,
    });

    await Conversation.updateOne(
      { _id: conv._id },
      { lastMessageId: message._id, lastMessageAt: new Date() }
    );

    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', USER_ATTRS.join(' '))
      .lean();
    const publicMessage = toPublicMessage(
      populatedMessage,
      populatedMessage?.senderId ? { ...populatedMessage.senderId, id: populatedMessage.senderId._id } : null,
      [],
      false
    );

    const isRequest = (conv.status === 'pending' && String(conv.requestedById) === String(sender._id)) && isNewRequest;

    try {
      await emitNewMessage(publicMessage, senderFirebaseId, recipient.firebaseId);
    } catch (socketError) {
      console.error('Error emitting socket event:', socketError);
    }

    return res.status(201).json({
      success: true,
      message: publicMessage,
      conversationStatus: conv.status,
      isRequest: isRequest,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getMessages = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const page = Math.max(parsePositiveInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parsePositiveInt(req.query.limit) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!ensureIsChat(conversation)) {
      return res.status(400).json({ error: 'This is a discussion group; use discussion endpoints' });
    }

    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const rows = await Message.find({ conversationId, isDeleted: false })
      .populate('senderId', USER_ATTRS.join(' '))
      .populate(postMessagePopulate())
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .lean();

    const ids = rows.map((m) => m._id);
    const [deletedRows, reactionRows, starredRows] = await Promise.all([
      ids.length ? MessageDeletedBy.find({ messageId: { $in: ids }, userId: user._id }).select('messageId').lean() : [],
      ids.length ? MessageReaction.find({ messageId: { $in: ids } }).lean().catch(() => []) : [],
      ids.length ? MessageStarredBy.find({ messageId: { $in: ids }, userId: user._id }).select('messageId').lean() : [],
    ]);

    const deletedSet = new Set(deletedRows.map((r) => String(r.messageId)));
    const starredSet = new Set(starredRows.map((r) => String(r.messageId)));

    const reactionsByMsg = new Map();
    for (const rr of reactionRows) {
      const mid = rr.messageId?.toString?.() ?? rr.messageId;
      if (!reactionsByMsg.has(mid)) reactionsByMsg.set(mid, []);
      reactionsByMsg.get(mid).push({
        _id: rr._id,
        emoji: rr.emoji,
        user: rr.userId ? toPublicUser({ ...rr.userId, id: rr.userId._id }) : null,
      });
    }

    const visible = rows.filter((m) => !deletedSet.has(String(m._id)));
    const convAccepted = conversation.status === 'accepted';
    const otherUserId = await getOtherParticipantUserId(conversationId, user._id);

    // Only mark incoming messages read after the request is accepted (recipient opened the chat).
    const incomingToViewer = visible.filter(
      (m) => normalizeObjectId(m.senderId) !== String(user._id)
    );
    if (convAccepted && incomingToViewer.length) {
      const toMarkRead = incomingToViewer.map((m) => m._id);
      const toInsert = toMarkRead.map((id) => ({ messageId: id, userId: user._id, readAt: new Date() }));
      await MessageReadBy.insertMany(toInsert).catch(() => {});
    }

    const myMessageIds = visible
      .filter((m) => normalizeObjectId(m.senderId) === String(user._id))
      .map((m) => m._id);
    let readByRecipientSet = new Set();
    if (convAccepted && otherUserId && myMessageIds.length) {
      const readRows = await MessageReadBy.find({
        messageId: { $in: myMessageIds },
        userId: otherUserId,
      })
        .select('messageId')
        .lean();
      readByRecipientSet = new Set(readRows.map((r) => String(r.messageId)));
    }

    const publicMessages = visible.map((m) => {
      const senderIdStr = normalizeObjectId(m.senderId);
      const pub = toPublicMessage(
        m,
        m.senderId && typeof m.senderId === 'object'
          ? { ...m.senderId, id: m.senderId._id }
          : null,
        reactionsByMsg.get(String(m._id)) || [],
        starredSet.has(String(m._id))
      );
      if (senderIdStr === String(user._id)) {
        pub.deliveryStatus =
          !convAccepted || !readByRecipientSet.has(String(m._id))
            ? 'sent'
            : 'read';
      }
      return pub;
    });

    return res.json({
      success: true,
      messages: publicMessages.reverse(),
      pagination: { page, limit, hasMore: publicMessages.length === limit },
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getConversations = async (req, res) => {
  try {
    const status = req.query.status;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const userId = user._id;

    const participantRows = await ConversationParticipant.find({ userId }).select('conversationId').lean();
    const conversationIds = participantRows.map((r) => r.conversationId).filter(Boolean);
    if (!conversationIds.length) return res.json({ success: true, conversations: [] });

    const deletedRows = await ConversationDeletedBy.find({
      userId,
      conversationId: { $in: conversationIds },
    }).select('conversationId').lean();
    const deletedSet = new Set(deletedRows.map((r) => String(r.conversationId)));
    const visibleConvIds = conversationIds.filter((id) => !deletedSet.has(String(id)));
    if (!visibleConvIds.length) return res.json({ success: true, conversations: [] });

    const query = { _id: { $in: visibleConvIds }, isGroup: false };
    if (status === 'accepted') {
      // Inbox: accepted chats + pending chats where I am the requester (so sender sees conversations they started)
      query.$or = [
        { status: 'accepted' },
        { status: 'pending', requestedById: userId },
      ];
    } else if (status === 'pending') {
      // Message requests: only incoming (where someone else requested to message me)
      query.status = 'pending';
      query.requestedById = { $ne: userId };
    }

    const conversations = await Conversation.find(query).sort({ lastMessageAt: -1 }).lean();

    const formatted = [];
    for (const conv of conversations) {
      const f = await formatConversationForUser(conv, userId);
      if (f && f.participant) formatted.push(f);
    }

    return res.json({ success: true, conversations: formatted });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return res.status(500).json({ error: error.message });
  }
};

/** Get count of conversations that have at least one unread message (for sidebar badge) */
export const getUnreadConversationsCount = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userId = user._id;

    // All conversations the user participates in
    const participantRows = await ConversationParticipant.find({ userId }).select('conversationId').lean();
    const conversationIds = [...new Set(participantRows.map((r) => r.conversationId).filter(Boolean))];
    if (!conversationIds.length) {
      return res.json({ success: true, count: 0 });
    }

    // Exclude conversations the user has cleared/deleted
    const deletedRows = await ConversationDeletedBy.find({
      userId,
      conversationId: { $in: conversationIds },
    }).select('conversationId').lean();
    const deletedSet = new Set(deletedRows.map((r) => String(r.conversationId)));
    const visibleConvIds = conversationIds.filter((id) => !deletedSet.has(String(id)));
    if (!visibleConvIds.length) {
      return res.json({ success: true, count: 0 });
    }

    let unreadChats = 0;

    // For each visible conversation, check if there exists at least one unread & not-deleted message
    for (const convId of visibleConvIds) {
      const messagesInConv = await Message.find({
        conversationId: convId,
        senderId: { $ne: userId },
        isDeleted: { $ne: true },
      }).select('_id').lean();

      const messageIds = messagesInConv.map((m) => m._id);
      if (!messageIds.length) continue;

      const [readRows, deletedByMeRows] = await Promise.all([
        MessageReadBy.find({ messageId: { $in: messageIds }, userId }).select('messageId').lean(),
        MessageDeletedBy.find({ messageId: { $in: messageIds }, userId }).select('messageId').lean(),
      ]);

      const readSet = new Set(readRows.map((r) => String(r.messageId)));
      const deletedByMeSet = new Set(deletedByMeRows.map((r) => String(r.messageId)));

      const hasUnread = messageIds.some(
        (mid) => !readSet.has(String(mid)) && !deletedByMeSet.has(String(mid))
      );

      if (hasUnread) unreadChats += 1;
    }

    return res.json({ success: true, count: unreadChats });
  } catch (error) {
    console.error('Error getting unread conversations count:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(400).json({ error: 'This endpoint is only available for direct messages' });
    }

    const isParticipant = await isConversationParticipant(message.conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    if (String(message.senderId) === String(user._id)) {
      await Message.updateOne({ _id: messageId }, { isDeleted: true });
      const otherParticipants = await ConversationParticipant.find({
        conversationId: message.conversationId,
        userId: { $ne: user._id },
      }).select('userId').lean();
      for (const p of otherParticipants) {
        await MessageDeletedBy.findOneAndUpdate(
          { messageId, userId: p.userId },
          { $set: { messageId, userId: p.userId } },
          { upsert: true }
        );
      }
      const recipient = otherParticipants[0] ? await User.findById(otherParticipants[0].userId).select('firebaseId').lean() : null;
      if (recipient?.firebaseId) {
        await emitMessageDeleted(message.conversationId, messageId, recipient.firebaseId);
      }
    } else {
      await MessageDeletedBy.findOneAndUpdate(
        { messageId, userId: user._id },
        { $set: { messageId, userId: user._id } },
        { upsert: true }
      );
    }

    if (String(conversation.lastMessageId) === String(messageId)) {
      const prev = await Message.findOne({
        conversationId: message.conversationId,
        _id: { $ne: messageId },
        isDeleted: false,
      }).sort({ createdAt: -1 }).select('_id createdAt').lean();
      await Conversation.updateOne(
        { _id: message.conversationId },
        { lastMessageId: prev?._id ?? null, lastMessageAt: prev?.createdAt ?? null }
      );
    }

    return res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const conversationId = parsePositiveInt(req.params.conversationId);
    const q = String(req.query.query || '').trim();
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });
    if (!q) return res.status(400).json({ error: 'Search query is required' });

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }

    const isParticipant = await isConversationParticipant(conversationId, user.id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const rows = await Message.findAll({
      where: {
        conversationId,
        content: { [Op.like]: `%${q}%` },
      },
      include: [{ model: User, as: 'sender', attributes: USER_ATTRS }],
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    const ids = rows.map((m) => m.id);
    const deletedRows = ids.length
      ? await MessageDeletedBy.findAll({
          where: { messageId: { [Op.in]: ids }, userId: user.id },
          raw: true,
        })
      : [];
    const deletedSet = new Set(deletedRows.map((r) => r.messageId));

    const messages = rows
      .filter((m) => !deletedSet.has(m.id))
      .map((m) => toPublicMessage(m, m.sender))
      .reverse();

    return res.json({ success: true, messages });
  } catch (error) {
    console.error('Error searching messages:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const messageId = req.params.messageId;
    const emoji = String(req.body.emoji || '').trim();
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID' });
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const conversation = await Conversation.findById(message.conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(400).json({ error: 'This endpoint is only available for direct messages' });
    }

    // One reaction per user per message: remove any existing reaction by this user, then add the new one
    await MessageReaction.deleteMany({ messageId, userId: user._id });
    await MessageReaction.create({ messageId, userId: user._id, emoji });

    const reactionRows = await MessageReaction.find({ messageId }).populate('userId', USER_ATTRS.join(' ')).lean();
    const reactions = reactionRows.map((rr) => ({
      _id: rr._id,
      emoji: rr.emoji,
      user: rr.userId ? toPublicUser(rr.userId) : null,
    }));

    const updatedMessage = await Message.findById(messageId).populate('senderId', USER_ATTRS.join(' ')).lean();
    const isStarred = !!(await MessageStarredBy.findOne({ messageId, userId: user._id }).lean());
    return res.json({
      success: true,
      message: toPublicMessage(updatedMessage, updatedMessage?.senderId, reactions, isStarred),
    });
  } catch (error) {
    console.error('Error reacting to message:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const reportMessage = async (req, res) => {
  try {
    const messageId = parsePositiveInt(req.params.messageId);
    const reason = String(req.body.reason || '').trim();
    const description = req.body.description || null;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID' });
    if (!reason) return res.status(400).json({ error: 'Report reason is required' });

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const conversation = await Conversation.findByPk(message.conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(400).json({ error: 'This endpoint is only available for direct messages' });
    }

    const report = await Report.create({
      reportedById: user.id,
      reportedItemId: message.id,
      itemType: 'message',
      reason,
      description,
      status: 'pending',
    });
    await MessageReport.findOrCreate({ where: { messageId: message.id, reportId: report.id } });

    return res.json({ success: true, message: 'Message reported successfully' });
  } catch (error) {
    console.error('Error reporting message:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const updateDeliveryStatus = async (req, res) => {
  try {
    const messageId = parsePositiveInt(req.params.messageId);
    const status = String(req.body.status || '');
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID' });
    if (!['sent', 'delivered', 'read'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const conversation = await Conversation.findByPk(message.conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(400).json({ error: 'This endpoint is only available for direct messages' });
    }

    await message.update({ deliveryStatus: status });
    if (status === 'read') {
      await MessageReadBy.findOrCreate({
        where: { messageId, userId: user.id },
        defaults: { readAt: new Date() },
      });
    }

    const out = await Message.findByPk(messageId, {
      include: [{ model: User, as: 'sender', attributes: USER_ATTRS }],
    });
    return res.json({ success: true, message: toPublicMessage(out, out.sender) });
  } catch (error) {
    console.error('Error updating delivery status:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const starMessage = async (req, res) => {
  try {
    const messageId = parsePositiveInt(req.params.messageId);
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!messageId) return res.status(400).json({ error: 'Invalid message ID' });

    const message = await Message.findByPk(messageId);
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const conversation = await Conversation.findByPk(message.conversationId);
    if (!conversation || conversation.isGroup) {
      return res.status(400).json({ error: 'This endpoint is only available for direct messages' });
    }

    const existing = await MessageStarredBy.findOne({ where: { messageId, userId: user.id } });
    if (existing) await existing.destroy();
    else await MessageStarredBy.create({ messageId, userId: user.id });

    const stars = await MessageStarredBy.count({ where: { messageId } });
    await message.update({ isStarred: stars > 0 });

    const out = await Message.findByPk(messageId, {
      include: [{ model: User, as: 'sender', attributes: USER_ATTRS }],
    });
    return res.json({ success: true, message: toPublicMessage(out, out.sender, [], !!stars) });
  } catch (error) {
    console.error('Error starring message:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getStarredMessages = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rows = await MessageStarredBy.findAll({
      where: { userId: user.id },
      attributes: ['messageId'],
      raw: true,
    });
    const ids = rows.map((r) => r.messageId);
    if (!ids.length) return res.json({ success: true, messages: [] });

    const messages = await Message.findAll({
      where: { id: { [Op.in]: ids }, isDeleted: false },
      include: [
        { model: Conversation, where: { isGroup: false }, attributes: [] },
        { model: User, as: 'sender', attributes: USER_ATTRS },
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });

    return res.json({
      success: true,
      messages: messages.map((m) => toPublicMessage(m, m.sender, [], true)),
    });
  } catch (error) {
    console.error('Error getting starred messages:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const userId = user._id;
    // Mongoose: find blocked rows for this user
    const blockedRows = await ConversationBlockedBy.find({ userId })
      .select('conversationId blockedAt')
      .lean();

    const blocked = [];
    const seenUserIds = new Set();
    for (const row of blockedRows) {
      const convId = row.conversationId;
      const parts = await ConversationParticipant.find({ conversationId: convId }).lean();
      const other = parts.find((p) => String(p.userId) !== String(userId));
      if (!other) continue;
      const otherIdStr = String(other.userId);
      if (seenUserIds.has(otherIdStr)) continue;
      seenUserIds.add(otherIdStr);
      const otherUser = await User.findById(other.userId).select(USER_ATTRS.join(' ')).lean();
      if (!otherUser) continue;
      blocked.push({
        ...toPublicUser({ ...otherUser, id: otherUser._id }),
        _id: otherUser._id,
        blockedAt: row.blockedAt || null,
        conversationId: convId,
      });
    }

    return res.json({ success: true, blockedUsers: blocked });
  } catch (error) {
    console.error('Error getting blocked users:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const target = await resolveRecipient(req.params.userId);
    if (!target) return res.status(404).json({ error: 'User to block not found' });

    const userId = user._id;
    const targetId = target._id;
    const conv = await getOrCreateConversation(userId, targetId, 'accepted', userId);
    const convId = conv._id;

    const existingCount = await ConversationBlockedBy.countDocuments({
      conversationId: convId,
      userId,
    });
    if (existingCount > 0) {
      await ConversationBlockedBy.deleteMany({ conversationId: convId, userId });
      return res.json({ success: true, blocked: false });
    }

    await ConversationBlockedBy.create({
      conversationId: convId,
      userId,
      blockedAt: new Date(),
    });

    return res.json({ success: true, blocked: true });
  } catch (error) {
    console.error('Error blocking user:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const acceptMessageRequest = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }

    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });
    if (conversation.status !== 'pending') return res.status(400).json({ error: 'Conversation is not pending' });
    if (String(conversation.requestedById) === String(user._id)) return res.status(400).json({ error: 'You cannot accept your own request' });

    await Conversation.updateOne({ _id: conversationId }, { status: 'accepted', acceptedAt: new Date() });
    const updated = await Conversation.findById(conversationId).lean();
    const formatted = await formatConversationForUser(updated, user._id);
    return res.json({ success: true, message: 'Message request accepted', conversation: formatted });
  } catch (error) {
    console.error('Error accepting message request:', error);
    return res.status(500).json({ error: error.message || 'Failed to accept message request' });
  }
};

export const declineMessageRequest = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }
    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });
    if (conversation.status !== 'pending') return res.status(400).json({ error: 'Conversation is not pending' });

    await ConversationDeletedBy.findOneAndUpdate(
      { conversationId, userId: user._id },
      { $set: { conversationId, userId: user._id } },
      { upsert: true }
    );
    return res.json({ success: true, message: 'Message request declined' });
  } catch (error) {
    console.error('Error declining message request:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const blockUserFromRequest = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }

    await ConversationBlockedBy.findOneAndUpdate(
      { conversationId, userId: user._id },
      { $set: { conversationId, userId: user._id, blockedAt: new Date() } },
      { upsert: true }
    );
    await ConversationDeletedBy.findOneAndUpdate(
      { conversationId, userId: user._id },
      { $set: { conversationId, userId: user._id } },
      { upsert: true }
    );
    return res.json({ success: true, message: 'User blocked and message request deleted' });
  } catch (error) {
    console.error('Error blocking user from request:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const clearChatHistory = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }

    const messages = await Message.find({ conversationId }).select('_id').lean();
    if (messages.length) {
      const docs = messages.map((m) => ({ messageId: m._id, userId: user._id }));
      await MessageDeletedBy.insertMany(docs, { ordered: false }).catch(() => {});
    }
    return res.json({ success: true, message: 'Chat history cleared successfully' });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const conversationId = req.params.conversationId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!conversationId) return res.status(400).json({ error: 'Invalid conversation ID' });

    const isParticipant = await isConversationParticipant(conversationId, user._id);
    if (!isParticipant) return res.status(403).json({ error: 'Access denied' });

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (conversation.isGroup) {
      return res.status(400).json({ error: 'Use discussion endpoints for group conversations' });
    }

    await ConversationDeletedBy.findOneAndUpdate(
      { conversationId, userId: user._id },
      { $set: { conversationId, userId: user._id } },
      { upsert: true }
    );

    const messages = await Message.find({ conversationId }).select('_id').lean();
    if (messages.length) {
      const docs = messages.map((m) => ({ messageId: m._id, userId: user._id }));
      await MessageDeletedBy.insertMany(docs, { ordered: false }).catch(() => {});
    }

    return res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete conversation' });
  }
};

export const getConversationByParticipant = async (req, res) => {
  try {
    const participantId = req.params.participantId;
    const user = await getUserByFirebaseId(req.user.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const participant = await resolveRecipient(participantId);
    if (!participant) return res.status(404).json({ error: 'Participant not found' });
    const userId = user._id;
    const participantIdObj = participant._id;
    const isSelfConversation = String(participantIdObj) === String(userId);

    let existingConversation = await findConversationBetween(userId, participantIdObj);
    const mutualFollow = await isMutualFollow(userId, participantIdObj);
    const shouldBeAccepted = isSelfConversation || mutualFollow;

    const conversation = existingConversation
      ? existingConversation
      : await getOrCreateConversation(
          userId,
          participantIdObj,
          shouldBeAccepted ? 'accepted' : 'pending',
          userId
        );

    if (conversation.status === 'pending' && shouldBeAccepted) {
      await Conversation.updateOne({ _id: conversation._id }, { status: 'accepted', acceptedAt: new Date() });
      conversation.status = 'accepted';
    }

    const requestedBy = conversation.requestedById
      ? await User.findById(conversation.requestedById).select(USER_ATTRS.join(' ')).lean()
      : null;
    const convId = conversation._id?.toString?.() ?? conversation.id ?? conversation._id;

    return res.json({
      success: true,
      conversation: {
        _id: convId,
        id: convId,
        status: conversation.status,
        requestedBy: toPublicUser(requestedBy),
        participant: toPublicUser(participant),
      },
    });
  } catch (error) {
    console.error('Error getting conversation:', error);
    return res.status(500).json({ error: error.message });
  }
};
