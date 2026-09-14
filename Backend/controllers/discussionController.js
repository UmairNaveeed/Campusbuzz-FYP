import {
  Conversation,
  ConversationParticipant,
  GroupInvite,
  GroupJoinRequest,
  Message,
  MessageReadBy,
  User,
  Notification,
} from '../database/index.js';
import { getUserByFirebaseId } from '../utils/dbHelpers.js';

const USER_ATTRS = ['_id', 'firebaseId', 'name', 'username', 'profilePhoto'];

function parsePositiveInt(value) {
  const n = Number.parseInt(String(value), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toPublicUser(user) {
  if (!user) return null;
  const u = user.toJSON ? user.toJSON() : user;
  const id = u.id ?? u._id;
  return {
    id,
    _id: id,
    firebaseId: u.firebaseId,
    name: u.name,
    username: u.username,
    profilePhoto: u.profilePhoto || null,
  };
}

function toPublicMessage(message, sender) {
  const m = message.toJSON ? message.toJSON() : message;
  return {
    ...m,
    id: m.id,
    _id: m.id,
    sender: sender ? toPublicUser(sender) : null,
    media: m.media || (m.mediaType ? { type: m.mediaType, url: m.mediaUrl } : null),
  };
}

async function getCurrentUser(req) {
  const firebaseId = req.user?.uid;
  if (!firebaseId) return null;
  return getUserByFirebaseId(firebaseId);
}

async function getGroupById(groupId) {
  return Conversation.findOne({ _id: groupId, isGroup: true });
}

async function isGroupMember(groupId, userId) {
  const row = await ConversationParticipant.findOne({ conversationId: groupId, userId });
  return !!row;
}

function mapGroup(group, currentUserId, memberCount, extra = {}) {
  const g = group.toJSON ? group.toJSON() : group;
  const id = g.id ?? g._id;
  return {
    id,
    _id: id,
    name: g.groupName || 'Untitled Group',
    groupPhoto: g.groupPhoto || null,
    description: g.groupDescription || '',
    isPrivate: g.status === 'pending',
    memberCount: memberCount ?? 0,
    adminId: g.requestedById || null,
    isAdmin: !!(currentUserId && g.requestedById && String(g.requestedById) === String(currentUserId)),
    createdAt: g.createdAt || g.created_at,
    updatedAt: g.updatedAt || g.updated_at,
    ...extra,
  };
}

async function ensureAdmin(group, userId) {
  return !!group && !!userId && String(group.requestedById) === String(userId);
}

async function getMemberCount(groupId) {
  return ConversationParticipant.countDocuments({ conversationId: groupId });
}

async function ensureInvitesTable() {
  // No-op for Mongoose; collections created on first use
}

export const createGroup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, description, isPrivate = false, groupPhoto = null } = req.body || {};
    const groupName = (name || '').trim();
    const groupDescription = (description || '').trim();

    if (!groupName) return res.status(400).json({ error: 'Group name is required' });
    if (groupName.length > 255) return res.status(400).json({ error: 'Group name is too long' });
    if (groupDescription.length > 500) return res.status(400).json({ error: 'Description is too long (max 500 characters)' });

    const group = await Conversation.create({
      isGroup: true,
      groupName,
      groupPhoto: groupPhoto || null,
      groupDescription: groupDescription || null,
      status: isPrivate ? 'pending' : 'accepted',
      requestedById: user._id,
      acceptedAt: new Date(),
      lastMessageAt: new Date(),
    });

    await ConversationParticipant.create({
      conversationId: group._id,
      userId: user._id,
    });

    return res.status(201).json({
      success: true,
      group: mapGroup(group, user._id, 1),
    });
  } catch (error) {
    console.error('Create group error:', error);
    return res.status(500).json({ error: 'Failed to create group', details: error.message });
  }
};

