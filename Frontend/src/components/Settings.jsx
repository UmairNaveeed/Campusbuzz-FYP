import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
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
  Lock,
  User,
  ShieldBan,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import api, { getBlockedUsers, blockUser } from '../services/api';
import { auth } from '../firebase';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import { useCreatePost } from '../context/CreatePostContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { validateUsername } from '../lib/utils';

const Settings = () => {
  const navigate = useNavigate();
  const { profile, refetchProfile } = useProfile();
  const { user: firebaseUser, logout } = useAuth();
  const { openCreatePost } = useCreatePost();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const [username, setUsername] = useState(profile?.username || '');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(true);
  const [unblocking, setUnblocking] = useState(null);

  useEffect(() => {
    setUsername(profile?.username || '');
  }, [profile?.username]);

  useEffect(() => {
    const fetchBlocked = async () => {
      try {
        setBlockedLoading(true);
        const res = await getBlockedUsers();
        if (res?.success && Array.isArray(res.blockedUsers)) {
          setBlockedUsers(res.blockedUsers);
        }
      } catch {
        setBlockedUsers([]);
      } finally {
        setBlockedLoading(false);
      }
    };
    if (firebaseUser) fetchBlocked();
  }, [firebaseUser]);

  const validatePasswordStrength = (password) => {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (/\s/.test(password)) return 'Password must not contain spaces.';
    if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
    if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character.';
    return '';
  };

  const handleUsernameSave = async (e) => {
    e.preventDefault();
    setUsernameMsg('');
    const raw = String(username || '').trim().replace(/^@+/, '');
    if (!raw) {
      setUsernameMsg('Username is required.');
      return;
    }
    const uCheck = validateUsername(raw);
    if (!uCheck.valid) {
      setUsernameMsg(uCheck.error);
      return;
    }
    try {
      setUsernameSaving(true);
      const res = await api.put('/api/profile/update', { username: uCheck.value });
      if (res?.data?.success) {
        setUsernameMsg('Username updated successfully.');
        await refetchProfile(false);
        window.dispatchEvent(new Event('profileUpdated'));
      } else {
        setUsernameMsg(res?.data?.error || 'Failed to update username.');
      }
    } catch (err) {
      setUsernameMsg(err?.response?.data?.error || 'Failed to update username.');
    } finally {
      setUsernameSaving(false);
    }
  };

  const handlePasswordSave = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('New password and confirm password do not match.');
      return;
    }
    const policyError = validatePasswordStrength(newPassword);
    if (policyError) {
      setPasswordMsg(policyError);
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) {
      setPasswordMsg('No authenticated user found. Please log in again.');
      return;
    }
    try {
      setPasswordSaving(true);
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg('Password changed successfully.');
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordMsg('Current password is incorrect.');
      } else if (code === 'auth/too-many-requests') {
        setPasswordMsg('Too many attempts. Please try again later.');
      } else {
        setPasswordMsg(err?.message || 'Failed to change password.');
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUnblock = async (userId) => {
    try {
      setUnblocking(userId);
      const res = await blockUser(userId);
      if (res?.success && !res?.blocked) {
        setBlockedUsers((prev) => prev.filter((u) => u._id !== userId));
      }
    } catch {
      alert('Failed to unblock user. Please try again.');
    } finally {
      setUnblocking(null);
    }
  };

  const formatBlockedDate = (dateString) => {
    if (!dateString) return 'Recently';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return 'Recently';
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
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
                        isActive={item.label === 'Settings'}
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
                  <SidebarMenuButton asChild isActive className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10">
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
                          <button type="button" onClick={() => logout().then(() => navigate('/login', { replace: true }))} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
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
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-[#111827]">Settings</h1>
              <p className="text-sm text-[#6B7280] mt-1">Manage your account and privacy.</p>
            </div>

            {/* Two columns: Change Username | Change Password */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Change Username */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF]">
                    <User className="h-5 w-5 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">Change Username</h2>
                    <p className="text-sm text-[#6B7280]">Update your @username</p>
                  </div>
                </div>
                <form onSubmit={handleUsernameSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter new username"
                      className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                    />
                  </div>
                  {usernameMsg && (
                    <p className={`text-sm ${usernameMsg.includes('success') ? 'text-green-600' : 'text-[#6B7280]'}`}>{usernameMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={usernameSaving}
                    className="w-full py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold disabled:opacity-50 transition-colors"
                  >
                    {usernameSaving ? 'Saving...' : 'Save Username'}
                  </button>
                </form>
              </section>

              {/* Change Password */}
              <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F3FF]">
                    <Lock className="h-5 w-5 text-[#7C3AED]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#111827]">Change Password</h2>
                    <p className="text-sm text-[#6B7280]">Update your password</p>
                  </div>
                </div>
                <form onSubmit={handlePasswordSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">Current password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">New password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#374151] mb-1.5">Confirm new password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      className="w-full px-3 py-2.5 border border-[#E5E7EB] rounded-xl text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-[#6B7280]">
                    Min 8 characters, uppercase, lowercase, number, special character, no spaces.
                  </p>
                  {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{passwordMsg}</p>
                  )}
                  <button
                    type="submit"
                    disabled={passwordSaving}
                    className="w-full py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-semibold disabled:opacity-50 transition-colors"
                  >
                    {passwordSaving ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </section>
            </div>

            {/* Blocked Accounts - compact row */}
            <section className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold text-[#111827]">Blocked Accounts</h2>
                <Link
                  to="/blocked-users"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium text-sm transition-colors"
                >
                  <ShieldBan className="h-3.5 w-3.5" />
                  View blocked accounts
                </Link>
                {blockedLoading && (
                  <span className="h-4 w-4 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
                )}
                {!blockedLoading && blockedUsers.length > 0 && (
                  <span className="text-sm text-[#6B7280]">({blockedUsers.length} blocked)</span>
                )}
              </div>
              {!blockedLoading && blockedUsers.length === 0 && (
                <p className="text-sm text-[#9CA3AF] mt-2">You haven't blocked anyone yet.</p>
              )}
              {!blockedLoading && blockedUsers.length > 0 && blockedUsers.length <= 10 && (
                <ul className="mt-3 space-y-2 max-h-[280px] overflow-y-auto">
                  {blockedUsers.map((user) => (
                    <li
                      key={user._id}
                      className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-[#E5E7EB] flex-shrink-0 overflow-hidden">
                          {user.profilePhoto ? (
                            <img src={user.profilePhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center text-[#6B7280] text-xs font-semibold">
                              {(user.name || 'U')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[#111827] text-sm truncate">{user.name || 'Unknown'}</p>
                          <p className="text-xs text-[#6B7280] truncate">@{user.username || 'unknown'}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnblock(user._id)}
                        disabled={unblocking === user._id}
                        className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-50"
                      >
                        {unblocking === user._id ? 'Unblocking...' : 'Unblock'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!blockedLoading && blockedUsers.length > 10 && (
                <p className="mt-2 text-sm text-[#6B7280]">
                  <Link to="/blocked-users" className="text-[#7C3AED] hover:underline font-medium">
                    View all {blockedUsers.length} blocked accounts
                  </Link>
                </p>
              )}
            </section>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Settings;
