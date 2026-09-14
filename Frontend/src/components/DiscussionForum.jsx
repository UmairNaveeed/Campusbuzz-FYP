import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Modal from './Modal';
import FormInput from './FormInput';
import {
  ArrowLeft,
  Bell,
  Camera,
  Check,
  Globe,
  Hash,
  Home,
  Image,
  List,
  Lock,
  LogOut,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  PlusCircle,
  Settings,
  Trash2,
  UserCircle,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useForumNotificationCount } from '../hooks/useForumNotificationCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import {
  getDiscussionGroups,
  createDiscussionGroup,
  updateDiscussionGroup,
  deleteDiscussionGroup,
  joinDiscussionGroup,
  leaveDiscussionGroup,
  inviteUserToDiscussionGroup,
  removeMemberFromDiscussionGroup,
  getDiscussionGroupMembers,
  getDiscussionMessages,
  sendDiscussionMessage,
  searchDiscussionUsers,
  getGroupInvitesSent,
  respondDiscussionInvite,
  respondToJoinRequest,
  respondToJoinRequestByUser,
  getForumNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../services/api';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from './ui/sidebar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './ui/navigation-menu';

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const diff = new Date() - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (Number.isNaN(d.getTime())) return '';
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString();
}

function mapForumNotificationToUI(n) {
  const actor = n.actor || {};
  const userName = actor.name || 'Someone';
  const actorId = actor._id || actor.id;
  let extraGroupName = '';
  let extraGroupId = '';
  let requestId = '';
  let inviteId = '';
  let status = '';
  try {
    if (n.extra) {
      const parsed = JSON.parse(n.extra);
      extraGroupName = parsed.groupName || '';
      extraGroupId = parsed.groupId || '';
      requestId = parsed.requestId || '';
      inviteId = parsed.inviteId || '';
      status = parsed.status || '';
    }
  } catch (_) {}
  let content = '';
  switch (n.type) {
    case 'group_join_request': content = extraGroupName ? `requested to join "${extraGroupName}"` : 'requested to join your group'; break;
    case 'group_join_accepted': content = extraGroupName ? `accepted your request to join "${extraGroupName}"` : 'accepted your join request'; break;
    case 'group_join_rejected': content = extraGroupName ? `rejected your request to join "${extraGroupName}"` : 'rejected your join request'; break;
    case 'group_invite': content = extraGroupName ? `invited you to join "${extraGroupName}"` : 'invited you to join a group'; break;
    default: content = 'interacted with your group';
  }
  return {
    id: String(n.id || n._id),
    type: n.type || 'group_join_request',
    user: userName,
    content,
    time: formatTimeAgo(n.created_at || n.createdAt),
    read: !!n.readAt,
    groupId: extraGroupId || null,
    requestId: requestId || null,
    inviteId: inviteId || null,
    actorId: actorId ? String(actorId) : null,
    status: status || null,
  };
}

const forumNotifIcons = { group_join_request: UserPlus, group_join_accepted: UserPlus, group_join_rejected: UserMinus, group_invite: UserPlus };
const forumNotifColors = { group_join_request: 'text-[#7C3AED] bg-[#7C3AED]/10', group_join_accepted: 'text-[#10B981] bg-[#10B981]/10', group_join_rejected: 'text-[#EF4444] bg-[#EF4444]/10', group_invite: 'text-[#3B82F6] bg-[#3B82F6]/10' };