export const getForumMessageCount = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const myMemberships = await ConversationParticipant.find({ userId: user._id }).select('conversationId').lean();
    const myConvIds = myMemberships.map((m) => m.conversationId).filter(Boolean);
    if (myConvIds.length === 0) return res.json({ success: true, count: 0 });

    const groupConvs = await Conversation.find({ _id: { $in: myConvIds }, isGroup: true }).select('_id').lean();
    const myGroupIds = groupConvs.map((g) => g._id);
    if (myGroupIds.length === 0) return res.json({ success: true, count: 0 });

    const groupMsgIds = await Message.find({
      conversationId: { $in: myGroupIds },
      isDeleted: { $ne: true },
    })
      .select('_id')
      .lean();
    const ids = groupMsgIds.map((m) => m._id);
    const readCount = ids.length
      ? await MessageReadBy.countDocuments({ userId: user._id, messageId: { $in: ids } })
      : 0;
    const unreadCount = ids.length - readCount;
    return res.json({ success: true, count: unreadCount });
  } catch (error) {
    console.error('Get forum message count error:', error);
    return res.status(500).json({ error: 'Failed to get count', details: error.message });
  }
};

export const listGroups = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const myMemberships = await ConversationParticipant.find({ userId: user._id }).select('conversationId').lean();
    const myGroupIds = myMemberships.map((m) => m.conversationId).filter(Boolean);

    const myGroups = myGroupIds.length
      ? await Conversation.find({ _id: { $in: myGroupIds }, isGroup: true }).sort({ updated_at: -1 }).lean()
      : [];

    // All groups user hasn't joined (both public and private - private groups visible, require request to join)
    const otherGroups = await Conversation.find({
      isGroup: true,
      ...(myGroupIds.length ? { _id: { $nin: myGroupIds } } : {}),
    }).sort({ updated_at: -1 }).lean();

    const allGroupIds = [...new Set([...myGroups.map((g) => g._id), ...otherGroups.map((g) => g._id)])];
    const countMap = new Map();
    const messageCountMap = new Map();
    const unreadCountMap = new Map();
    if (allGroupIds.length) {
      const [memberCounts, msgCounts] = await Promise.all([
        ConversationParticipant.aggregate([
          { $match: { conversationId: { $in: allGroupIds } } },
          { $group: { _id: '$conversationId', memberCount: { $sum: 1 } } },
        ]),
        Message.aggregate([
          { $match: { conversationId: { $in: allGroupIds }, isDeleted: { $ne: true } } },
          { $group: { _id: '$conversationId', messageCount: { $sum: 1 } } },
        ]),
      ]);
      memberCounts.forEach((c) => countMap.set(c._id?.toString(), c.memberCount || 0));
      msgCounts.forEach((c) => messageCountMap.set(c._id?.toString(), c.messageCount || 0));

      const msgsByGroup = await Message.aggregate([
        { $match: { conversationId: { $in: allGroupIds }, isDeleted: { $ne: true } } },
        { $group: { _id: '$conversationId', msgIds: { $push: '$_id' } } },
      ]);
      const allMsgIds = msgsByGroup.flatMap((g) => g.msgIds || []);
      const readByUser = allMsgIds.length
        ? await MessageReadBy.find({ userId: user._id, messageId: { $in: allMsgIds } }).select('messageId').lean()
        : [];
      const readSet = new Set(readByUser.map((r) => String(r.messageId)));
      msgsByGroup.forEach((g) => {
        const ids = g.msgIds || [];
        const unread = ids.filter((id) => !readSet.has(String(id))).length;
        unreadCountMap.set(String(g._id), unread);
      });
    }

    // For private groups user hasn't joined, check if they have a pending join request
    const otherPrivateIds = otherGroups.filter((g) => g.status === 'pending').map((g) => g._id);
    const pendingRequestMap = new Map();
    if (otherPrivateIds.length) {
      const pending = await GroupJoinRequest.find({
        groupId: { $in: otherPrivateIds },
        userId: user._id,
        status: 'pending',
      }).lean();
      pending.forEach((r) => pendingRequestMap.set(String(r.groupId), true));
    }

    return res.json({
      success: true,
      myGroups: myGroups.map((g) => mapGroup(g, user._id, countMap.get(String(g._id)) || 0, {
        messageCount: messageCountMap.get(String(g._id)) || 0,
        unreadCount: unreadCountMap.get(String(g._id)) || 0,
      })),
      publicGroups: otherGroups.map((g) => mapGroup(g, user._id, countMap.get(String(g._id)) || 0, {
        hasPendingRequest: !!pendingRequestMap.get(String(g._id)),
        messageCount: messageCountMap.get(String(g._id)) || 0,
        unreadCount: unreadCountMap.get(String(g._id)) || 0,
      })),
    });
  } catch (error) {
    console.error('List groups error:', error);
    return res.status(500).json({ error: 'Failed to fetch groups', details: error.message });
  }
};

