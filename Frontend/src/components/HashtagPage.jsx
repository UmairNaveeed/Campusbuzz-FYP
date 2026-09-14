import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Hash,
  Home,
  List,
  Mail,
  MessageSquare,
  PlusCircle,
  UserCircle,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import PostCard from './PostCard';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import api, { getPostsByHashtag } from '../services/api';
import { mapBackendPostToCard } from '../utils/postMappers';
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

export default function HashtagPage() {
  const { hashtag: hashtagParam } = useParams();
  const [searchParams] = useSearchParams();
  const departmentId = searchParams.get('departmentId') || '';
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();

  const tag = decodeURIComponent(hashtagParam || '').replace(/^#/, '').trim();

  const [posts, setPosts] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [likeLoading, setLikeLoading] = useState(null);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username
    ? profile.username.startsWith('@')
      ? profile.username
      : `@${profile.username}`
    : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const fetchPosts = useCallback(async () => {
    if (!tag) {
      setError('Hashtag is required');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await getPostsByHashtag(tag, {
        departmentId: departmentId || undefined,
      });
      if (data?.success) {
        const list = (data.posts || []).map((p) => mapBackendPostToCard(p));
        setPosts(list);
        setPostCount(data.count ?? list.length);
      } else {
        setPosts([]);
        setPostCount(0);
        setError(data?.error || 'Failed to load posts');
      }
    } catch (err) {
      setPosts([]);
      setPostCount(0);
      setError(err.response?.data?.error || err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [tag, departmentId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleLike = async (postId) => {
    if (likeLoading === postId) return;
    setLikeLoading(postId);
    try {
      await api.put(`/api/posts/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) !== String(postId)) return p;
          return {
            ...p,
            liked: !p.liked,
            likes: p.liked ? p.likes - 1 : p.likes + 1,
          };
        })
      );
    } catch (err) {
      console.error('Like failed:', err);
    } finally {
      setLikeLoading(null);
    }
  };

  const handleReport = async (postId) => {
    try {
      await api.post(`/api/posts/${postId}/report`, { reason: 'other', description: '' });
      alert('Report submitted');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to report');
    }
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
          <Link
            to="/home"
            className="flex items-center gap-2 px-2 pb-3 text-white text-xl font-bold rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
          >
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
                        isActive={item.label === 'Trends'}
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
          <Link
            to="/profile"
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
          >
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
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <NavigationMenu className="max-w-none">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger className="h-9 gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">
                      {initial}
                    </span>
                    {displayName}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent className="min-w-[180px]">
                    <ul className="grid gap-1 p-2">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">
                            Profile
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      <li>
                        <NavigationMenuLink asChild>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
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

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-2xl">
            <div className="sticky top-0 z-10 -mx-6 mb-4 border-b border-[#E5E7EB] bg-[#F3F4F8]/95 px-6 py-3 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-[#5B21B6] hover:text-[#6D28D9]"
              >
                <ArrowLeft size={18} aria-hidden />
                Back
              </button>
              <h1 className="text-2xl font-bold text-[#111827]">#{tag || '…'}</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                {loading
                  ? 'Loading posts…'
                  : `${postCount} ${postCount === 1 ? 'post' : 'posts'}`}
                {departmentId && !loading && (
                  <span className="text-[#7C3AED]"> · department feed</span>
                )}
              </p>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
                Loading posts…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <p className="text-sm text-red-800">{error}</p>
                <button
                  type="button"
                  onClick={fetchPosts}
                  className="mt-4 rounded-full bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                >
                  Try again
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">
                No posts with #{tag} yet.
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={handleLike}
                    onReport={handleReport}
                    onUpdate={fetchPosts}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
