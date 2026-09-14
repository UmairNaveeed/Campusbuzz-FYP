import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ChatMessage from './ChatMessage';
import { Ban,
  Bell,
  Check,
  Hash,
  Home,
  Image,
  List,
  LogOut,
  Mail,
  MessageSquare,
  MoreVertical,
  PlusCircle,
  Search,
  Send,
  Smile,
  Trash2,
  Unlock,
  UserCircle,
  X,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useCreatePost } from '../context/CreatePostContext';
import {
  getConversations,
  getMessages,
  sendMessage as sendMessageApi,
  getConversationByParticipant,
  searchUsersForMention,
  acceptMessageRequest,
  declineMessageRequest,
  blockUserFromRequest,
  blockUser as blockUserApi,
  getBlockedUsers,
  deleteMessage as deleteMessageApi,
  reactToMessage as reactToMessageApi,
  deleteConversation as deleteConversationApi,
} from '../services/api';

function formatMessageTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
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

export default function Messaging() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const userSearchTimeoutRef = useRef(null);
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const [attachMediaType, setAttachMediaType] = useState(null); // 'image'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [listTab, setListTab] = useState('chats'); // 'chats' | 'requests'
  const [blockedUserIds, setBlockedUserIds] = useState(new Set());
  const [blockUnblockLoading, setBlockUnblockLoading] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const { count: messageSidebarCount } = useMessageCount();

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const res = await getBlockedUsers();
      if (res?.success && Array.isArray(res.blockedUsers)) {
        const ids = new Set((res.blockedUsers || []).map((u) => String(u._id || u.id)).filter(Boolean));
        setBlockedUserIds(ids);
      }
    } catch (_) {
      setBlockedUserIds(new Set());
    }
  }, []);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const fetchUserSearch = useCallback(async (q) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setUserSearchResults([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const data = await searchUsersForMention(trimmed);
      const users = Array.isArray(data?.users) ? data.users : [];
      const myUsername = profile?.username || (firebaseUser?.email && firebaseUser.email.split('@')[0]);
      const filtered = users.filter((u) => (u.username || '').toLowerCase() !== (myUsername || '').toLowerCase());
      setUserSearchResults(filtered);
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, [profile?.username, firebaseUser?.email]);

  useEffect(() => {
    if (!showNewConversation) return;
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    if (!userSearchQuery.trim()) {
      setUserSearchResults([]);
      return;
    }
    userSearchTimeoutRef.current = setTimeout(() => {
      fetchUserSearch(userSearchQuery);
    }, 300);
    return () => {
      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    };
  }, [showNewConversation, userSearchQuery, fetchUserSearch]);

  const handleSelectUserToMessage = useCallback(async (user) => {
    const rawId = user.id ?? user._id;
    const participantId = typeof rawId === 'string' ? rawId : (rawId != null && typeof rawId.toString === 'function' ? rawId.toString() : null);
    const toSend = participantId && participantId !== '[object Object]' ? participantId : (user.username || '').replace(/^@/, '');
    if (!toSend) return;
    setUserSearchLoading(true);
    try {
      const data = await getConversationByParticipant(toSend);
      const conv = data?.conversation;
      const participant = conv?.participant;
      if (!conv?.id || !participant) {
        setUserSearchResults([]);
        setShowNewConversation(false);
        return;
      }
      const chat = {
        id: conv.id ?? conv._id,
        otherUserId: participant.id ?? participant._id,
        name: participant.name || participant.username || 'Unknown',
        lastMessage: '',
        time: '',
        unread: 0,
        online: false,
      };
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === chat.id || c.otherUserId === chat.otherUserId);
        if (exists) return prev;
        return [chat, ...prev];
      });
      setSelectedChat(chat);
      setListTab('chats');
      setShowNewConversation(false);
      setUserSearchQuery('');
      setUserSearchResults([]);
    } catch {
      setUserSearchResults([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const openChatUser = location.state?.openChatUser;
    if (!openChatUser?.username && !openChatUser?.id && !openChatUser?._id) return;
    handleSelectUserToMessage(openChatUser);
    navigate('/messages', { replace: true, state: null });
  }, [location.state, handleSelectUserToMessage, navigate]);

  const refetchInboxAndRequests = useCallback(() => {
    Promise.all([getConversations('accepted'), getConversations('pending')])
      .then(([inboxData, requestsData]) => {
        const list = (inboxData?.conversations || []).map((c) => ({
          id: c.id ?? c._id,
          otherUserId: c.participant?.id ?? c.participant?._id,
          name: c.participant?.name || 'Unknown',
          lastMessage: c.lastMessage?.content || '',
          lastMessageMediaType: c.lastMessage?.media?.type || null,
          lastMessagePostId: c.lastMessage?.postId || null,
          lastMessagePost: c.lastMessage?.post || null,
          time: formatMessageTime(c.lastMessageAt),
          unread: c.unreadCount ?? 0,
          online: false,
        }));
        setConversations(list);
        const reqList = (requestsData?.conversations || []).map((c) => ({
          id: c.id ?? c._id,
          otherUserId: c.participant?.id ?? c.participant?._id,
          name: c.participant?.name || 'Unknown',
          requestedBy: c.requestedBy,
          lastMessage: c.lastMessage?.content || '',
          lastMessageMediaType: c.lastMessage?.media?.type || null,
          lastMessagePostId: c.lastMessage?.postId || null,
          lastMessagePost: c.lastMessage?.post || null,
          time: formatMessageTime(c.lastMessageAt),
        }));
        setRequests(reqList);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  useEffect(() => {
    let cancelled = false;
    setLoadingConvs(true);
    setLoadingRequests(true);
    Promise.all([getConversations('accepted'), getConversations('pending')])
      .then(([inboxData, requestsData]) => {
        if (cancelled) return;
        const list = (inboxData?.conversations || []).map((c) => ({
          id: c.id ?? c._id,
          otherUserId: c.participant?.id ?? c.participant?._id,
          name: c.participant?.name || 'Unknown',
          lastMessage: c.lastMessage?.content || '',
          lastMessageMediaType: c.lastMessage?.media?.type || null,
          lastMessagePostId: c.lastMessage?.postId || null,
          lastMessagePost: c.lastMessage?.post || null,
          time: formatMessageTime(c.lastMessageAt),
          unread: c.unreadCount ?? 0,
          online: false,
        }));
        setConversations(list);
        if (list.length && !selectedChat) setSelectedChat(list[0]);
        const reqList = (requestsData?.conversations || []).map((c) => ({
          id: c.id ?? c._id,
          otherUserId: c.participant?.id ?? c.participant?._id,
          name: c.participant?.name || 'Unknown',
          requestedBy: c.requestedBy,
          lastMessage: c.lastMessage?.content || '',
          lastMessageMediaType: c.lastMessage?.media?.type || null,
          lastMessagePostId: c.lastMessage?.postId || null,
          lastMessagePost: c.lastMessage?.post || null,
          time: formatMessageTime(c.lastMessageAt),
        }));
        setRequests(reqList);
      })
      .catch(() => {
        if (!cancelled) setConversations([]);
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingConvs(false);
        if (!cancelled) setLoadingRequests(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedChat?.id || !firebaseUser?.uid) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);
    getMessages(selectedChat.id)
      .then((data) => {
        if (cancelled) return;
        const list = (data?.messages || []).map((m) => ({
          id: m.id ?? m._id,
          senderId: m.sender?.firebaseId === firebaseUser.uid ? 'me' : 'other',
          text: m.content || '',
          timestamp: formatMessageTime(m.created_at || m.createdAt),
          status: m.deliveryStatus || 'sent',
          postId: m.postId || null,
          post: m.post || null,
          media: m.media || null,
          reactions: m.reactions || [],
        }));
        setMessages(list);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false);
      });
    return () => { cancelled = true; };
  }, [selectedChat?.id, firebaseUser?.uid]);

  // Clear message search when switching chats
  useEffect(() => {
    setMessageSearchQuery('');
  }, [selectedChat?.id]);

  const filteredChats = conversations
    .filter((c) => !blockedUserIds.has(String(c.otherUserId)))
    .filter((c) => c.name.toLowerCase().includes(searchText.toLowerCase()));

  const lastOwnMessageId = useMemo(() => {
    if (!messages.length) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderId === 'me') return messages[i].id;
    }
    return null;
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const q = (messageSearchQuery || '').trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => {
      const text = (m.text || '').toLowerCase();
      return text.includes(q);
    });
  }, [messages, messageSearchQuery]);

  const handleSend = async (mediaPayload = null) => {
    const text = (messageText || '').trim();
    if ((!text && !mediaPayload && !attachPreview) || !selectedChat?.otherUserId || sending) return;
    setSending(true);
    const mediaToSend = mediaPayload || (attachPreview ? { type: 'image', url: attachPreview } : null);
    try {
      const res = await sendMessageApi(selectedChat.otherUserId, text || '', mediaToSend);
      const m = res?.message;
      if (m) {
        setMessages((prev) => [
          ...prev,
          {
            id: m.id ?? m._id,
            senderId: 'me',
            text: m.content || text,
            timestamp: 'Just now',
            status: m.deliveryStatus || 'sent',
            postId: m.postId || null,
            post: m.post || null,
            media: m.media || null,
            reactions: [],
          },
        ]);
        // Update chat list so "last message" shows our new message
        const displayContent = mediaToSend
          ? (mediaToSend.type === 'video' ? null : mediaToSend.type === 'image' ? null : text || '')
          : text || '';
        const lastMsgMediaType = mediaToSend?.type === 'video' ? 'video' : mediaToSend?.type === 'image' ? 'image' : null;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id || c.otherUserId === selectedChat.otherUserId
              ? {
                  ...c,
                  lastMessage: lastMsgMediaType ? '' : (displayContent || ''),
                  lastMessageMediaType: lastMsgMediaType || null,
                  lastMessagePostId: null,
                  lastMessagePost: null,
                  time: 'Just now',
                }
              : c
          )
        );
        setSelectedChat((prev) =>
          prev
            ? {
                ...prev,
                lastMessage: lastMsgMediaType ? '' : (displayContent || ''),
                lastMessageMediaType: lastMsgMediaType || null,
                lastMessagePostId: null,
                lastMessagePost: null,
                time: 'Just now',
              }
            : prev
        );
      }
      setMessageText('');
      setAttachPreview(null);
      setAttachMediaType(null);
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Failed to send message.';
      alert(message);
    } finally {
      setSending(false);
    }
  };

  const handleAttachMedia = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachPreview(reader.result);
      setAttachMediaType('image');
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await deleteMessageApi(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (_) {}
  };

  const handleReactToMessage = async (messageId, emoji) => {
    try {
      const res = await reactToMessageApi(messageId, emoji);
      const updated = res?.message;
      if (updated) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: updated.reactions || [] } : m))
        );
      }
    } catch (_) {}
  };

  const EMOJI_QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '👏', '🔥', '😍', '🥺'];

  const handleDeleteChat = async (chat) => {
    if (!chat?.id) return;
    const confirmDelete = window.confirm('Delete this chat? This will clear it from your chat list but not for the other person.');
    if (!confirmDelete) return;
    try {
      await deleteConversationApi(chat.id);
      setConversations((prev) => prev.filter((c) => c.id !== chat.id));
      setRequests((prev) => prev.filter((r) => r.id !== chat.id));
      if (selectedChat?.id === chat.id) {
        setSelectedChat(null);
        setMessages([]);
      }
      window.dispatchEvent(new Event('messageCountUpdated'));
    } catch (_) {
      // ignore errors for now
    }
  };

  // Full emoji set for message input (same as in CreatePost)
  const CHAT_EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾',
    '🤖', '🎃', '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️',
    '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
    '👃', '🧠', '👀', '👁️', '👅', '👄', '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️', '🧡', '💛',
    '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '🗨️', '🗯️', '💭', '💤',
    '🔥', '✨', '⭐', '🌟', '⚡', '☄️', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🎮', '🎰', '🎲', '🃏', '🀄',
    '🎴', '🎭', '🖼️', '🎨', '🧩', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '🏒', '🏑', '🏏', '⛳',
    '🏹', '🎣', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '🏂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘',
    '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🚀', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🛰️', '🛸', '🍎', '🍊', '🍋', '🍌',
    '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🥔',
    '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙',
    '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🍚', '🍙', '🍘', '🍥', '🥠', '🥟', '🍢', '🍡', '🍧',
    '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕', '🍵', '🥤',
    '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧃', '🧉', '🧊', '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙',
    '🌚', '🌛', '🌜', '🌝', '🌞', '⭐', '🌟', '🌠', '☀️', '⛅', '☁️', '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️',
    '🌬️', '🌀', '🌈', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', '☄️', '💧', '🔥', '🌊', '⌛', '⏳', '⌚', '⏰', '⏱️', '⏲️',
    '🕰️', '🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗', '🕣', '🕘',
    '🕤', '🕙', '🕥', '🕚', '🕦', '📚', '📖', '📝', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️', '📏', '📐', '📌', '📍', '📎', '🖇️',
    '📑', '🔖', '🏷️', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹',
  ];

  const handleAcceptRequest = async (req) => {
    if (requestActionLoading) return;
    setRequestActionLoading(req.id);
    try {
      await acceptMessageRequest(req.id);
      refetchInboxAndRequests();
      const chat = {
        id: req.id,
        otherUserId: req.otherUserId,
        name: req.name,
        lastMessage: req.lastMessage || '',
        time: req.time || '',
        unread: 0,
        online: false,
      };
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === chat.id);
        if (exists) return prev.map((c) => (c.id === chat.id ? chat : c));
        return [chat, ...prev];
      });
      setSelectedChat(chat);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (_) {}
    setRequestActionLoading(null);
  };

  const handleDeleteRequest = async (req) => {
    if (requestActionLoading) return;
    setRequestActionLoading(req.id);
    try {
      await declineMessageRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      refetchInboxAndRequests();
    } catch (_) {}
    setRequestActionLoading(null);
  };

  const handleBlockRequest = async (req) => {
    if (requestActionLoading) return;
    setRequestActionLoading(req.id);
    try {
      await blockUserFromRequest(req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      if (selectedChat?.id === req.id) setSelectedChat(null);
      refetchInboxAndRequests();
      fetchBlockedUsers();
    } catch (_) {}
    setRequestActionLoading(null);
  };

  const isCurrentChatBlocked = selectedChat?.otherUserId && blockedUserIds.has(String(selectedChat.otherUserId));

  const handleBlockUserInChat = async () => {
    if (!selectedChat?.otherUserId || blockUnblockLoading) return;
    const otherId = selectedChat.otherUserId;
    setBlockUnblockLoading(true);
    setMenuOpen(false);
    try {
      await blockUserApi(otherId);
      setBlockedUserIds((prev) => new Set([...prev, String(otherId)]));
      setConversations((prev) => prev.filter((c) => c.otherUserId !== otherId));
      setSelectedChat(null);
      setMessages([]);
      await fetchBlockedUsers();
      refetchInboxAndRequests();
    } catch (_) {}
    setBlockUnblockLoading(false);
  };

  const handleUnblockUserInChat = async () => {
    if (!selectedChat?.otherUserId || blockUnblockLoading) return;
    setBlockUnblockLoading(true);
    setMenuOpen(false);
    try {
      await blockUserApi(selectedChat.otherUserId);
      await fetchBlockedUsers();
      refetchInboxAndRequests();
    } catch (_) {}
    setBlockUnblockLoading(false);
  };

  const { count: forumCount } = useForumMessageCount();
  const { count: notificationCount } = useNotificationCount();
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
                      <SidebarMenuButton
                        asChild
                        isActive={item.label === 'Messages'}
                        className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                      >
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {(item.label === 'Forums' && forumCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {forumCount > 99 ? '99+' : forumCount}
                            </span>
                          )}
                          {(item.label === 'Notifications' && notificationCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                          {(item.label === 'Messages' && messageSidebarCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {messageSidebarCount > 99 ? '99+' : messageSidebarCount}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initial}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        {/* Top bar */}
        <div className="w-full border-b border-[#DCDDDF] bg-white px-4 sm:px-6 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Profile</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Settings</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <button type="button" onClick={handleLogout} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            Logout
                          </button>
                          </NavigationMenuLink>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>

        {/* Messaging content — full height */}
        <div className="flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-0 bg-white overflow-hidden">
              {/* Chat list */}
              <div className="border-r border-[#E5E7EB] flex flex-col">
                <div className="p-3 border-b border-[#E5E7EB] space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowNewConversation(true)}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                  >
                    <PlusCircle size={18} />
                    Start conversation
                  </button>
                  {listTab === 'chats' && (
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        placeholder="Search chats..."
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        className="w-full rounded-xl border border-[#D1D5DB] bg-white py-2 pl-9 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                      />
                    </div>
                  )}
                </div>
                {/* Tab bar: Chats | Message requests */}
                <div className="flex border-b border-[#E5E7EB] bg-[#F9FAFB]">
                  <button
                    type="button"
                    onClick={() => setListTab('chats')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      listTab === 'chats'
                        ? 'text-[#7C3AED] border-b-2 border-[#7C3AED] bg-white -mb-px'
                        : 'text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    Chats
                    {conversations.length > 0 && (
                      <span className="text-[10px] text-[#9CA3AF] font-normal">({filteredChats.length})</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setListTab('requests')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                      listTab === 'requests'
                        ? 'text-[#7C3AED] border-b-2 border-[#7C3AED] bg-white -mb-px'
                        : 'text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]'
                    }`}
                  >
                    Requests
                    {requests.length > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                        {requests.length > 99 ? '99+' : requests.length}
                      </span>
                    )}
                  </button>
                </div>
                {/* List content: one list at a time, full height */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {listTab === 'chats' && (
                    <>
                      {loadingConvs ? (
                        <p className="p-4 text-sm text-[#6B7280]">Loading chats...</p>
                      ) : filteredChats.length === 0 ? (
                        <p className="p-4 text-sm text-[#9CA3AF]">No chats yet. Start a conversation above.</p>
                      ) : (
                        <ul>
                          {filteredChats.map((chat) => (
                            <li key={chat.id}>
                              <div
                                onClick={() => setSelectedChat(chat)}
                                className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer ${
                                  selectedChat?.id === chat.id ? 'bg-[#F5F3FF]' : 'hover:bg-[#F9FAFB]'
                                }`}
                              >
                                <div className="relative shrink-0">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE9FE] text-sm font-bold text-[#7C3AED]">
                                    {chat.name[0]}
                                  </div>
                                  {chat.online && (
                                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#10B981]" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-[#111827] truncate">{chat.name}</span>
                                    <span className="text-[10px] text-[#9CA3AF]">{chat.time}</span>
                                  </div>
                                  <p className="text-xs text-[#6B7280] truncate">
                                    {chat.lastMessagePostId
                                      ? (chat.lastMessagePost?.image?.startsWith?.('data:video/')
                                          ? 'Shared a video'
                                          : chat.lastMessagePost?.image
                                            ? 'Shared a photo'
                                            : 'Shared a post')
                                      : chat.lastMessageMediaType === 'image'
                                        ? '🖼️ Photo'
                                        : chat.lastMessageMediaType === 'video'
                                          ? '🎬 Video'
                                          : (chat.lastMessage || '')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {chat.unread > 0 && (
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-[10px] font-bold text-white">
                                      {chat.unread}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteChat(chat);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9CA3AF] hover:text-[#7C3AED] rounded-full p-1"
                                    title="Delete chat"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {listTab === 'requests' && (
                    <>
                      {loadingRequests ? (
                        <p className="p-4 text-sm text-[#6B7280]">Loading requests...</p>
                      ) : requests.length === 0 ? (
                        <p className="p-4 text-sm text-[#9CA3AF]">No pending requests. New requests will appear here.</p>
                      ) : (
                        <ul className="py-2">
                          {requests.map((req) => (
                            <li key={req.id} className="px-4 py-2.5 border-b border-[#F3F4F6] last:border-b-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-sm font-bold text-[#D97706]">
                                  {req.name[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[#111827] truncate">{req.name}</p>
                                  <p className="text-xs text-[#6B7280] truncate">
                                    {req.lastMessagePostId
                                      ? (req.lastMessagePost?.image?.startsWith?.('data:video/')
                                          ? 'Shared a video'
                                          : req.lastMessagePost?.image
                                            ? 'Shared a photo'
                                            : 'Shared a post')
                                      : (req.lastMessage || 'Message request')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptRequest(req)}
                                    disabled={requestActionLoading === req.id}
                                    className="rounded-lg p-1.5 text-[#059669] hover:bg-[#D1FAE5] transition-colors disabled:opacity-50"
                                    title="Accept"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRequest(req)}
                                    disabled={requestActionLoading === req.id}
                                    className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleBlockRequest(req)}
                                    disabled={requestActionLoading === req.id}
                                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors disabled:opacity-50 text-sm font-medium"
                                    title="Block this user"
                                  >
                                    <Ban size={16} />
                                    Block
                                  </button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Chat window */}
              {selectedChat ? (
                <div className="md:col-span-2 flex flex-col min-h-0">
                  {/* Chat header */}
                  <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-sm font-bold text-white">
                        {selectedChat.name[0]}
                      </div>
                      <p className="text-sm font-medium text-[#111827] truncate">{selectedChat.name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Message search — compact */}
                      <div className="relative w-36">
                        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={messageSearchQuery}
                          onChange={(e) => setMessageSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-[#D1D5DB] bg-white py-1.5 pl-8 pr-7 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                        />
                        {messageSearchQuery.trim() && (
                          <button
                            type="button"
                            onClick={() => setMessageSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]"
                            title="Clear search"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                          <MoreVertical size={16} />
                        </button>
                        {menuOpen && (
                          <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-lg z-10">
                            {isCurrentChatBlocked ? (
                              <button
                                type="button"
                                onClick={handleUnblockUserInChat}
                                disabled={blockUnblockLoading}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#111827] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
                              >
                                <Unlock size={14} /> Unblock User
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleBlockUserInChat}
                                disabled={blockUnblockLoading}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#7C3AED] hover:bg-[#EDE9FE] transition-colors disabled:opacity-50"
                              >
                                <Ban size={14} /> Block User
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Messages — only this area scrolls; extra padding so input bar doesn't cover last message timing/status */}
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 pb-24 space-y-3">
                    {loadingMessages ? (
                      <p className="text-sm text-[#6B7280]">Loading messages...</p>
                    ) : messageSearchQuery.trim() && filteredMessages.length === 0 ? (
                      <p className="text-sm text-[#6B7280] text-center py-6">No messages match &quot;{messageSearchQuery.trim()}&quot;</p>
                    ) : (
                      filteredMessages.map((msg) => (
                        <ChatMessage
                          key={msg.id}
                          message={msg}
                          isOwn={msg.senderId === 'me'}
                          showDeliveryStatus={msg.senderId === 'me' && msg.id === lastOwnMessageId}
                          onDelete={msg.senderId === 'me' ? handleDeleteMessage : null}
                          onReact={msg.senderId !== 'me' ? handleReactToMessage : null}
                          quickEmojis={EMOJI_QUICK}
                        />
                      ))
                    )}
                  </div>

                  {/* Input bar — fixed at bottom, not scrollable */}
                  <div className="flex-shrink-0 border-t border-[#E5E7EB] p-3 bg-white">
                    {attachPreview && (
                      <div className="relative mb-2 inline-block">
                        <img src={attachPreview} alt="Attach" className="h-20 w-20 rounded-lg object-cover border border-[#E5E7EB]" />
                        <button type="button" onClick={() => { setAttachPreview(null); setAttachMediaType(null); }} className="absolute -top-1 -right-1 rounded-full bg-gray-800 text-white p-0.5"><X size={12} /></button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAttachMedia} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Attach image"><Image size={18} /></button>
                      <div className="relative" ref={emojiPickerRef}>
                        <button type="button" onClick={() => setShowEmojiPicker((p) => !p)} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Add emoji"><Smile size={18} /></button>
                        {showEmojiPicker && (
                          <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-3 z-50 w-80 max-h-96 overflow-y-auto">
                            <div className="grid grid-cols-8 gap-1">
                              {CHAT_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => {
                                    setMessageText((t) => t + emoji);
                                    setShowEmojiPicker(false);
                                  }}
                                  className="hover:bg-[#F5F3FF] rounded-lg p-1.5 text-xl transition-colors flex items-center justify-center aspect-square"
                                  title={emoji}
                                >
                                  <span className="leading-none">{emoji}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Type a message..."
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        className="flex-1 rounded-xl border border-[#D1D5DB] bg-white px-4 py-2 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                      />
                      <button type="button" onClick={() => handleSend()} disabled={sending || (!messageText.trim() && !attachPreview)} className="rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] p-2.5 text-white hover:opacity-90 transition-opacity disabled:opacity-50">
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-2 flex items-center justify-center text-[#6B7280]">
                  Select a chat or start a conversation to message
                </div>
              )}
          </div>
        </div>

        {/* New conversation: search users modal */}
        {showNewConversation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNewConversation(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
                <h2 className="text-lg font-semibold text-[#111827]">New message</h2>
                <button type="button" onClick={() => setShowNewConversation(false)} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-3 border-b border-[#E5E7EB]">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search by name or username..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-[#D1D5DB] bg-white py-2.5 pl-10 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto min-h-[200px]">
                {userSearchLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#8B5CF6] border-t-transparent" />
                  </div>
                ) : userSearchQuery.trim() && userSearchResults.length === 0 ? (
                  <p className="p-4 text-sm text-[#6B7280] text-center">No users found. Try a different search.</p>
                ) : !userSearchQuery.trim() ? (
                  <p className="p-4 text-sm text-[#6B7280] text-center">Type a name or username to find people to message.</p>
                ) : (
                  <ul className="py-1">
                    {userSearchResults.map((u) => (
                      <li key={u.id ?? u._id ?? u.username ?? u.firebaseId}>
                        <button
                          type="button"
                          onClick={() => handleSelectUserToMessage(u)}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F3FF] transition-colors"
                        >
                          {u.profilePhoto ? (
                            <img src={u.profilePhoto} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDE9FE] text-sm font-bold text-[#7C3AED]">
                              {(u.name || u.username || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#111827] truncate">{u.name || 'Unknown'}</p>
                            <p className="text-xs text-[#6B7280] truncate">@{u.username || 'user'}</p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