export const editGroup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can edit group details' });

    const { name, description, isPrivate, groupPhoto } = req.body || {};
    const updates = {};

    if (name !== undefined) {
      const groupName = String(name || '').trim();
      if (!groupName) return res.status(400).json({ error: 'Group name cannot be empty' });
      updates.groupName = groupName;
    }
    if (description !== undefined) {
      const groupDescription = String(description || '').trim();
      if (groupDescription.length > 500) return res.status(400).json({ error: 'Description is too long (max 500 characters)' });
      updates.groupDescription = groupDescription || null;
    }
    if (isPrivate !== undefined) updates.status = isPrivate ? 'pending' : 'accepted';
    if (groupPhoto !== undefined) updates.groupPhoto = groupPhoto || null;

    await Conversation.updateOne({ _id: group._id }, updates);
    const memberCount = await getMemberCount(group._id);
    const updatedGroup = await Conversation.findById(group._id).lean();

    return res.json({
      success: true,
      group: mapGroup(updatedGroup || group, user._id, memberCount),
    });
  } catch (error) {
    console.error('Edit group error:', error);
    return res.status(500).json({ error: 'Failed to edit group', details: error.message });
  }
};

export const deleteGroup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can delete group' });

    await Message.deleteMany({ conversationId: group._id });
    await ConversationParticipant.deleteMany({ conversationId: group._id });
    await Conversation.deleteOne({ _id: group._id });
    return res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    return res.status(500).json({ error: 'Failed to delete group', details: error.message });
  }
};

export const joinPublicGroup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const alreadyMember = await isGroupMember(group._id, user._id);
    if (alreadyMember) {
      const memberCount = await getMemberCount(group._id);
      return res.json({ success: true, group: mapGroup(group, user._id, memberCount) });
    }

    // Private group: create join request instead of joining directly
    if (group.status === 'pending') {
      let joinReqId = null;
      const existing = await GroupJoinRequest.findOne({ groupId: group._id, userId: user._id });
      if (existing) {
        if (existing.status === 'pending') {
          return res.status(400).json({ error: 'Join request already sent and pending' });
        }
        // Rejected: allow re-request by updating back to pending
        await GroupJoinRequest.updateOne(
          { _id: existing._id },
          { status: 'pending', respondedAt: null, respondedById: null }
        );
        joinReqId = existing._id;
      } else {
        const created = await GroupJoinRequest.create({ groupId: group._id, userId: user._id, status: 'pending' });
        joinReqId = created._id;
      }
      const adminId = group.requestedById;
      if (adminId && String(adminId) !== String(user._id) && joinReqId) {
        try {
          await Notification.create({
            userId: adminId,
            actorId: user._id,
            type: 'group_join_request',
            extra: JSON.stringify({ groupId: String(group._id), groupName: group.groupName || 'Group', requestId: String(joinReqId) }),
          });
        } catch (err) {
          console.error('Create join request notification error:', err.message);
        }
      }
      const memberCount = await getMemberCount(group._id);
      return res.json({
        success: true,
        requested: true,
        message: 'Join request sent. Admin will review it.',
        group: mapGroup(group, user._id, memberCount, { hasPendingRequest: true }),
      });
    }

    // Public group: join directly
    await ConversationParticipant.create({
      conversationId: group._id,
      userId: user._id,
    });

    const memberCount = await getMemberCount(group._id);
    return res.json({
      success: true,
      group: mapGroup(group, user._id, memberCount),
    });
  } catch (error) {
    console.error('Join public group error:', error);
    return res.status(500).json({ error: 'Failed to join group', details: error.message });
  }
};

