import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Bell,
  Check,
  Hash,
  Heart,
  ThumbsUp,
  X,
  Home,
  List,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquare,
  PlusCircle,
  Repeat2,
  UserCircle,
  UserPlus,
  UserMinus,
  AtSign,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deletePost,
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

function getNotificationCategory(dateStr) {
  if (!dateStr) return 'older';
  const notificationDate = new Date(dateStr);
  const now = new Date();
  if (Number.isNaN(notificationDate.getTime())) return 'older';
  
  // Reset time to midnight for accurate date comparison (ignore time component)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const notifDate = new Date(notificationDate.getFullYear(), notificationDate.getMonth(), notificationDate.getDate());
  
  // Calculate difference in days
  const diffTime = today.getTime() - notifDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Categorize based on days difference
  if (diffDays === 0) return 'today';           // Today
  if (diffDays === 1) return 'yesterday';        // Yesterday
  if (diffDays >= 2 && diffDays <= 7) return 'last7days';   // Last 7 days (excluding today and yesterday)
  if (diffDays >= 8 && diffDays <= 30) return 'last30days'; // Last 30 days (excluding last 7 days)
  return 'older';                                 // Older than 30 days
}

function getCategoryLabel(category) {
  switch (category) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'last7days': return 'Last 7 Days';
    case 'last30days': return 'Last 30 Days';
    case 'older': return 'Older';
    default: return 'Older';
  }
}

const icons = {
  like: ThumbsUp,
  comment: MessageCircle,
  reply: MessageCircle,
  share: Repeat2,
  repost: Repeat2,
  follow: UserPlus,
  mention: AtSign,
  comment_like: ThumbsUp,
  group_join_request: UserPlus,
  group_join_accepted: UserPlus,
  group_join_rejected: UserMinus,
  content_warning: Bell,
};

const iconColors = {
  like: 'text-[#EF4444] bg-[#EF4444]/10',
  comment: 'text-[#7C3AED] bg-[#7C3AED]/10',
  reply: 'text-[#7C3AED] bg-[#7C3AED]/10',
  share: 'text-[#10B981] bg-[#10B981]/10',
  repost: 'text-[#10B981] bg-[#10B981]/10',
  follow: 'text-[#3B82F6] bg-[#3B82F6]/10',
  mention: 'text-[#F59E0B] bg-[#F59E0B]/10',
  comment_like: 'text-[#EF4444] bg-[#EF4444]/10',
  group_join_request: 'text-[#7C3AED] bg-[#7C3AED]/10',
  group_join_accepted: 'text-[#10B981] bg-[#10B981]/10',
  group_join_rejected: 'text-[#EF4444] bg-[#EF4444]/10',
  content_warning: 'text-amber-600 bg-amber-100',
};

