import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
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
import { formatDepartmentLabel } from '../utils/departmentLabel';
import CampusBuzzIcon from './CampusBuzzIcon';
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
import PostCard from './PostCard';
import FollowersList from './FollowersList';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import api from '../services/api';
import CampusTrendsWidget from './CampusTrendsWidget';
import WhoToFollowWidget from './WhoToFollowWidget';
import { mapBackendPostToCard } from '../utils/postMappers';
import AddToListModal from './AddToListModal';

const ViewUserProfile = () => {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { username } = useParams();
  const { user: firebaseUser } = useAuth();
  const { profile: myProfile } = useProfile();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Posts');
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [showFollowingList, setShowFollowingList] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const displayName = myProfile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = myProfile?.username ? (myProfile.username.startsWith('@') ? myProfile.username : `@${myProfile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!firebaseUser) {
        setLoading(false);
        setError('Please login to view profiles');
        return;
      }
      if (!username) {
        setLoading(false);
        setError('Username is required');
        return;
      }
      try {
        const response = await api.get(`/api/profile/${username}`);
        if (response.data.success) {
          const userProfile = response.data.user;
          const meRes = await api.get('/api/profile/me');
          if (meRes.data?.success && meRes.data.user?.username === username) {
            navigate('/profile', { replace: true });
            return;
          }
          setProfile(userProfile);
          setIsFollowing(userProfile.isFollowing || false);
        } else {
          setError(response.data.error || 'Failed to load profile');
        }
      } catch (err) {
        if (err.response?.status === 404) setError('User not found');
        else if (err.response?.status === 401) setError('Authentication failed. Please login again.');
        else setError(err.response?.data?.error || 'Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username, firebaseUser, navigate]);

  const fetchPosts = useCallback(async () => {
    if (!profile || !username) return;
    setPostsLoading(true);
    try {
      const response = await api.get(`/api/posts/user/${username}`);
      const raw = Array.isArray(response.data) ? response.data : (response.data?.posts || []);
      setPosts(raw.map(mapBackendPostToCard));
    } catch (err) {
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }, [profile, username]);

  useEffect(() => {
    if (profile) fetchPosts();
  }, [profile, fetchPosts]);

  const handleMessage = () => {
    if (!profile?.username) return;
    navigate('/messages', {
      state: {
        openChatUser: {
          id: profile.id,
          username: profile.username,
          name: profile.name,
        },
      },
    });
  };

  const handleFollow = async () => {
    if (!profile || !username) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await api.post(`/api/profile/${username}/unfollow`);
        setIsFollowing(false);
      } else {
        await api.post(`/api/profile/${username}/follow`);
        setIsFollowing(true);
        window.dispatchEvent(new Event('profileUpdated'));
      }
      const profileResponse = await api.get(`/api/profile/${username}`);
      if (profileResponse.data.success) {
        setProfile(profileResponse.data.user);
        setIsFollowing(profileResponse.data.user.isFollowing || false);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update follow status');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      await api.put(`/api/posts/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === String(postId) ? { ...p, likes: p.likes + (p.liked ? -1 : 1), liked: !p.liked } : p
        )
      );
    } catch (_) {}
  };

  const handleReport = async (postId) => {
    try {
      await api.post(`/api/posts/${postId}/report`, { reason: 'other', description: '' });
    } catch (_) {}
  };

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
                      <SidebarMenuButton asChild className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10">
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#374151] hover:text-[#111827]">
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16l-6-6 6-6" />
              </svg>
              <span className="font-medium">Back</span>
            </button>
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <div className="w-20" />
          </div>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED]" />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-red-500 mb-4">{error}</p>
              <button onClick={() => navigate('/home')} className="px-4 py-2 bg-[#7C3AED] text-white rounded-xl hover:opacity-90">
                Go to Home
              </button>
            </div>
          ) : profile ? (
            <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
                    {profile.coverPhoto ? (
                      <img src={profile.coverPhoto} alt="" className="h-[140px] md:h-[180px] w-full object-cover" />
                    ) : (
                      <div className="h-[140px] md:h-[180px] bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899]" />
                    )}
                    <div className="relative px-6 -mt-12">
                      {profile.profilePhoto ? (
                        <img src={profile.profilePhoto} alt="" className="h-[72px] w-[72px] md:h-[88px] md:w-[88px] rounded-full border-4 border-white object-cover shadow-lg" />
                      ) : (
                        <div className="flex h-[72px] w-[72px] md:h-[88px] md:w-[88px] items-center justify-center rounded-full border-4 border-white bg-[#EDE9FE] text-3xl md:text-3xl font-bold text-[#7C3AED] shadow-lg">
                          {(profile.name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="mt-4 flex items-start justify-between">
                        <div>
                          <h1 className="text-[22px] font-bold text-[#111827]">{profile.name}</h1>
                          <p className="text-[14px] text-[#6B7280]">@{profile.username || 'no-username'}</p>
                          {profile.bio && <p className="mt-1 text-[14px] text-[#374151]">{profile.bio}</p>}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[13px] text-[#6B7280]">
                            {profile.department && <span>{formatDepartmentLabel(profile.department)}</span>}
                            {profile.startYear != null && profile.endYear != null && (
                              <span>Session {profile.startYear}–{profile.endYear}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-5 pt-2 text-[14px]">
                            <button type="button" onClick={() => setShowFollowingList(true)} className="hover:underline">
                              <strong className="text-[#111827]">{profile.followingCount ?? 0}</strong> <span className="text-[#6B7280]">Following</span>
                            </button>
                            <button type="button" onClick={() => setShowFollowersList(true)} className="hover:underline">
                              <strong className="text-[#111827]">{profile.followersCount ?? 0}</strong> <span className="text-[#6B7280]">Followers</span>
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 mt-1">
                          <button
                            type="button"
                            onClick={handleMessage}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white hover:opacity-90"
                          >
                            Message
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAddToList(true)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors border border-[#7C3AED] text-[#7C3AED] bg-white hover:bg-[#F5F3FF]"
                          >
                            Add to list
                          </button>
                          <button
                            type="button"
                            onClick={handleFollow}
                            disabled={followLoading}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                              isFollowing
                                ? 'border border-[#7C3AED] text-[#7C3AED] bg-white hover:bg-[#F5F3FF]'
                                : 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white hover:opacity-90'
                            } ${followLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {followLoading ? 'Loading...' : isFollowing ? 'Following' : 'Follow'}
                          </button>
                        </div>
                      </div>
                      <div className="mt-6 flex gap-0 border-b border-[#E5E7EB]">
                        {['Posts', 'Replies', 'Media', 'Likes'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-5 py-3 text-[14px] font-medium border-b-2 transition-colors ${
                              activeTab === tab ? 'border-[#7C3AED] text-[#7C3AED]' : 'border-transparent text-[#6B7280] hover:text-[#374151]'
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    {postsLoading ? (
                      <p className="text-[#6B7280] py-4">Loading posts...</p>
                    ) : activeTab === 'Posts' && posts.length === 0 ? (
                      <p className="text-[#6B7280] py-4">No posts yet. When {profile.name} posts, they&apos;ll show up here.</p>
                    ) : activeTab === 'Posts' ? (
                      posts.map((post) => (
                        <PostCard key={post.id} post={post} onLike={() => handleLike(post.id)} onReport={() => handleReport(post.id)} onUpdate={fetchPosts} />
                      ))
                    ) : (
                      <p className="text-[#6B7280] py-4">Only Posts tab is supported for now.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <CampusTrendsWidget className="shadow-sm border-[#E5E7EB]" />

                  <WhoToFollowWidget className="shadow-sm border-[#E5E7EB]" />
                  
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </SidebarInset>

      {showFollowersList && username && (
        <FollowersList username={username} type="followers" isOwnProfile={false} onClose={() => setShowFollowersList(false)} />
      )}
      {showFollowingList && username && (
        <FollowersList username={username} type="following" isOwnProfile={false} onClose={() => setShowFollowingList(false)} />
      )}
      {showAddToList && profile && (
        <AddToListModal open={showAddToList} onClose={() => setShowAddToList(false)} targetUser={profile} />
      )}
    </SidebarProvider>
  );
};

export default ViewUserProfile;