export const inviteUserToGroup = async (req, res) => {
  try {
    await ensureInvitesTable();
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can invite users' });

    const { userId, username } = req.body || {};
    let invitedUser = null;
    if (userId) {
      invitedUser = await User.findById(userId);
    }
    if (!invitedUser && username) {
      invitedUser = await User.findOne({ username: String(username).trim() });
    }
    if (!invitedUser) return res.status(404).json({ error: 'User to invite not found' });

    const alreadyMember = await isGroupMember(group._id, invitedUser._id);
    if (alreadyMember) {
      return res.status(400).json({ error: 'User is already a group member' });
    }

    const existingPending = await GroupInvite.findOne({
      groupId: group._id,
      invitedUserId: invitedUser._id,
      status: 'pending',
    });
    if (existingPending) {
      return res.status(400).json({ error: 'Invite already sent and pending' });
    }

    const invite = await GroupInvite.create({
      groupId: group._id,
      invitedUserId: invitedUser._id,
      invitedById: user._id,
      status: 'pending',
    });

    try {
      await Notification.create({
        userId: invitedUser._id,
        actorId: user._id,
        type: 'group_invite',
        extra: JSON.stringify({
          groupId: String(group._id),
          groupName: group.groupName || 'Group',
          inviteId: String(invite._id),
        }),
      });
    } catch (err) {
      console.error('Create group invite notification error:', err.message);
    }

    return res.json({
      success: true,
      message: 'Invite sent successfully',
      invitedUser: toPublicUser(invitedUser),
      group: mapGroup(group, user._id, await getMemberCount(group._id)),
    });
  } catch (error) {
    console.error('Invite user to group error:', error);
    return res.status(500).json({ error: 'Failed to invite user', details: error.message });
  }
};

export const getGroupInvitesSent = async (req, res) => {
  try {
    await ensureInvitesTable();
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admins can view invites sent' });

    const invites = await GroupInvite.find({
      groupId: group._id,
      invitedById: user._id,
      status: 'pending',
    })
      .populate('invitedUserId', USER_ATTRS.join(' '))
      .sort({ created_at: -1 })
      .lean();

    return res.json({
      success: true,
      invites: invites.map((inv) => ({
        id: inv._id,
        invitedUserId: inv.invitedUserId?._id || inv.invitedUserId,
        user: inv.invitedUserId ? toPublicUser({ ...inv.invitedUserId, id: inv.invitedUserId._id }) : null,
      })),
    });
  } catch (error) {
    console.error('Get group invites sent error:', error);
    return res.status(500).json({ error: 'Failed to fetch invites sent', details: error.message });
  }
};

export const getMyGroupInvites = async (req, res) => {
  try {
    await ensureInvitesTable();
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const invites = await GroupInvite.find({ invitedUserId: user._id, status: 'pending' })
      .populate('groupId')
      .populate('invitedById', USER_ATTRS.join(' '))
      .sort({ created_at: -1 })
      .lean();

    return res.json({
      success: true,
      invites: invites.map((inv) => ({
        id: inv._id,
        _id: inv._id,
        status: inv.status,
        invitedAt: inv.createdAt || inv.created_at,
        group: inv.groupId ? mapGroup(inv.groupId, user._id) : null,
        invitedBy: inv.invitedById ? toPublicUser({ ...inv.invitedById, id: inv.invitedById._id }) : null,
      })),
    });
  } catch (error) {
    console.error('Get my group invites error:', error);
    return res.status(500).json({ error: 'Failed to fetch invites', details: error.message });
  }
};