function mapBackendNotificationToUI(n) {
  const actor = n.actor || {};
  const userName = actor.name || 'Someone';
  let content = '';
  let extraGroupName = '';
  let extraGroupId = '';
  let isRepostLike = false;
  let isRepostComment = false;
  try {
    if (n.extra) {
      const parsed = JSON.parse(n.extra);
      extraGroupName = parsed.groupName || '';
      extraGroupId = parsed.groupId || '';
      isRepostLike = parsed.isRepostLike || false;
      isRepostComment = parsed.isRepostComment || false;
    }
  } catch (_) {}
  switch (n.type) {
    case 'like': 
      content = isRepostLike ? 'liked a post that you reposted' : 'liked your post'; 
      break;
    case 'comment': 
      content = isRepostComment ? 'commented on a post that you reposted' : 'commented on your post'; 
      break;
    case 'reply': 
      content = isRepostComment ? 'replied to a comment on a post that you reposted' : 'replied to your comment'; 
      break;
    case 'follow': content = 'started following you'; break;
    case 'mention': content = 'mentioned you in a post'; break;
    case 'share': content = 'shared your post'; break;
    case 'repost': content = 'reposted your post'; break;
    case 'comment_like': content = 'liked your comment'; break;
    case 'group_join_request': content = extraGroupName ? `requested to join "${extraGroupName}"` : 'requested to join your group'; break;
    case 'group_join_accepted': content = extraGroupName ? `accepted your request to join "${extraGroupName}"` : 'accepted your join request'; break;
    case 'group_join_rejected': content = extraGroupName ? `rejected your request to join "${extraGroupName}"` : 'rejected your join request'; break;
    case 'content_warning':
      content = n.extra || 'Your post contains inappropriate/hate content and will not be visible to anyone.';
      break;
    default: content = 'interacted with your content';
  }
  if (n.post?.content) {
    const snippet = (n.post.content || '').slice(0, 50);
    if (snippet) content += `: "${snippet}${n.post.content.length > 50 ? '…' : ''}"`;
  }
  // Ensure we have a valid ID - use _id as fallback if id is missing
  const notificationId = n.id || n._id;
  if (!notificationId) {
    console.warn('Notification missing ID:', n);
  }
  
  const createdAt = n.created_at || n.createdAt;
  const isContentWarning = n.type === 'content_warning';
  return {
    id: notificationId ? String(notificationId) : `temp-${Date.now()}-${Math.random()}`,
    type: n.type || 'like',
    user: isContentWarning ? '' : userName,
    content: isContentWarning ? content : content,
    isContentWarning,
    time: formatTimeAgo(createdAt),
    createdAt: createdAt, // Store original date for categorization
    read: !!n.readAt,
    postId: n.postId ?? n.post?._id ?? n.post?.id ?? null,
    post: n.post || null,
    commentId: n.comment?.id ?? n.comment?._id ?? n.commentId ?? null,
    comment: n.comment || null,
    openComments: n.type === 'comment' || n.type === 'reply' || n.type === 'comment_like',
    groupId: extraGroupId || null,
    actor: n.actor || {},
    category: getNotificationCategory(createdAt), // Add category for grouping
  };
}

