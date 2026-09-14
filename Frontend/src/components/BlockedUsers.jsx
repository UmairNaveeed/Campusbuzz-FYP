import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import {
  Home,
  Bell,
  Hash,
  List,
  Mail,
  MessageSquare,
  PlusCircle,
  UserCircle,
  Settings as SettingsIcon,
  ShieldBan,
  Unlock,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { getBlockedUsers, blockUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useCreatePost } from '../context/CreatePostContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';

const BlockedUsers = () => {
  const navigate = useNavigate();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const { openCreatePost } = useCreatePost();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getBlockedUsers();
      if (response?.success && Array.isArray(response.blockedUsers)) {
        setBlockedUsers(response.blockedUsers);
      } else {
        setBlockedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching blocked users:', error);
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firebaseUser) {
      fetchBlockedUsers();
    }
  }, [firebaseUser, fetchBlockedUsers]);

  const handleUnblock = async (userId) => {
    try {
      setUnblocking(userId);
      const response = await blockUser(userId);
      if (response?.success && !response?.blocked) {
        setBlockedUsers((prev) => prev.filter((user) => user._id !== userId));
      }
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert('Failed to unblock user. Please try again.');
    } finally {
      setUnblocking(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recently';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username
    ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`)
    : '';
  const initial = (displayName || 'U')[0].toUpperCase();

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
            <SidebarGroupLabel className="uppercase text-[11px] tracking-[0.12em] text-white/60">
              Menu
            </SidebarGroupLabel>
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
                        className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                      >
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {item.label === 'Forums' && forumCount > 0 && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {forumCount > 99 ? '99+' : forumCount}
                            </span>
                          )}
                          {item.label === 'Messages' && messageSidebarCount > 0 && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {messageSidebarCount > 99 ? '99+' : messageSidebarCount}
                            </span>
                          )}
                          {item.label === 'Notifications' && notificationCount > 0 && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10">
                    <Link to="/settings" className="flex items-center gap-2">
                      <SettingsIcon className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
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
            <div className="flex items-center gap-1">
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
                            <Link to="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">
                              Settings
                            </Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <button
                            type="button"
                            onClick={() => logout().then(() => navigate('/login', { replace: true }))}
                            className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
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

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-[#F3F4F6] rounded-full transition-colors text-[#6B7280]"
                aria-label="Back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#111827]">Blocked Accounts</h1>
                <p className="text-sm text-[#6B7280] mt-0.5">Manage accounts you've blocked. They won't see your posts or message you.</p>
              </div>
            </div>

            <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-6 border-b border-[#E5E7EB] bg-[#FAFAFA]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF]">
                  <ShieldBan className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">Blocked users</h2>
                  <p className="text-sm text-[#6B7280]">
                    {blockedUsers.length === 0 && !loading
                      ? 'No blocked accounts'
                      : `${blockedUsers.length} account${blockedUsers.length === 1 ? '' : 's'} blocked`}
                  </p>
                </div>
              </div>

              <div className="p-6">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="h-8 w-8 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
                  </div>
                ) : blockedUsers.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
                    <div className="w-14 h-14 rounded-full bg-[#F3F4F6] flex items-center justify-center mx-auto mb-4">
                      <ShieldBan className="h-7 w-7 text-[#9CA3AF]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#111827] mb-2">No blocked accounts</h3>
                    <p className="text-sm text-[#6B7280] max-w-sm mx-auto">
                      When you block someone, they won't be able to send you messages or see your posts. They'll appear here.
                    </p>
                    <Link
                      to="/settings"
                      className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#7C3AED] font-medium text-sm transition-colors"
                    >
                      Back to Settings
                    </Link>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {blockedUsers.map((user) => (
                      <li
                        key={user._id}
                        className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-full bg-[#E5E7EB] flex-shrink-0 overflow-hidden">
                            {user.profilePhoto ? (
                              <img
                                src={user.profilePhoto}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center text-[#6B7280] font-semibold text-lg">
                                {(user.name || 'U')[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[#111827] truncate">{user.name || 'Unknown'}</p>
                            <p className="text-sm text-[#6B7280] truncate">@{user.username || 'unknown'}</p>
                            <p className="text-xs text-[#9CA3AF] mt-0.5">Blocked {formatDate(user.blockedAt)}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnblock(user._id)}
                          disabled={unblocking === user._id}
                          className="flex items-center gap-2 flex-shrink-0 px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50 transition-colors"
                        >
                          <Unlock className="h-4 w-4" />
                          {unblocking === user._id ? 'Unblocking...' : 'Unblock'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default BlockedUsers;