export const respondToGroupInvite = async (req, res) => {
  try {
    await ensureInvitesTable();
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inviteId = req.params.inviteId;
    if (!inviteId) return res.status(400).json({ error: 'Invalid invite ID' });

    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const invite = await GroupInvite.findById(inviteId);
    if (!invite || String(invite.invitedUserId) !== String(user._id)) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite already handled' });
    }

    const group = await getGroupById(invite.groupId);
    if (!group) return res.status(404).json({ error: 'Group no longer exists' });

    if (action === 'accept') {
      const alreadyMember = await isGroupMember(group._id, user._id);
      if (!alreadyMember) {
        await ConversationParticipant.create({
          conversationId: group._id,
          userId: user._id,
        });
      }
      await GroupInvite.updateOne({ _id: invite._id }, { status: 'accepted', respondedAt: new Date() });
      const notif = await Notification.findOne({
        userId: user._id,
        type: 'group_invite',
        extra: { $regex: String(invite._id) },
      });
      if (notif) {
        try {
          const extra = JSON.parse(notif.extra || '{}');
          extra.status = 'accepted';
          notif.extra = JSON.stringify(extra);
          notif.readAt = notif.readAt || new Date();
          await notif.save();
        } catch (e) {}
      }
      return res.json({
        success: true,
        message: 'Invite accepted',
        group: mapGroup(group, user._id, await getMemberCount(group._id)),
      });
    }

    await GroupInvite.updateOne({ _id: invite._id }, { status: 'rejected', respondedAt: new Date() });
    await Notification.deleteMany({
      userId: user._id,
      type: 'group_invite',
      extra: { $regex: String(invite._id) },
    });
    return res.json({ success: true, message: 'Invite rejected' });
  } catch (error) {
    console.error('Respond to group invite error:', error);
    return res.status(500).json({ error: 'Failed to respond to invite', details: error.message });
  }
};

export const getGroupJoinRequests = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admins can view join requests' });

    const requests = await GroupJoinRequest.find({ groupId: group._id, status: 'pending' })
      .populate('userId', USER_ATTRS.join(' '))
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      requests: requests.map((r) => ({
        id: r._id,
        _id: r._id,
        user: r.userId ? toPublicUser({ ...r.userId, id: r.userId._id }) : null,
        requestedAt: r.createdAt || r.created_at,
      })),
    });
  } catch (error) {
    console.error('Get group join requests error:', error);
    return res.status(500).json({ error: 'Failed to fetch join requests', details: error.message });
  }
};

