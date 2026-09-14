import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import PostCard from './PostCard';
import FollowersList from './FollowersList';
import api from '../services/api';
import { getPostsByUsername, getUserLikedPosts, getPostsAndReplies, getUserMedia, getUserReposts } from '../services/api';
import { mapBackendPostToCard } from '../utils/postMappers';
import { formatDepartmentLabel } from '../utils/departmentLabel';
import {
  Bell,
  Calendar,
  Edit,
  Hash,
  Home,
  Link as LinkIcon,
  List,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  PlusCircle,
  Repeat2,
  UserCircle,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link, useNavigate } from 'react-router-dom';
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

export default function UserProfile() {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const [posts, setPosts] = useState([]);
  const [replies, setReplies] = useState([]);
  const [media, setMedia] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [repostedPosts, setRepostedPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [likedLoading, setLikedLoading] = useState(false);
  const [repostedLoading, setRepostedLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Posts');
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '—';
  const initial = (displayName || 'U')[0].toUpperCase();
  const joinedDate = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : null;
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const fetchPosts = useCallback(() => {
    if (!profile?.username) {
      setPosts([]);
      setPostsLoading(false);
      return;
    }
    setPostsLoading(true);
    getPostsByUsername(profile.username)
      .then((data) => {
        if (data?.posts) {
          // Map posts and ensure they're sorted by date (newest first)
          const mappedPosts = data.posts.map(mapBackendPostToCard);
          // Sort by createdAt in descending order (newest first)
          mappedPosts.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.created_at || 0);
            const dateB = new Date(b.createdAt || b.created_at || 0);
            return dateB - dateA; // Descending order (newest first)
          });
          setPosts(mappedPosts);
        }
      })
      .catch(() => {
        setPosts([]);
      })
      .finally(() => {
        setPostsLoading(false);
      });
  }, [profile?.username]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Fetch replies when Replies tab is active
  const fetchReplies = useCallback(async () => {
    if (!profile?.username) {
      setReplies([]);
      setRepliesLoading(false);
      return;
    }
    setRepliesLoading(true);
    try {
      const data = await getPostsAndReplies();
      if (data?.success && data?.posts) {
        // Map posts and ensure they're sorted by date (newest first)
        const mappedPosts = data.posts.map(mapBackendPostToCard);
        mappedPosts.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateB - dateA; // Descending order (newest first)
        });
        setReplies(mappedPosts);
      } else {
        setReplies([]);
      }
    } catch (error) {
      console.error('Error fetching replies:', error);
      setReplies([]);
    } finally {
      setRepliesLoading(false);
    }
  }, [profile?.username]);

  // Fetch media when Media tab is active
  const fetchMedia = useCallback(async () => {
    if (!profile?.username) {
      setMedia([]);
      setMediaLoading(false);
      return;
    }
    setMediaLoading(true);
    try {
      const data = await getUserMedia();
      if (data?.success && data?.media && Array.isArray(data.media)) {
        // Convert media items to posts format
        const mediaPosts = await Promise.all(
          data.media.map(async (item) => {
            try {
              // Fetch the full post data for each media item
              const postResponse = await api.get(`/api/posts/${item.postId}`);
              if (postResponse.data?.success && postResponse.data?.post) {
                const post = mapBackendPostToCard(postResponse.data.post);
                // Only include posts that have actual media (image or video)
                if (post.image && (post.image.startsWith('data:image/') || post.image.startsWith('data:video/'))) {
                  return post;
                }
              }
              return null;
            } catch (err) {
              console.error(`Error fetching post ${item.postId}:`, err);
              return null;
            }
          })
        );
        // Filter out any null values and ensure only posts with media are included
        const validMedia = mediaPosts.filter(post => post && post.image && (post.image.startsWith('data:image/') || post.image.startsWith('data:video/')));
        // Sort by date (newest first)
        validMedia.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateB - dateA; // Descending order (newest first)
        });
        setMedia(validMedia);
      } else {
        setMedia([]);
      }
    } catch (error) {
      console.error('Error fetching media:', error);
      setMedia([]);
    } finally {
      setMediaLoading(false);
    }
  }, [profile?.username]);

  // Fetch liked posts when Likes tab is active
  const fetchLikedPosts = useCallback(async () => {
    if (!profile?.username) {
      setLikedPosts([]);
      setLikedLoading(false);
      return;
    }
    setLikedLoading(true);
    try {
      const data = await getUserLikedPosts();
      if (data?.success && data?.likedPosts && Array.isArray(data.likedPosts)) {
        // Backend returns likedPosts array with { post: {...} } structure
        const posts = data.likedPosts
          .map(item => item.post)
          .filter(Boolean)
          .map(mapBackendPostToCard);
        // Sort by date (newest first)
        posts.sort((a, b) => {
          const dateA = new Date(a.createdAt || a.created_at || 0);
          const dateB = new Date(b.createdAt || b.created_at || 0);
          return dateB - dateA; // Descending order (newest first)
        });
        setLikedPosts(posts);
      } else {
        setLikedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching liked posts:', error);
      setLikedPosts([]);
    } finally {
      setLikedLoading(false);
    }
  }, [profile?.username]);

  // Fetch reposted posts when Reposts tab is active
  const fetchRepostedPosts = useCallback(async () => {
    if (!profile?.username) {
      setRepostedPosts([]);
      setRepostedLoading(false);
      return;
    }
    setRepostedLoading(true);
    try {
      const data = await getUserReposts();
      if (data?.success && data?.repostedPosts && Array.isArray(data.repostedPosts)) {
        // Backend returns repostedPosts array with { post: {...} } structure
        const posts = data.repostedPosts
          .map(item => item.post)
          .filter(Boolean)
          .map(mapBackendPostToCard);
        // Sort by repost date (newest first)
        posts.sort((a, b) => {
          const dateA = new Date(a.repostedAt || a.createdAt || a.created_at || 0);
          const dateB = new Date(b.repostedAt || b.createdAt || b.created_at || 0);
          return dateB - dateA; // Descending order (newest first)
        });
        setRepostedPosts(posts);
      } else {
        setRepostedPosts([]);
      }
    } catch (error) {
      console.error('Error fetching reposted posts:', error);
      setRepostedPosts([]);
    } finally {
      setRepostedLoading(false);
    }
  }, [profile?.username]);

  // Ensure profile is loaded when component mounts
  useEffect(() => {
    if (firebaseUser && !profile) {
      refetchProfile();
    }
  }, [firebaseUser, profile, refetchProfile]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'Replies') {
      fetchReplies();
    } else if (activeTab === 'Media') {
      fetchMedia();
    } else if (activeTab === 'Likes') {
      fetchLikedPosts();
    } else if (activeTab === 'Reposts') {
      fetchRepostedPosts();
    }
  }, [activeTab, fetchReplies, fetchMedia, fetchLikedPosts, fetchRepostedPosts]);

  const handleLike = async (postId) => {
    try {
      await api.put(`/api/posts/${postId}/like`);
      const updatePostInState = (prev) =>
        prev.map((p) =>
          p.id === String(postId) ? { ...p, likes: p.likes + (p.liked ? -1 : 1), liked: !p.liked } : p
        );
      setPosts(updatePostInState);
      setReplies(updatePostInState);
      setMedia(updatePostInState);
      setRepostedPosts(updatePostInState);
      setLikedPosts((prev) => {
        // If unliking, remove from liked posts
        const updated = updatePostInState(prev);
        return updated.filter((p) => p.liked || p.id !== String(postId));
      });
    } catch (_) {}
  };

  const handleReport = async (postId) => {
    try {
      await api.post(`/api/posts/${postId}/report`, { reason: 'other', description: '' });
    } catch (_) {}
  };

  const menuItems = [
    { label: 'Profile', icon: UserCircle, to: '/profile' },
    { label: 'Home Feed', icon: Home, to: '/home' },
    { label: 'Create Post', icon: PlusCircle, to: '/create-post' },
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
                        isActive={item.label === 'Profile'}
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
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initial}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername !== '—' && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        {/* Top bar */}
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
                      {profile?.profilePhoto ? (
                        <img src={profile.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">{initial}</span>
                      )}
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
                          <button type="button" onClick={handleLogout} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            Logout
                          </button>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>

        {/* Profile content */}
        <div className="px-6 py-5">
          <div className="mx-auto max-w-[780px]">
            {/* Banner */}
            {profile?.coverPhoto ? (
              <img src={profile.coverPhoto} alt="" className="h-[140px] md:h-[180px] w-full rounded-2xl object-cover" />
            ) : (
              <div className="h-[140px] md:h-[180px] rounded-2xl bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899]" />
            )}

            {/* Profile card */}
            <div className="relative -mt-12 px-6">
              {/* Avatar */}
              {profile?.profilePhoto ? (
                <img src={profile.profilePhoto} alt="" className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-full border-[4px] border-white object-cover shadow-lg" />
              ) : (
                <div className="flex h-[72px] w-[72px] md:h-[88px] md:w-[88px] items-center justify-center rounded-full border-[4px] border-white bg-[#EDE9FE] text-3xl font-bold text-[#7C3AED] shadow-lg">
                  {initial}
                </div>
              )}

              {/* Info + Edit button row */}
              <div className="mt-4 flex items-start justify-between">
                <div className="space-y-1">
                  <h1 className="text-[22px] font-bold text-[#111827] leading-tight">{displayName}</h1>
                  <p className="text-[14px] text-[#6B7280]">{displayUsername}</p>
                  <p className="mt-1 text-[14px] text-[#374151]">{profile?.bio || ''}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-[13px] text-[#6B7280]">
                    {profile?.location && <span className="flex items-center gap-1"><MapPin size={13} /> {profile.location}</span>}
                    {profile?.createdAt && <span className="flex items-center gap-1"><Calendar size={13} /> Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>}
                    {profile?.department && <span className="flex items-center gap-1"><LinkIcon size={13} /> {formatDepartmentLabel(profile.department)}</span>}
                    {profile?.startYear != null && profile?.endYear != null && (
                      <span className="flex items-center gap-1">
                        <Calendar size={13} /> Session {profile.startYear}–{profile.endYear}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-5 pt-2 text-[14px]">
                    <button type="button" onClick={() => setShowFollowingList(true)} className="hover:underline">
                      <strong className="text-[#111827]">{profile?.followingCount ?? 0}</strong> <span className="text-[#6B7280]">Following</span>
                    </button>
                    <button type="button" onClick={() => setShowFollowersList(true)} className="hover:underline">
                      <strong className="text-[#111827]">{profile?.followersCount ?? 0}</strong> <span className="text-[#6B7280]">Followers</span>
                    </button>
                    <span><strong className="text-[#111827]">{posts.length}</strong> <span className="text-[#6B7280]">Posts</span></span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/edit-profile')}
                  className="mt-1 flex items-center gap-2 rounded-xl border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors shadow-sm"
                  type="button"
                >
                  <Edit size={14} /> Edit Profile
                </button>
              </div>

              {/* Tabs */}
              <div className="mt-6 flex gap-0 border-b border-[#E5E7EB]">
                {['Posts', 'Replies', 'Media', 'Likes', 'Reposts'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-[14px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                      activeTab === tab ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
                    }`}
                    type="button"
                  >
                    {tab === 'Reposts' ? <Repeat2 size={16} /> : tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Content based on active tab */}
            <div className="mt-5 space-y-4">
              {/* Posts Tab */}
              {activeTab === 'Posts' && (
                <>
                  {postsLoading ? (
                    <p className="text-[#6B7280] py-4">Loading posts...</p>
                  ) : posts.length === 0 ? (
                    <p className="text-[#6B7280] py-4">No posts yet.</p>
                  ) : (
                    posts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onReport={() => handleReport(post.id)}
                        onUpdate={fetchPosts}
                      />
                    ))
                  )}
                </>
              )}

              {/* Replies Tab */}
              {activeTab === 'Replies' && (
                <>
                  {repliesLoading ? (
                    <p className="text-[#6B7280] py-4">Loading replies...</p>
                  ) : replies.length === 0 ? (
                    <p className="text-[#6B7280] py-4">No replies yet. Start engaging with posts!</p>
                  ) : (
                    replies.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onReport={() => handleReport(post.id)}
                        onUpdate={fetchReplies}
                      />
                    ))
                  )}
                </>
              )}

              {/* Media Tab */}
              {activeTab === 'Media' && (
                <>
                  {mediaLoading ? (
                    <p className="text-[#6B7280] py-4">Loading media...</p>
                  ) : media.length === 0 ? (
                    <p className="text-[#6B7280] py-4">No media posts yet.</p>
                  ) : (
                    media.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onReport={() => handleReport(post.id)}
                        onUpdate={fetchMedia}
                      />
                    ))
                  )}
                </>
              )}

              {/* Likes Tab */}
              {activeTab === 'Likes' && (
                <>
                  {likedLoading ? (
                    <p className="text-[#6B7280] py-4">Loading liked posts...</p>
                  ) : likedPosts.length === 0 ? (
                    <p className="text-[#6B7280] py-4">No liked posts yet. Start liking posts you enjoy!</p>
                  ) : (
                    likedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onReport={() => handleReport(post.id)}
                        onUpdate={fetchLikedPosts}
                      />
                    ))
                  )}
                </>
              )}

              {/* Reposts Tab */}
              {activeTab === 'Reposts' && (
                <>
                  {repostedLoading ? (
                    <p className="text-[#6B7280] py-4">Loading reposted posts...</p>
                  ) : repostedPosts.length === 0 ? (
                    <p className="text-[#6B7280] py-4">No reposted posts yet. Start reposting posts you want to share!</p>
                  ) : (
                    repostedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onLike={() => handleLike(post.id)}
                        onReport={() => handleReport(post.id)}
                        onUpdate={fetchRepostedPosts}
                      />
                    ))
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarInset>

      {showFollowersList && profile?.username && (
        <FollowersList
          username={profile.username}
          type="followers"
          isOwnProfile
          onClose={() => setShowFollowersList(false)}
        />
      )}
      {showFollowingList && profile?.username && (
        <FollowersList
          username={profile.username}
          type="following"
          isOwnProfile
          onClose={() => setShowFollowingList(false)}
        />
      )}
    </SidebarProvider>
  );
}