export default function DiscussionForum() {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { groupId: urlGroupId } = useParams();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPrivacy, setGroupPrivacy] = useState('public');
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [messageMedia, setMessageMedia] = useState(null); // { type: 'image'|'video', url: dataUrl }
  const [groups, setGroups] = useState([]);
  const [groupMessages, setGroupMessages] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const [sending, setSending] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');
  const [editGroupPrivacy, setEditGroupPrivacy] = useState('public');
  const [editGroupPhoto, setEditGroupPhoto] = useState(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState([]);
  const [inviteSentIds, setInviteSentIds] = useState(new Set());
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [groupForModal, setGroupForModal] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [fullScreenMedia, setFullScreenMedia] = useState(null); // { url, type } or null
  const [forumNotifsModalOpen, setForumNotifsModalOpen] = useState(false);
  const [forumNotifs, setForumNotifs] = useState([]);
  const [loadingForumNotifs, setLoadingForumNotifs] = useState(false);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();

  const { count: forumCount, refetch: refetchForumCount } = useForumMessageCount();
  const { count: forumNotificationCount, refetch: refetchForumNotificationCount } = useForumNotificationCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const mapGroup = useCallback((g) => ({
    ...g,
    joined: !!g.joined,
    privacy: g.isPrivate ? 'private' : 'public',
    members: g.memberCount ?? 0,
    messageCount: g.messageCount ?? 0,
    unreadCount: g.unreadCount ?? 0,
    lastActivity: g.updatedAt ? formatMessageTime(g.updatedAt) : '—',
    isAdmin: !!g.isAdmin,
    hasPendingRequest: !!g.hasPendingRequest,
  }), []);

  const refetchGroups = useCallback(async () => {
    try {
      const data = await getDiscussionGroups();
      const my = (data?.myGroups || []).map((g) => ({ ...g, joined: true }));
      const pub = (data?.publicGroups || []).map((g) => ({ ...g, joined: false }));
      setGroups([...my, ...pub].map(mapGroup));
    } catch {
      setGroups([]);
    }
  }, [mapGroup]);

  useEffect(() => {
    setLoadingGroups(true);
    refetchGroups().finally(() => setLoadingGroups(false));
  }, [refetchGroups]);


  useEffect(() => {
    if (urlGroupId && groups.length > 0) {
      const g = groups.find((gr) => String(gr.id) === String(urlGroupId) || String(gr._id) === String(urlGroupId));
      if (g && g.joined) setSelectedGroup(g);
    }
  }, [urlGroupId, groups]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      setGroupMessages([]);
      setLoadingMessages(false);
      return;
    }
    let cancelled = false;
    setGroupMessages([]);
    setLoadingMessages(true);
    getDiscussionMessages(selectedGroup.id)
      .then((data) => {
        if (cancelled) return;
        const list = (data?.messages || []).map((m) => ({
          id: m.id || m._id,
          user: m.sender?.name || 'User',
          username: m.sender?.username,
          text: m.content || '',
          media: m.media || (m.mediaUrl ? { type: m.mediaType || 'image', url: m.mediaUrl } : null),
          time: formatMessageTime(m.created_at || m.createdAt),
          isMe: m.sender?.firebaseId === firebaseUser?.uid,
        }));
        setGroupMessages(list);
      })
      .catch(() => {
        if (!cancelled) setGroupMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
        refetchForumCount();
        refetchGroups();
      });
    return () => { cancelled = true; };
  }, [selectedGroup?.id, firebaseUser?.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [groupMessages]);

  useEffect(() => {
    if (!forumNotifsModalOpen) return;
    let cancelled = false;
    setLoadingForumNotifs(true);
    refetchGroups();
    getForumNotifications()
      .then((data) => {
        if (cancelled) return;
        setForumNotifs((data?.notifications || []).map(mapForumNotificationToUI));
      })
      .catch(() => { if (!cancelled) setForumNotifs([]); })
      .finally(() => { if (!cancelled) setLoadingForumNotifs(false); });
    return () => { cancelled = true; };
  }, [forumNotifsModalOpen]);

  const activeGroupForModal = groupForModal || selectedGroup;

  useEffect(() => {
    if (!activeGroupForModal?.id || (!membersModalOpen && !inviteModalOpen)) return;
    setLoadingMembers(true);
    getDiscussionGroupMembers(activeGroupForModal.id)
      .then((data) => setGroupMembers(data?.members || []))
      .catch(() => setGroupMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [groupForModal?.id, selectedGroup?.id, membersModalOpen, inviteModalOpen]);

  useEffect(() => {
    if (!inviteModalOpen || !activeGroupForModal?.id) return;
    getGroupInvitesSent(activeGroupForModal.id)
      .then((data) => {
        const ids = new Set((data?.invites || []).map((inv) => String(inv.invitedUserId || inv.user?.id || inv.user?._id)).filter(Boolean));
        setInviteSentIds(ids);
      })
      .catch(() => setInviteSentIds(new Set()));
  }, [inviteModalOpen, activeGroupForModal?.id]);

  useEffect(() => {
    if (!inviteSearch.trim()) {
      setInviteResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await searchDiscussionUsers(inviteSearch.trim());
        const members = groupMembers.map((m) => m.id || m._id);
        const filtered = (data?.users || []).filter((u) => !members.includes(u.id || u._id));
        setInviteResults(filtered);
      } catch {
        setInviteResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [inviteSearch, groupMembers]);

  const filtered = filter === 'all' ? groups : groups.filter((g) => g.joined);

  // Real-time refresh of group list (including message counts) when viewing groups list
  useEffect(() => {
    if (selectedGroup) return;
    const interval = setInterval(refetchGroups, 10000);
    return () => clearInterval(interval);
  }, [selectedGroup, refetchGroups]);

  const handleCreateGroup = async () => {
    const name = (groupName || '').trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      await createDiscussionGroup({ name, description: groupDescription.trim(), isPrivate: groupPrivacy === 'private', groupPhoto: groupPhoto || undefined });
      await refetchGroups();
      setModalOpen(false);
      setGroupName('');
      setGroupDescription('');
      setGroupPrivacy('public');
      setGroupPhoto(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create group');
    }
    setCreating(false);
  };

  const handleEditGroup = async () => {
    if (!activeGroupForModal?.id || !activeGroupForModal?.isAdmin) return;
    const name = (editGroupName || '').trim();
    if (!name) return;
    setActionLoading({ edit: true });
    try {
      await updateDiscussionGroup(activeGroupForModal.id, {
        name,
        description: editGroupDescription.trim(),
        isPrivate: editGroupPrivacy === 'private',
        groupPhoto: editGroupPhoto || undefined,
      });
      await refetchGroups();
      setSelectedGroup((prev) => (prev ? { ...prev, name, description: editGroupDescription.trim(), isPrivate: editGroupPrivacy === 'private' } : null));
      setEditModalOpen(false);
      setGroupForModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update group');
    }
    setActionLoading({ edit: false });
  };

  const handleDeleteGroup = async () => {
    if (!activeGroupForModal?.id || !activeGroupForModal?.isAdmin) return;
    if (!confirm('Delete this group? All messages will be lost.')) return;
    setActionLoading({ delete: true });
    try {
      await deleteDiscussionGroup(activeGroupForModal.id);
      await refetchGroups();
      setSelectedGroup(null);
      setGroupForModal(null);
      setEditModalOpen(false);
      navigate('/discussion');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete group');
    }
    setActionLoading({ delete: false });
  };

  const handleJoinGroup = async (groupId, isPrivate = false) => {
    if (joiningId) return;
    setJoiningId(groupId);
    try {
      const data = await joinDiscussionGroup(groupId);
      await refetchGroups();
      if (data?.requested) {
        alert('Join request sent. The admin will review it.');
      }
    } catch (err) {
      alert(err.response?.data?.error || (isPrivate ? 'Request already sent or failed.' : 'Cannot join.'));
    }
    setJoiningId(null);
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup?.id) return;
    if (!confirm('Leave this group?')) return;
    setActionLoading({ leave: true });
    try {
      await leaveDiscussionGroup(selectedGroup.id);
      await refetchGroups();
      setSelectedGroup(null);
      navigate('/discussion');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to leave group');
    }
    setActionLoading({ leave: false });
  };

  const handleInviteUser = async (user) => {
    if (!activeGroupForModal?.id || !activeGroupForModal?.isAdmin) return;
    const uid = user.id || user._id;
    setActionLoading({ invite: uid });
    try {
      await inviteUserToDiscussionGroup(activeGroupForModal.id, { userId: uid });
      setInviteSentIds((prev) => new Set([...prev, String(uid)]));
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to invite user';
      if (msg.toLowerCase().includes('already sent')) {
        setInviteSentIds((prev) => new Set([...prev, String(uid)]));
      } else {
        alert(msg);
      }
    }
    setActionLoading({ invite: null });
  };

  const handleRemoveMember = async (member) => {
    if (!activeGroupForModal?.id || !activeGroupForModal?.isAdmin) return;
    if (member.isAdmin) return;
    if (!confirm(`Remove ${member.name} from the group?`)) return;
    setActionLoading({ remove: member.id });
    try {
      await removeMemberFromDiscussionGroup(activeGroupForModal.id, member.id || member._id);
      setGroupMembers((prev) => prev.filter((m) => (m.id || m._id) !== (member.id || member._id)));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to remove member');
    }
    setActionLoading({ remove: null });
  };

  const handleMediaSelect = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) return;
    if (isVideo && file.size > 15 * 1024 * 1024) {
      alert('Video must be under 15MB. Please choose a shorter or smaller video.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setMessageMedia({ type: isImage ? 'image' : 'video', url: reader.result });
    reader.readAsDataURL(file);
  };

  const handleSendGroupMessage = async () => {
    const text = (messageText || '').trim();
    if ((!text && !messageMedia) || !selectedGroup?.id || sending) return;
    setSending(true);
    try {
      const payload = {
        content: text || undefined,
        media: messageMedia ? { type: messageMedia.type, url: messageMedia.url } : undefined,
      };
      const data = await sendDiscussionMessage(selectedGroup.id, payload);
      const m = data?.message;
      setGroupMessages((prev) => [
        ...prev,
        {
          id: m?.id || m?._id,
          user: displayName,
          text: m?.content || text,
          media: m?.media || (messageMedia ? { type: messageMedia.type, url: messageMedia.url } : null),
          time: 'Just now',
          isMe: true,
        },
      ]);
      setMessageText('');
      setMessageMedia(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      refetchForumCount();
      refetchGroups();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    }
    setSending(false);
  };

  const openEditModal = (group) => {
    const g = group || selectedGroup;
    setEditGroupName(g?.name || '');
    setEditGroupDescription(g?.description || '');
    setEditGroupPrivacy(g?.isPrivate ? 'private' : 'public');
    setEditGroupPhoto(null);
    if (group) setGroupForModal(group);
    setEditModalOpen(true);
  };

  const handleRespondInviteFromNotif = async (notif, action) => {
    const inviteId = notif.inviteId;
    if (!inviteId) return;
    const key = `notifInvite-${notif.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await respondDiscussionInvite(inviteId, action);
      if (action === 'reject') {
        setForumNotifs((prev) => prev.filter((x) => x.id !== notif.id));
      } else {
        const data = await getForumNotifications();
        setForumNotifs((data?.notifications || []).map(mapForumNotificationToUI));
      }
      refetchGroups();
      refetchForumNotificationCount();
      window.dispatchEvent(new Event('forumNotificationCountUpdated'));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to respond');
    }
    setActionLoading((prev) => ({ ...prev, [key]: false }));
  };

  const handleRespondJoinRequestFromNotif = async (notif, action) => {
    const groupId = notif.groupId;
    if (!groupId) return;
    const key = `notifJoinReq-${notif.id}`;
    setActionLoading((prev) => ({ ...prev, [key]: true }));
    try {
      if (notif.requestId) {
        await respondToJoinRequest(groupId, notif.requestId, action);
      } else if (notif.actorId) {
        await respondToJoinRequestByUser(groupId, notif.actorId, action);
      } else {
        alert('Cannot respond: missing request info');
        setActionLoading((prev) => ({ ...prev, [key]: false }));
        return;
      }
      if (action === 'reject') {
        setForumNotifs((prev) => prev.filter((x) => x.id !== notif.id));
      } else {
        const data = await getForumNotifications();
        setForumNotifs((data?.notifications || []).map(mapForumNotificationToUI));
      }
      refetchGroups();
      refetchForumNotificationCount();
      window.dispatchEvent(new Event('forumNotificationCountUpdated'));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to respond');
    }
    setActionLoading((prev) => ({ ...prev, [key]: false }));
  };

  const markForumOneRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setForumNotifs((prev) => prev.map((x) => (x.id === String(id) ? { ...x, read: true } : x)));
      refetchForumNotificationCount();
      window.dispatchEvent(new Event('forumNotificationCountUpdated'));
    } catch (_) {}
  };

  const handleDeleteForumNotification = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setForumNotifs((prev) => prev.filter((x) => x.id !== String(id)));
      refetchForumNotificationCount();
      window.dispatchEvent(new Event('forumNotificationCountUpdated'));
    } catch (_) {}
  };

  const markForumAllRead = async () => {
    try {
      await markAllNotificationsAsRead('forum');
      setForumNotifs((n) => n.map((x) => ({ ...x, read: true })));
      refetchForumNotificationCount();
      window.dispatchEvent(new Event('forumNotificationCountUpdated'));
    } catch (_) {}
  };

  const handleForumNotificationClick = (n) => {
    if (n.groupId) {
      const g = groups.find((gr) => String(gr.id) === String(n.groupId) || String(gr._id) === String(n.groupId));
      if (g?.joined) {
        setSelectedGroup(g);
        navigate(`/discussion/${n.groupId}`);
      } else {
        navigate('/discussion');
      }
    }
    setForumNotifsModalOpen(false);
    if (!n.read) markForumOneRead(n.id);
  };

  const menuItems = [
    { label: 'Home Feed', icon: Home, to: '/home' },
    { label: 'Create Post', icon: PlusCircle, to: '/create-post' },
    { label: 'Profile', icon: UserCircle, to: '/profile' },
    { label: 'Notifications', icon: Bell, to: '/notifications' },
    { label: 'Messages', icon: Mail, to: '/messages' },
    { label: 'Trends', icon: Hash, to: '/explore' },
    { label: 'Lists', icon: List, to: '/lists' },
    { label: 'Forums', icon: MessageSquare, to: '/discussion' },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarContent className="bg-sidebar px-2 py-3">
          <Link to="/home" className="flex items-center gap-2 px-2 pb-3 text-white text-xl font-bold rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            <CampusBuzzIcon className="h-6 w-6 shrink-0 text-white" fill="white" />
            CampusBuzz
          </Link>
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase text-[11px] tracking-[0.12em] text-white/60">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  if (item.label === 'Create Post') {
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          onClick={openCreatePost}
                          className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={item.label === 'Forums'} className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10">
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {(item.label === 'Forums' && forumCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {forumCount > 99 ? '99+' : forumCount}
                            </span>
                          )}
                          {(item.label === 'Messages' && messageSidebarCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {messageSidebarCount > 99 ? '99+' : messageSidebarCount}
                            </span>
                          )}
                          {(item.label === 'Notifications' && notificationCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
          <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">{initial}</div>
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <div className="flex items-center gap-1">
              <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="h-9 gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">{initial}</span>
                      {displayName}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="min-w-[180px]">
                      <ul className="grid gap-1 p-2">
                        <li><NavigationMenuLink asChild><Link to="/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Profile</Link></NavigationMenuLink></li>
                        <li><NavigationMenuLink asChild><Link to="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Settings</Link></NavigationMenuLink></li>
                        <li><button type="button" onClick={async () => { await logout(); navigate('/login', { replace: true }); }} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">Logout</button></li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 h-[calc(100vh-57px)]">
          {/* Groups list - hidden when chat is open */}
          <div className={`overflow-y-auto p-6 ${selectedGroup ? 'hidden' : 'flex-1'}`}>
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-[#111827]">Discussion Forums</h1>
                <div className="flex items-center gap-2">
                  <button onClick={() => setForumNotifsModalOpen(true)} className="relative flex items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
                    <Bell size={16} />
                    {forumNotificationCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                        {forumNotificationCount > 99 ? '99+' : forumNotificationCount}
                      </span>
                    )}
                  </button>
                  <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity">
                    <Plus size={16} /> Create Group
                  </button>
                </div>
              </div>

              <div className="flex gap-2 mb-6">
                {['all', 'joined'].map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${filter === f ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white' : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'}`}>
                    {f === 'all' ? 'All Groups' : 'My Groups'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loadingGroups ? (
                  <p className="text-[#6B7280] col-span-2 py-4">Loading groups...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-[#6B7280] col-span-2 py-4">No groups yet. Create one to get started.</p>
                ) : (
                  filtered.map((group) => (
                    <div key={group.id || group._id} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm hover:shadow-md transition-shadow relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {group.privacy === 'private' ? <Lock size={14} className="text-[#F59E0B]" /> : <Globe size={14} className="text-[#10B981]" />}
                          <span className="text-xs text-[#6B7280] capitalize">{group.privacy}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[#9CA3AF]">{group.lastActivity}</span>
                          {group.joined && group.unreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center shrink-0">
                              {group.unreadCount > 99 ? '99+' : group.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-[#111827] mb-1">{group.name}</h3>
                      {group.description ? (
                        <p className="text-sm text-[#6B7280] line-clamp-3 mb-2">{group.description}</p>
                      ) : (
                        <p className="text-sm text-[#9CA3AF] italic mb-2">No description</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <button
                          type="button"
                          onClick={() => { if (group.joined) { setGroupForModal(group); setMembersModalOpen(true); } }}
                          className={`flex items-center gap-1 text-xs text-[#6B7280] hover:text-[#7C3AED] transition-colors ${group.joined ? 'cursor-pointer' : 'cursor-default'}`}
                          title={group.joined ? 'View members' : undefined}
                        >
                          <Users size={12} /> {group.members} members
                        </button>
                        <div className="flex gap-2">
                          {group.joined ? (
                            <>
                              <button onClick={() => { setSelectedGroup(group); navigate(`/discussion/${group.id || group._id}`); }} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#F5F3FF]">
                                <MessageSquare size={12} /> Chat
                              </button>
                              {group.isAdmin && (
                                <>
                                  <button onClick={() => { setGroupForModal(group); setInviteModalOpen(true); }} className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-[#6B7280] hover:bg-[#F3F4F6]">
                                    <UserPlus size={12} /> Invite
                                  </button>
                                  <button onClick={() => openEditModal(group)} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6]">
                                    <Settings size={12} />
                                  </button>
                                </>
                              )}
                            </>
                          ) : (
                            group.privacy === 'public' ? (
                              <button onClick={() => handleJoinGroup(group.id || group._id)} disabled={joiningId === (group.id || group._id)} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                                {joiningId === (group.id || group._id) ? 'Joining...' : 'Join Group'}
                              </button>
                            ) : (
                              <button onClick={() => handleJoinGroup(group.id || group._id, true)} disabled={joiningId === (group.id || group._id) || group.hasPendingRequest} className="rounded-xl px-4 py-1.5 text-xs font-medium disabled:opacity-70 disabled:cursor-not-allowed" style={group.hasPendingRequest ? { background: '#E5E7EB', color: '#6B7280' } : { background: 'linear-gradient(to right, #7C3AED, #8B5CF6)', color: 'white' }}>
                                {joiningId === (group.id || group._id) ? 'Sending...' : group.hasPendingRequest ? 'Request Pending' : 'Request to Join'}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Chat panel - full screen when open */}
          {selectedGroup && (
            <div className="flex-1 flex flex-col min-h-0 bg-white min-w-0 w-full">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => { setSelectedGroup(null); navigate('/discussion'); refetchGroups(); }} className="flex items-center justify-center rounded-lg p-2 hover:bg-[#F3F4F6] shrink-0" title="Back to forums">
                    <ArrowLeft size={20} className="text-[#374151]" />
                  </button>
                  <div>
                    <h2 className="font-semibold text-[#111827] truncate">{selectedGroup.name}</h2>
                    {selectedGroup.description && <p className="text-xs text-[#6B7280] truncate max-w-[200px]">{selectedGroup.description}</p>}
                  </div>
                  <span className="text-xs text-[#6B7280] shrink-0">{selectedGroup.members} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMembersModalOpen(true)} className="rounded-lg p-2 hover:bg-[#F3F4F6] text-[#6B7280]" title="Members">
                    <Users size={18} />
                  </button>
                  <button onClick={handleLeaveGroup} disabled={actionLoading.leave} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                    Leave
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 flex flex-col">
                {loadingMessages ? (
                  <div className="flex-1 flex items-center justify-center min-h-[120px]">
                    <p className="text-sm text-[#6B7280]">Loading messages...</p>
                  </div>
                ) : (
                  <>
                  {groupMessages.map((msg) => (
                    <div key={msg.id || msg.text + msg.time} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${msg.isMe ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white' : 'bg-[#F3F4F6] text-[#111827]'}`}>
                        {!msg.isMe && <p className="text-xs font-medium mb-0.5 text-[#374151]">{msg.user}</p>}
                        {msg.media?.url && (
                          <button type="button" onClick={() => setFullScreenMedia({ url: msg.media.url, type: msg.media.type || 'image' })} className="mb-2 rounded-lg overflow-hidden block w-full text-left hover:opacity-90 transition-opacity cursor-pointer">
                            {msg.media.type === 'video' ? (
                              <video src={msg.media.url} className="max-w-full max-h-48 object-contain" controls />
                            ) : (
                              <img src={msg.media.url} alt="" className="max-w-full max-h-48 object-contain" />
                            )}
                          </button>
                        )}
                        {msg.text && <p className="break-words">{msg.text}</p>}
                        <p className={`text-[10px] mt-1 ${msg.isMe ? 'text-white/70' : 'text-[#9CA3AF]'}`}>{msg.time}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div className="shrink-0 p-4 border-t border-[#E5E7EB] bg-white">
                <div className="flex gap-2">
                  <input type="file" ref={fileInputRef} accept="image/*,video/*" className="hidden" onChange={handleMediaSelect} />
                  <button onClick={() => fileInputRef.current?.click()} className="rounded-xl p-2.5 border border-[#D1D5DB] hover:bg-[#F9FAFB] text-[#6B7280]" title="Add image or video">
                    <Image size={20} />
                  </button>
                  {messageMedia && (
                    <div className="relative inline-block">
                      {messageMedia.type === 'video' ? (
                        <video src={messageMedia.url} className="h-12 w-12 rounded-lg object-cover" muted />
                      ) : (
                        <img src={messageMedia.url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      )}
                      <button onClick={() => setMessageMedia(null)} className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white p-0.5">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendGroupMessage()}
                    className="flex-1 rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                  />
                  <button onClick={handleSendGroupMessage} disabled={sending || (!messageText.trim() && !messageMedia)} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] p-2.5 text-white hover:opacity-90 disabled:opacity-50">
                    <MessageSquare size={20} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Forum Notifications Modal */}
      <Modal open={forumNotifsModalOpen} onClose={() => setForumNotifsModalOpen(false)} title="Forum Notifications" size="md">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#6B7280]">Join requests, acceptances, and rejections for your groups</p>
            {forumNotifs.some((n) => !n.read) && (
              <button onClick={markForumAllRead} className="flex items-center gap-1.5 text-sm text-[#7C3AED] hover:underline font-medium">
                <Check size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {loadingForumNotifs ? (
              <p className="text-[#6B7280] py-4">Loading...</p>
            ) : forumNotifs.length === 0 ? (
              <p className="text-[#6B7280] py-4">No forum notifications.</p>
            ) : (
              forumNotifs.map((n) => {
                const Icon = forumNotifIcons[n.type] || UserPlus;
                const colorClass = forumNotifColors[n.type] || forumNotifColors.group_join_request;
                const isJoinRequest = n.type === 'group_join_request' && (n.requestId || n.actorId) && n.status !== 'accepted';
                const isGroupInvite = n.type === 'group_invite' && n.inviteId && n.status !== 'accepted';
                const hasActionButtons = isJoinRequest || isGroupInvite;
                const isAccepted = n.status === 'accepted';
                const joinReqKey = `notifJoinReq-${n.id}`;
                const inviteKey = `notifInvite-${n.id}`;
                const actionKey = isJoinRequest ? joinReqKey : inviteKey;
                return (
                  <div
                    key={n.id}
                    className={`w-full flex items-start gap-3 rounded-2xl border p-4 transition-colors ${
                      n.read
                        ? 'border-[#E5E7EB] bg-white'
                        : 'border-[#7C3AED]/20 bg-[#F5F3FF]'
                    } ${!hasActionButtons ? 'hover:bg-[#EDE9FE] cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!hasActionButtons) handleForumNotificationClick(n);
                      else if (!n.read) markForumOneRead(n.id);
                    }}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${colorClass}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-semibold text-[#111827]">{n.user}</span>{' '}
                        <span className="text-[#6B7280]">{n.content}</span>
                        {isAccepted && <span className="ml-2 text-xs font-medium text-[#10B981]">(Accepted)</span>}
                      </p>
                      <p className="text-xs text-[#9CA3AF] mt-1">{n.time}</p>
                      {isJoinRequest && (
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRespondJoinRequestFromNotif(n, 'accept'); }}
                            disabled={actionLoading[actionKey]}
                            className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading[actionKey] ? '...' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRespondJoinRequestFromNotif(n, 'reject'); }}
                            disabled={actionLoading[actionKey]}
                            className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {isGroupInvite && (
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRespondInviteFromNotif(n, 'accept'); }}
                            disabled={actionLoading[actionKey]}
                            className="rounded-lg bg-[#10B981] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {actionLoading[actionKey] ? '...' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRespondInviteFromNotif(n, 'reject'); }}
                            disabled={actionLoading[actionKey]}
                            className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!n.read && <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6]" />}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDeleteForumNotification(e, n.id); }}
                        className="p-1 rounded-lg hover:bg-red-100 text-[#6B7280] hover:text-red-600 transition-colors"
                        title="Delete"
                        aria-label="Delete notification"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Create Group Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Discussion Group">
        <div className="space-y-4">
          <FormInput label="Group Name" placeholder="e.g. ML Research Group" value={groupName} onChange={setGroupName} />
          <FormInput label="Description" placeholder="What is this group about?" value={groupDescription} onChange={setGroupDescription} textarea />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#111827]">Privacy</label>
            <div className="flex gap-2">
              {['public', 'private'].map((p) => (
                <button key={p} onClick={() => setGroupPrivacy(p)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium capitalize ${groupPrivacy === p ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                  {p === 'public' ? <Globe size={14} /> : <Lock size={14} />} {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9CA3AF]">Public: anyone can join. Private: users request to join, admins approve.</p>
          </div>
          <button onClick={handleCreateGroup} disabled={creating || !groupName.trim()} className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {creating ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </Modal>

      {/* Edit Group Modal */}
      <Modal open={editModalOpen} onClose={() => { setEditModalOpen(false); setGroupForModal(null); }} title="Edit Group" size="sm">
        <div className="space-y-4">
          <FormInput label="Group Name" value={editGroupName} onChange={setEditGroupName} placeholder="Group name" />
          <FormInput label="Description" value={editGroupDescription} onChange={setEditGroupDescription} placeholder="What is this group about?" textarea />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#111827]">Privacy</label>
            <div className="flex gap-2">
              {['public', 'private'].map((p) => (
                <button key={p} onClick={() => setEditGroupPrivacy(p)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium capitalize ${editGroupPrivacy === p ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white' : 'bg-[#F3F4F6] text-[#6B7280]'}`}>
                  {p === 'public' ? <Globe size={14} /> : <Lock size={14} />} {p}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#9CA3AF]">Private: users request to join. Approve or reject from Forum Notifications.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleEditGroup} disabled={actionLoading.edit || !editGroupName.trim()} className="flex-1 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {actionLoading.edit ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={handleDeleteGroup} disabled={actionLoading.delete} className="rounded-xl border border-red-300 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
              {actionLoading.delete ? 'Deleting...' : 'Delete Group'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal open={inviteModalOpen} onClose={() => { setInviteModalOpen(false); setInviteSearch(''); setInviteResults([]); setInviteSentIds(new Set()); setGroupForModal(null); }} title="Invite Users" size="lg">
        <div className="space-y-4">
          <FormInput label="Search by name or username" value={inviteSearch} onChange={setInviteSearch} placeholder="Type to search..." />
          <div className="max-h-48 overflow-y-auto space-y-2">
            {inviteResults.length === 0 && inviteSearch.trim() ? (
              <p className="text-sm text-[#6B7280]">No users found</p>
            ) : (
              inviteResults.map((u) => (
                <div key={u.id || u._id} className="flex items-center justify-between py-2 border-b border-[#E5E7EB] last:border-0">
                  <div className="flex items-center gap-3">
                    {u.profilePhoto ? <img src={u.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center text-sm font-semibold text-[#7C3AED]">{(u.name || 'U')[0]}</div>}
                    <div>
                      <p className="font-medium text-[#111827]">{u.name}</p>
                      <p className="text-xs text-[#6B7280]">@{u.username}</p>
                    </div>
                  </div>
                  <button onClick={() => handleInviteUser(u)} disabled={actionLoading.invite === (u.id || u._id) || inviteSentIds.has(String(u.id || u._id))} className={`rounded-xl px-3 py-1.5 text-xs font-medium ${inviteSentIds.has(String(u.id || u._id)) ? 'bg-[#E5E7EB] text-[#6B7280] cursor-default' : 'bg-[#7C3AED] text-white hover:opacity-90'}`}>
                    {actionLoading.invite === (u.id || u._id) ? 'Inviting...' : inviteSentIds.has(String(u.id || u._id)) ? 'Invite Sent' : 'Invite'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Full-screen media overlay */}
      {fullScreenMedia && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullScreenMedia(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setFullScreenMedia(null)}
          aria-label="Close"
        >
          <button type="button" onClick={() => setFullScreenMedia(null)} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white z-10">
            <X size={24} />
          </button>
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} className="max-w-full max-h-full object-contain" controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={fullScreenMedia.url} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}

      {/* Members Modal */}
      <Modal open={membersModalOpen} onClose={() => { setMembersModalOpen(false); setGroupForModal(null); }} title={activeGroupForModal ? `${activeGroupForModal.name} – Members` : 'Group Members'} size="lg">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {loadingMembers ? (
            <p className="text-sm text-[#6B7280]">Loading...</p>
          ) : (
            groupMembers.map((m) => (
              <div key={m.id || m._id} className="flex items-center justify-between py-2 border-b border-[#E5E7EB] last:border-0">
                <div className="flex items-center gap-3">
                  {m.profilePhoto ? <img src={m.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" /> : <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center text-sm font-semibold text-[#7C3AED]">{(m.name || 'U')[0]}</div>}
                  <div>
                    <p className="font-medium text-[#111827]">{m.name} {m.isAdmin && <span className="text-xs text-[#6B7280]">(Admin)</span>}</p>
                    <p className="text-xs text-[#6B7280]">@{m.username}</p>
                  </div>
                </div>
                {activeGroupForModal?.isAdmin && !m.isAdmin && (
                  <button onClick={() => handleRemoveMember(m)} disabled={actionLoading.remove === (m.id || m._id)} className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-1">
                    <UserMinus size={12} /> {actionLoading.remove === (m.id || m._id) ? 'Removing...' : 'Remove'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
    </SidebarProvider>
  );
}