export const respondToJoinRequest = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    const requestId = req.params.requestId;
    if (!groupId || !requestId) return res.status(400).json({ error: 'Invalid group ID or request ID' });

    const action = String(req.body?.action || '').trim().toLowerCase();
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admins can respond to join requests' });

    const joinReq = await GroupJoinRequest.findOne({ _id: requestId, groupId: group._id });
    if (!joinReq) return res.status(404).json({ error: 'Join request not found' });
    if (joinReq.status !== 'pending') {
      return res.status(400).json({ error: 'Join request already handled' });
    }

    const reqUserId = joinReq.userId?._id || joinReq.userId;
    const groupName = group.groupName || 'Group';

    if (action === 'accept') {
      const alreadyMember = await isGroupMember(group._id, reqUserId);
      if (!alreadyMember) {
        await ConversationParticipant.create({
          conversationId: group._id,
          userId: reqUserId,
        });
      }
      await GroupJoinRequest.updateOne(
        { _id: requestId },
        { status: 'accepted', respondedAt: new Date(), respondedById: user._id }
      );
      const joinReqNotif = await Notification.findOne({
        userId: user._id,
        type: 'group_join_request',
        extra: { $regex: String(requestId) },
      });
      if (joinReqNotif) {
        try {
          const extra = JSON.parse(joinReqNotif.extra || '{}');
          extra.status = 'accepted';
          joinReqNotif.extra = JSON.stringify(extra);
          joinReqNotif.readAt = joinReqNotif.readAt || new Date();
          await joinReqNotif.save();
        } catch (e) {}
      }
      if (reqUserId && String(reqUserId) !== String(user._id)) {
        try {
          await Notification.create({
            userId: reqUserId,
            actorId: user._id,
            type: 'group_join_accepted',
            extra: JSON.stringify({ groupId: String(group._id), groupName }),
          });
        } catch (err) {
          console.error('Create join accepted notification error:', err.message);
        }
      }
      return res.json({ success: true, message: 'Join request accepted' });
    }

    await GroupJoinRequest.updateOne(
      { _id: requestId },
      { status: 'rejected', respondedAt: new Date(), respondedById: user._id }
    );
    await Notification.deleteMany({
      userId: user._id,
      type: 'group_join_request',
      extra: { $regex: String(requestId) },
    });
    if (reqUserId && String(reqUserId) !== String(user._id)) {
      try {
        await Notification.create({
          userId: reqUserId,
          actorId: user._id,
          type: 'group_join_rejected',
          extra: JSON.stringify({ groupId: String(group._id), groupName }),
        });
      } catch (err) {
        console.error('Create join rejected notification error:', err.message);
      }
    }
    return res.json({ success: true, message: 'Join request rejected' });
  } catch (error) {
    console.error('Respond to join request error:', error);
    return res.status(500).json({ error: 'Failed to respond to join request', details: error.message });
  }
};