export default function Notifications() {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const [filter, setFilter] = useState('all');
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications({ scope: 'main' });
      const list = (data?.notifications || []).map(mapBackendNotificationToUI);
      setNotifs(list);
    } catch {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchNotifications();
    
    // Refresh notifications when count updates
    const handleCountUpdate = () => {
      if (!cancelled) fetchNotifications();
    };
    window.addEventListener('notificationCountUpdated', handleCountUpdate);
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      if (!cancelled) fetchNotifications();
    }, 30000);
    
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('notificationCountUpdated', handleCountUpdate);
    };
  }, []);

  // Filter out share notifications and apply user's filter
  // Reply notifications are included in "all" and "comment" filters
  const filteredNotifs = notifs.filter((n) => n.type !== 'share');
  const filtered = filter === 'all' 
    ? filteredNotifs 
    : filter === 'comment' 
      ? filteredNotifs.filter((n) => n.type === 'comment' || n.type === 'reply')
      : filteredNotifs.filter((n) => n.type === filter);
  
  // Group notifications by category and sort within each category (newest first)
  const categoryOrder = ['today', 'yesterday', 'last7days', 'last30days', 'older'];
  const groupedNotifications = filtered.reduce((acc, notif) => {
    const category = notif.category || 'older';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(notif);
    return acc;
  }, {});
  
  // Sort notifications within each category by date (newest first)
  categoryOrder.forEach((category) => {
    if (groupedNotifications[category]) {
      groupedNotifications[category].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // Newest first
      });
    }
  });

  const markAllRead = async () => {
    try {
      await markAllNotificationsAsRead('main');
      setNotifs((n) => n.map((x) => ({ ...x, read: true })));
      refetchNotificationCount();
      window.dispatchEvent(new Event('notificationCountUpdated'));
    } catch (_) {}
  };

  const markOneRead = async (id, item) => {
    // Validate ID before making API call
    if (!id || id === 'undefined' || id === 'null' || id.startsWith('temp-')) {
      console.warn('Cannot mark notification as read: invalid ID', id);
      return;
    }
    
    try {
      await markNotificationAsRead(id);
      setNotifs((prev) => prev.map((x) => (x.id === String(id) ? { ...x, read: true } : x)));
      // Update count after backend confirms it's marked as read
      refetchNotificationCount();
      window.dispatchEvent(new Event('notificationCountUpdated'));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // If marking as read fails, ensure count is still refreshed
      refetchNotificationCount();
      window.dispatchEvent(new Event('notificationCountUpdated'));
    }
  };

  const handleNotificationClick = async (n) => {
    // Mark as read immediately when clicked
    if (!n.read && n.id && !n.id.startsWith('temp-')) {
      // Update UI immediately for better UX
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      // Immediately trigger count update (optimistic)
      window.dispatchEvent(new Event('notificationCountUpdated'));
      // Mark as read in backend - this will also update the count
      markOneRead(n.id, n).catch(() => {
        // If marking as read fails, revert the optimistic update
        setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: false } : x)));
        // Revert count update
        refetchNotificationCount();
        window.dispatchEvent(new Event('notificationCountUpdated'));
      });
    }
    
    // Handle group notifications - navigate to discussion forum
    if (n.groupId) {
      navigate('/discussion');
      return;
    }
    
    // Handle follow notifications - navigate to actor's profile
    if (n.type === 'follow') {
      if (n.actor?.username) {
        const username = n.actor.username.replace('@', '').trim();
        if (username) {
          navigate(`/user/${encodeURIComponent(username)}`);
          return;
        }
      }
      // Fallback: if no username, try to navigate using actor ID if available
      if (n.actor?.id || n.actor?._id) {
        // Could navigate to a profile by ID if that route exists
        console.warn('Follow notification missing username, cannot navigate');
      }
      return;
    }
    
    if (n.type === 'content_warning') {
      return;
    }

    // Handle all post-related notifications (like, comment, reply, mention, repost, comment_like)
    if (n.postId) {
      // Store navigation info in sessionStorage for HomeFeed to pick up after posts load
      const navInfo = {
        postId: String(n.postId),
        openComments: n.openComments || false,
        commentId: n.commentId ? String(n.commentId) : null,
        timestamp: Date.now()
      };
      sessionStorage.setItem('pendingPostNavigation', JSON.stringify(navInfo));
      
      // Check if we're already on the home page
      const isOnHomePage = location.pathname === '/home';
      
      console.log('Notifications: Navigating to post', navInfo);
      
      if (isOnHomePage) {
        // If already on home page, dispatch event after a delay to ensure posts are rendered
        requestAnimationFrame(() => {
          setTimeout(() => {
            console.log('Notifications: Dispatching openPostById event (already on home)', navInfo);
            window.dispatchEvent(new CustomEvent('openPostById', { 
              detail: navInfo
            }));
          }, 500);
        });
      } else {
        // Navigate to home feed - HomeFeed will pick up the sessionStorage and dispatch event after posts load
        navigate('/home');
      }
      return;
    }
    
    // If no specific navigation handler matches, do nothing (or could show a message)
    console.log('Notification type without navigation handler:', n.type);
  };

  const handleDeleteFlaggedPost = async (e, n) => {
    e.stopPropagation();
    if (!n.postId) return;
    if (!window.confirm('Delete this post? It cannot be recovered.')) return;
    try {
      await deletePost(n.postId);
      if (n.id && !n.id.startsWith('temp-')) {
        await deleteNotification(n.id).catch(() => {});
      }
      setNotifs((prev) => prev.filter((x) => x.id !== n.id));
      refetchNotificationCount();
      window.dispatchEvent(new Event('notificationCountUpdated'));
      window.dispatchEvent(new Event('postsUpdated'));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete post');
    }
  };

  const handleDeleteNotification = async (e, id) => {
    e.stopPropagation();
    // Validate ID before making API call
    if (!id || id === 'undefined' || id === 'null' || id.startsWith('temp-')) {
      // Just remove from UI if it's a temp notification
      setNotifs((prev) => prev.filter((x) => x.id !== String(id)));
      return;
    }
    
    try {
      await deleteNotification(id);
      setNotifs((prev) => prev.filter((x) => x.id !== String(id)));
      refetchNotificationCount();
      window.dispatchEvent(new Event('notificationCountUpdated'));
    } catch (_) {}
  };

  const { count: forumCount, refetch: refetchForumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount, refetch: refetchNotificationCount } = useNotificationCount();
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
                        isActive={item.label === 'Notifications'}
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
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
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

        {/* Notifications content */}
        <div className="px-4 sm:px-6 py-5">
          <div className="mx-auto w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold text-[#111827]">Notifications</h1>
              <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-[#7C3AED] hover:underline font-medium">
                <Check size={14} /> Mark all read
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['all', 'like', 'comment', 'repost', 'follow', 'mention'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-xl px-4 py-1.5 text-sm font-medium capitalize whitespace-nowrap transition-colors ${
                    filter === f
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white'
                      : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {f.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Notifications list */}
            <div className="space-y-6">
              {loading ? (
                <p className="text-[#6B7280] py-4">Loading notifications...</p>
              ) : filtered.length === 0 ? (
                <p className="text-[#6B7280] py-4">No notifications.</p>
              ) : (
                categoryOrder.map((category) => {
                  const categoryNotifications = groupedNotifications[category] || [];
                  if (categoryNotifications.length === 0) return null;
                  
                  return (
                    <div key={category} className="space-y-2">
                      <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wide px-1">
                        {getCategoryLabel(category)}
                      </h2>
                      {categoryNotifications.map((n, index) => {
                        const Icon = icons[n.type] || Heart;
                        const colorClass = iconColors[n.type] || iconColors.like;
                        // Use a combination of id and index for key to ensure uniqueness
                        const uniqueKey = n.id && !n.id.startsWith('temp-') ? n.id : `notification-${index}-${n.type}-${n.user}`;
                        return (
                          <div
                            key={uniqueKey}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(n)}
                            onKeyDown={(e) => e.key === 'Enter' && handleNotificationClick(n)}
                            className={`w-full flex items-start gap-3 rounded-2xl border p-4 transition-colors text-left ${
                              n.isContentWarning ? 'cursor-default' : 'cursor-pointer'
                            } ${
                              n.isContentWarning
                                ? n.read
                                  ? 'border-amber-200 bg-amber-50/50'
                                  : 'border-amber-300 bg-amber-50'
                                : n.read
                                  ? 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                                  : 'border-[#7C3AED]/20 bg-[#F5F3FF] hover:bg-[#EDE9FE]'
                            }`}
                          >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${colorClass}`}>
                              <Icon size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                {n.isContentWarning ? (
                                  <span className="text-amber-900">{n.content}</span>
                                ) : (
                                  <>
                                    <span className="font-semibold text-[#111827]">{n.user}</span>{' '}
                                    <span className="text-[#6B7280]">{n.content}</span>
                                  </>
                                )}
                              </p>
                              {n.isContentWarning && n.postId && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteFlaggedPost(e, n)}
                                  className="mt-2 text-xs font-medium text-red-700 hover:text-red-800 underline"
                                >
                                  Delete post
                                </button>
                              )}
                              {n.postId && n.actor?.profilePhoto && (
                                <div className="mt-2 flex items-center gap-2">
                                  {n.actor.profilePhoto ? (
                                    <img 
                                      src={n.actor.profilePhoto} 
                                      alt={n.user}
                                      className="h-8 w-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-bold text-white">
                                      {n.user[0]?.toUpperCase() || 'U'}
                                    </div>
                                  )}
                                  {n.post?.content && (
                                    <p className="text-xs text-[#6B7280] line-clamp-1 flex-1">
                                      {n.post.content.length > 60 ? `${n.post.content.slice(0, 60)}...` : n.post.content}
                                    </p>
                                  )}
                                </div>
                              )}
                              <p className="text-xs text-[#9CA3AF] mt-1">{n.time}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!n.read && <div className="h-2.5 w-2.5 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6]" />}
                              <button
                                type="button"
                                onClick={(e) => handleDeleteNotification(e, n.id)}
                                className="p-1 rounded-lg hover:bg-red-100 text-[#6B7280] hover:text-red-600 transition-colors"
                                title="Delete"
                                aria-label="Delete notification"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