/** Respond to join request by requester userId (for notifications that have actorId but not requestId) */
export const respondToJoinRequestByUser = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    const { userId: requesterUserId, action: actionParam } = req.body || {};
    if (!groupId || !requesterUserId) return res.status(400).json({ error: 'Group ID and requester userId required' });

    const action = String(actionParam || '').trim().toLowerCase();
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be accept or reject' });
    }

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admins can respond to join requests' });

    const joinReq = await GroupJoinRequest.findOne({ groupId: group._id, userId: requesterUserId, status: 'pending' });
    if (!joinReq) return res.status(404).json({ error: 'Join request not found or already handled' });

    const reqUserId = joinReq.userId?._id || joinReq.userId;
    const groupName = group.groupName || 'Group';

    if (action === 'accept') {
      const alreadyMember = await isGroupMember(group._id, reqUserId);
      if (!alreadyMember) {
        await ConversationParticipant.create({
          conversationId: group._id,
          userId: reqUserId,
        });
      }
      await GroupJoinRequest.updateOne(
        { _id: joinReq._id },
        { status: 'accepted', respondedAt: new Date(), respondedById: user._id }
      );
      const joinReqNotif = await Notification.findOne({
        userId: user._id,
        type: 'group_join_request',
        extra: { $regex: String(joinReq._id) },
      });
      if (joinReqNotif) {
        try {
          const extra = JSON.parse(joinReqNotif.extra || '{}');
          extra.status = 'accepted';
          joinReqNotif.extra = JSON.stringify(extra);
          joinReqNotif.readAt = joinReqNotif.readAt || new Date();
          await joinReqNotif.save();
        } catch (e) {}
      }
      if (reqUserId && String(reqUserId) !== String(user._id)) {
        try {
          await Notification.create({
            userId: reqUserId,
            actorId: user._id,
            type: 'group_join_accepted',
            extra: JSON.stringify({ groupId: String(group._id), groupName }),
          });
        } catch (err) {
          console.error('Create join accepted notification error:', err.message);
        }
      }
      return res.json({ success: true, message: 'Join request accepted' });
    }

    await GroupJoinRequest.updateOne(
      { _id: joinReq._id },
      { status: 'rejected', respondedAt: new Date(), respondedById: user._id }
    );
    await Notification.deleteMany({
      userId: user._id,
      type: 'group_join_request',
      extra: { $regex: String(joinReq._id) },
    });
    if (reqUserId && String(reqUserId) !== String(user._id)) {
      try {
        await Notification.create({
          userId: reqUserId,
          actorId: user._id,
          type: 'group_join_rejected',
          extra: JSON.stringify({ groupId: String(group._id), groupName }),
        });
      } catch (err) {
        console.error('Create join rejected notification error:', err.message);
      }
    }
    return res.json({ success: true, message: 'Join request rejected' });
  } catch (error) {
    console.error('Respond to join request by user error:', error);
    return res.status(500).json({ error: 'Failed to respond to join request', details: error.message });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    const memberId = req.body?.userId;
    if (!groupId || !memberId) return res.status(400).json({ error: 'Invalid group ID or user ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isAdmin = await ensureAdmin(group, user._id);
    if (!isAdmin) return res.status(403).json({ error: 'Only group admin can remove members' });
    if (String(memberId) === String(group.requestedById)) {
      return res.status(400).json({ error: 'Admin cannot be removed. Use leave group to transfer ownership.' });
    }

    await ConversationParticipant.deleteOne({ conversationId: group._id, userId: memberId });

    const memberCount = await getMemberCount(group._id);
    return res.json({
      success: true,
      message: 'Member removed successfully',
      group: mapGroup(group, user._id, memberCount),
    });
  } catch (error) {
    console.error('Remove group member error:', error);
    return res.status(500).json({ error: 'Failed to remove member', details: error.message });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const memberRow = await ConversationParticipant.findOne({
      conversationId: group._id,
      userId: user._id,
    });
    if (!memberRow) return res.status(400).json({ error: 'You are not a member of this group' });

    const isAdmin = String(group.requestedById) === String(user._id);
    await ConversationParticipant.deleteOne({ _id: memberRow._id });

    const remainingMembers = await ConversationParticipant.find({ conversationId: group._id }).select('userId').lean();

    if (remainingMembers.length === 0) {
      await Conversation.deleteOne({ _id: group._id });
      return res.json({ success: true, message: 'You left the group. Group deleted because no members remain.' });
    }

    if (isAdmin) {
      await Conversation.updateOne({ _id: group._id }, { requestedById: remainingMembers[0].userId });
    }

    return res.json({ success: true, message: 'You left the group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    return res.status(500).json({ error: 'Failed to leave group', details: error.message });
  }
};

export const listGroupMembers = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = await isGroupMember(group._id, user._id);
    if (!isMember) return res.status(403).json({ error: 'Only members can view group members' });

    const participantRows = await ConversationParticipant.find({ conversationId: group._id }).select('userId').lean();
    const memberIds = participantRows.map((r) => r.userId).filter(Boolean);
    const members = memberIds.length
      ? await User.find({ _id: { $in: memberIds } }).select(USER_ATTRS.join(' ')).sort({ name: 1 }).lean()
      : [];

    return res.json({
      success: true,
      members: members.map((m) => ({
        ...toPublicUser({ ...m, id: m._id }),
        isAdmin: String(m._id) === String(group.requestedById),
      })),
      groupId: group._id,
    });
  } catch (error) {
    console.error('List group members error:', error);
    return res.status(500).json({ error: 'Failed to fetch members', details: error.message });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = await isGroupMember(group._id, user._id);
    if (!isMember) return res.status(403).json({ error: 'Only members can send messages' });

    const { content, media } = req.body || {};
    const text = typeof content === 'string' ? content.trim() : '';
    const mediaType = media?.type || null;
    const mediaUrl = media?.url || null;

    if (!text && !mediaUrl) {
      return res.status(400).json({ error: 'Message content or media is required' });
    }
    if (mediaType && !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ error: 'Invalid media type. Use image or video.' });
    }

    let sentimentFields = {};
    if (text) {
      const { analyzeSentiment } = await import('../utils/sentimentAnalysis.js');
      const sentiment = await analyzeSentiment(text);
      sentimentFields = {
        SentimentLabel: sentiment.sentiment_label,
        Confidence: sentiment.confidence,
      };
    }

    const message = await Message.create({
      conversationId: group._id,
      senderId: user._id,
      content: text || null,
      mediaType: mediaType || null,
      mediaUrl: mediaUrl || null,
      deliveryStatus: 'sent',
      ...sentimentFields,
    });

    await MessageReadBy.create({ messageId: message._id, userId: user._id, readAt: new Date() }).catch(() => {});

    await Conversation.updateOne(
      { _id: group._id },
      { lastMessageId: message._id, lastMessageAt: new Date() }
    );

    const populated = await Message.findById(message._id).populate('senderId', USER_ATTRS.join(' ')).lean();

    return res.status(201).json({
      success: true,
      message: toPublicMessage(populated, populated?.senderId ? { ...populated.senderId, id: populated.senderId._id } : null),
    });
  } catch (error) {
    console.error('Send group message error:', error);
    return res.status(500).json({ error: 'Failed to send message', details: error.message });
  }
};

export const deleteGroupMessage = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    const messageId = req.params.messageId;
    if (!groupId || !messageId) return res.status(400).json({ error: 'Invalid group or message ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = await isGroupMember(group._id, user._id);
    if (!isMember) return res.status(403).json({ error: 'Only members can delete messages' });

    const message = await Message.findOne({
      _id: messageId,
      conversationId: group._id,
      isDeleted: false,
    });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    if (String(message.senderId) !== String(user._id)) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await Message.updateOne({ _id: message._id }, { isDeleted: true });
    return res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete group message error:', error);
    return res.status(500).json({ error: 'Failed to delete message', details: error.message });
  }
};

export const getGroupMessages = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const groupId = req.params.groupId;
    const page = Math.max(1, parsePositiveInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parsePositiveInt(req.query.limit) || 50));
    if (!groupId) return res.status(400).json({ error: 'Invalid group ID' });

    const group = await getGroupById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = await isGroupMember(group._id, user._id);
    if (!isMember) return res.status(403).json({ error: 'Only members can view messages' });

    const skip = (page - 1) * limit;
    const messages = await Message.find({ conversationId: group._id, isDeleted: false })
      .populate('senderId', USER_ATTRS.join(' '))
      .sort({ created_at: -1 })
      .limit(limit)
      .skip(skip)
      .lean();
    const count = await Message.countDocuments({ conversationId: group._id, isDeleted: false });

    const allMsgIds = await Message.find({ conversationId: group._id, isDeleted: false }).select('_id').lean();
    const existingRead = await MessageReadBy.find({ userId: user._id, messageId: { $in: allMsgIds.map((m) => m._id) } }).select('messageId').lean();
    const readSet = new Set(existingRead.map((r) => String(r.messageId)));
    const toMarkRead = allMsgIds.filter((m) => !readSet.has(String(m._id)));
    if (toMarkRead.length > 0) {
      await MessageReadBy.insertMany(toMarkRead.map((m) => ({ messageId: m._id, userId: user._id, readAt: new Date() }))).catch(() => {});
    }

    return res.json({
      success: true,
      messages: messages
        .map((m) => toPublicMessage(m, m.senderId ? { ...m.senderId, id: m.senderId._id } : null))
        .reverse(),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get group messages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
};

export const searchUsersForInvite = async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, users: [] });

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      _id: { $ne: user._id },
      $or: [{ username: re }, { name: re }],
    })
      .select(USER_ATTRS.join(' '))
      .limit(20)
      .sort({ name: 1 })
      .lean();

    return res.json({
      success: true,
      users: users.map((u) => toPublicUser({ ...u, id: u._id })),
    });
  } catch (error) {
    console.error('Search users for invite error:', error);
    return res.status(500).json({ error: 'Failed to search users', details: error.message });
  }
};
