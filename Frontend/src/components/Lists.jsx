import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from './Modal';
import PostCard from './PostCard';
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  Hash,
  Home,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Pencil,
  Plus,
  PlusCircle,
  RefreshCw,
  Rss,
  Search,
  Sparkles,
  Trash2,
  UserCircle,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
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
  createCustomList,
  deleteCustomList,
  getListById,
  getListFeed,
  getMyLists,
  addListMembers,
  removeListMembers,
  updateCustomList,
  searchUsersForMention,
} from '../services/api';
import { mapBackendPostToCard } from '../utils/postMappers';

const LIST_COLORS = [
  'from-violet-500 to-purple-600',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-green-600',
];

function MemberAvatarStack({ members = [], max = 4 }) {
  const shown = members.slice(0, max);
  const extra = Math.max(0, members.length - max);
  if (shown.length === 0) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-white/40 bg-white/10 text-white/70">
        <Users size={14} />
      </div>
    );
  }
  return (
    <div className="flex -space-x-2">
      {shown.map((m, i) => (
        <div
          key={m.id || m._id || i}
          className="h-8 w-8 rounded-full ring-2 ring-white/90 overflow-hidden bg-[#E5E7EB] flex items-center justify-center text-[10px] font-bold text-[#6B7280]"
          title={m.name}
        >
          {m.profilePhoto ? (
            <img src={m.profilePhoto} alt="" className="h-full w-full object-cover" />
          ) : (
            (m.name || 'U')[0]
          )}
        </div>
      ))}
      {extra > 0 && (
        <div className="h-8 w-8 rounded-full ring-2 ring-white/90 bg-[#111827]/80 flex items-center justify-center text-[10px] font-semibold text-white">
          +{extra}
        </div>
      )}
    </div>
  );
}

export default function Lists() {
  const navigate = useNavigate();
  const location = useLocation();
  const { listId: routeListId } = useParams();
  const isFeedView = Boolean(routeListId);
  const isListsRoute = location.pathname.startsWith('/lists');
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const [lists, setLists] = useState([]);
  const [listMembersCache, setListMembersCache] = useState({});
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [listName, setListName] = useState('');

  const [selectedList, setSelectedList] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedMessage, setFeedMessage] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editList, setEditList] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNameInitial, setEditNameInitial] = useState('');
  const [editMembers, setEditMembers] = useState([]);

  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addUserListId, setAddUserListId] = useState(null);
  const [addModalMembers, setAddModalMembers] = useState([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [memberRemoveConfirm, setMemberRemoveConfirm] = useState(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    setError('');
    try {
      const data = await getMyLists();
      setLists(data?.lists || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load lists');
      setLists([]);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const fetchListMembers = useCallback(async (listId) => {
    try {
      const data = await getListById(listId);
      const members = data?.list?.membersDetail || [];
      setListMembersCache((prev) => ({ ...prev, [listId]: members }));
      return members;
    } catch {
      return [];
    }
  }, []);

  const handleCreateList = async () => {
    const name = listName.trim();
    if (!name) {
      setError('List name is required');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const data = await createCustomList(name);
      if (data?.list) {
        setLists((prev) => [data.list, ...prev]);
        navigate(`/lists/${data.list.id}`);
      }
      setModalOpen(false);
      setListName('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create list');
    } finally {
      setActionLoading(false);
    }
  };

  const loadListFeedView = useCallback(async (list) => {
    if (!list?.id) return;
    setSelectedList(list);
    setDeleteConfirmId(null);
    setFeedLoading(true);
    setFeedPosts([]);
    setFeedMessage('');
    const members = await fetchListMembers(list.id);
    setSelectedMembers(members);
    try {
      const data = await getListFeed(list.id);
      if (data?.message && (!data.posts || data.posts.length === 0)) {
        setFeedMessage(data.message);
      }
      setFeedPosts((data?.posts || []).map(mapBackendPostToCard));
    } catch (err) {
      setFeedMessage(err.response?.data?.error || 'Failed to load feed');
      setFeedPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [fetchListMembers]);

  const openListFeed = (list) => {
    navigate(`/lists/${list.id}`);
  };

  const closeListFeed = () => {
    navigate('/lists');
  };

  useEffect(() => {
    if (!routeListId) {
      setSelectedList(null);
      setFeedPosts([]);
      setSelectedMembers([]);
      return;
    }
    const fromLists = lists.find((l) => l.id === routeListId);
    if (fromLists) {
      loadListFeedView(fromLists);
      return;
    }
    if (loadingLists) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getListById(routeListId);
        if (cancelled) return;
        if (data?.list) {
          loadListFeedView(data.list);
        } else {
          setError('List not found');
          navigate('/lists', { replace: true });
        }
      } catch {
        if (!cancelled) navigate('/lists', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [routeListId, lists, loadingLists, loadListFeedView, navigate]);

  const refreshSelectedFeed = async () => {
    if (!selectedList?.id) return;
    setFeedLoading(true);
    try {
      const data = await getListFeed(selectedList.id);
      setFeedPosts((data?.posts || []).map(mapBackendPostToCard));
      setFeedMessage(data?.message && (!data.posts?.length) ? data.message : '');
    } catch {
      setFeedMessage('Could not refresh feed');
    } finally {
      setFeedLoading(false);
    }
  };

  const openEditList = async (list) => {
    setActionLoading(true);
    setError('');
    try {
      const data = await getListById(list.id);
      const full = data?.list || list;
      setEditList(full);
      const initialName = full.name || '';
      setEditName(initialName);
      setEditNameInitial(initialName);
      setEditMembers(full.membersDetail || []);
      setEditModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load list details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEditList = async () => {
    if (!editList?.id) return;
    const name = editName.trim();
    if (!name) {
      setError('List name is required');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      const data = await updateCustomList(editList.id, { name });
      const updated = data?.list;
      if (updated) {
        setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
        if (selectedList?.id === updated.id) {
          setSelectedList((s) => ({ ...s, ...updated }));
        }
      }
      setEditModalOpen(false);
      setEditList(null);
      setEditNameInitial('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update list');
    } finally {
      setActionLoading(false);
    }
  };

  const hasEditListChanges = editName.trim() !== editNameInitial.trim();

  const handleDeleteList = async (listId) => {
    setActionLoading(true);
    setError('');
    try {
      await deleteCustomList(listId);
      setLists((prev) => prev.filter((l) => l.id !== listId));
      if (routeListId === listId) {
        navigate('/lists');
      }
      setDeleteConfirmId(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete list');
    } finally {
      setActionLoading(false);
    }
  };

  const openAddUserModal = async (listId) => {
    setAddUserListId(listId);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setAddUserModalOpen(true);

    if (listMembersCache[listId]?.length) {
      setAddModalMembers(listMembersCache[listId]);
    } else if (selectedList?.id === listId && selectedMembers.length) {
      setAddModalMembers(selectedMembers);
    } else if (editList?.id === listId && editMembers.length) {
      setAddModalMembers(editMembers);
    } else {
      const members = await fetchListMembers(listId);
      setAddModalMembers(members);
    }
  };

  const addModalMemberLookup = useMemo(() => {
    const usernames = new Set();
    const ids = new Set();
    for (const m of addModalMembers) {
      if (m.username) usernames.add(String(m.username).toLowerCase());
      const id = m._id || m.id;
      if (id) ids.add(String(id));
    }
    return { usernames, ids };
  }, [addModalMembers]);

  const isUserInAddModalList = useCallback(
    (user) => {
      if (!user) return false;
      if (user.username && addModalMemberLookup.usernames.has(String(user.username).toLowerCase())) {
        return true;
      }
      const id = user._id || user.id;
      return id != null && addModalMemberLookup.ids.has(String(id));
    },
    [addModalMemberLookup]
  );

  const syncListAfterMemberChange = (updated) => {
    if (!updated) return;
    const members = updated.membersDetail || [];
    setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated, members: updated.memberCount ?? updated.members } : l)));
    setListMembersCache((prev) => ({ ...prev, [updated.id]: members }));
    if (editList?.id === updated.id) {
      setEditMembers(members);
      setEditList(updated);
    }
    if (selectedList?.id === updated.id) {
      setSelectedList(updated);
      setSelectedMembers(members);
    }
    if (addUserListId === updated.id) {
      setAddModalMembers(members);
    }
  };

  useEffect(() => {
    if (!addUserModalOpen) return;
    const q = userSearchQuery.trim();
    if (q.length < 2) {
      setUserSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const data = await searchUsersForMention(q);
        setUserSearchResults(data?.users || []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [userSearchQuery, addUserModalOpen]);

  const handleAddUserToList = async (username) => {
    if (!addUserListId || !username) return;
    const normalized = String(username).replace(/^@/, '').trim().toLowerCase();
    if (addModalMemberLookup.usernames.has(normalized)) return;

    setActionLoading(true);
    setError('');
    try {
      const data = await addListMembers(addUserListId, { usernames: [username] });
      syncListAfterMemberChange(data?.list);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add user');
    } finally {
      setActionLoading(false);
    }
  };

  const requestRemoveMember = (listId, member) => {
    const userId = member.id || member._id;
    setMemberRemoveConfirm({
      listId,
      userId,
      username: member.username,
      name: member.name || member.username,
      memberKey: String(userId || member.username),
    });
  };

  const handleRemoveMember = async () => {
    if (!memberRemoveConfirm) return;
    const { listId, userId, username } = memberRemoveConfirm;
    setActionLoading(true);
    setError('');
    try {
      const payload = userId ? { userIds: [userId] } : { usernames: [username] };
      const data = await removeListMembers(listId, payload);
      syncListAfterMemberChange(data?.list);
      setMemberRemoveConfirm(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove user');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const onUpdate = () => refreshSelectedFeed();
    window.addEventListener('postsUpdated', onUpdate);
    return () => window.removeEventListener('postsUpdated', onUpdate);
  }, [routeListId]);

  const filteredLists = lists.filter((l) =>
    l.name?.toLowerCase().includes(listSearch.trim().toLowerCase())
  );

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
                        isActive={item.label === 'Lists' && isListsRoute}
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
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
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

        {error && (
          <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} className="p-1 hover:bg-red-100 rounded-lg">
              <X size={14} />
            </button>
          </div>
        )}

        {isFeedView ? (
          /* Full-page list feed (like home feed) */
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-white px-6 py-3 shadow-sm">
              <div className="mx-auto max-w-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={closeListFeed}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                    aria-label="Back to lists"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-[#111827] truncate">
                      {selectedList?.name || 'List'}
                    </h1>
                    <p className="text-xs text-[#6B7280]">
                      {selectedList?.members ?? selectedMembers.length ?? 0} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={refreshSelectedFeed}
                    disabled={feedLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={feedLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                  {selectedList && (
                    <>
                      <button
                        type="button"
                        onClick={() => openAddUserModal(selectedList.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#6D28D9]"
                      >
                        <UserPlus size={12} /> Add
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditList(selectedList)}
                        className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[#7C3AED] hover:bg-[#F5F3FF]"
                      >
                        <Pencil size={12} /> Manage
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {selectedMembers.length > 0 && (
              <div className="border-b border-[#E5E7EB] bg-white px-6 py-2">
                <div className="mx-auto max-w-2xl flex gap-2 overflow-x-auto">
                  {selectedMembers.map((m) => (
                    <Link
                      key={m.id || m._id}
                      to={`/user/${m.username}`}
                      className="shrink-0 flex items-center gap-1.5 rounded-full bg-[#F5F3FF] border border-[#EDE9FE] pl-1 pr-2.5 py-1 hover:bg-[#EDE9FE] transition-colors"
                    >
                      {m.profilePhoto ? (
                        <img src={m.profilePhoto} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center">
                          {(m.name || 'U')[0]}
                        </span>
                      )}
                      <span className="text-xs font-medium text-[#5B21B6]">@{m.username}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 sm:px-6 py-5">
              <div className="mx-auto w-full max-w-2xl space-y-4">
                {feedLoading ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="rounded-2xl border border-[#E5E7EB] bg-white p-4 animate-pulse">
                        <div className="flex gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#E5E7EB]" />
                          <div className="flex-1 space-y-2">
                            <div className="h-3 w-1/3 bg-[#E5E7EB] rounded" />
                            <div className="h-3 w-full bg-[#F3F4F6] rounded" />
                            <div className="h-3 w-4/5 bg-[#F3F4F6] rounded" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : feedPosts.length > 0 ? (
                  feedPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
                    <Rss className="mx-auto h-10 w-10 text-[#D1D5DB] mb-3" />
                    <p className="text-sm font-medium text-[#374151]">No posts yet</p>
                    <p className="text-xs text-[#6B7280] mt-1 max-w-sm mx-auto">
                      {feedMessage || "Members haven't posted recently, or the list is empty."}
                    </p>
                    {selectedList && (selectedList.members ?? 0) === 0 && (
                      <button
                        type="button"
                        onClick={() => openAddUserModal(selectedList.id)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                      >
                        <UserPlus size={16} /> Add your first member
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Browse all lists */
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            <div className="shrink-0 bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#8B5CF6] px-6 py-6 text-white">
              <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Your Lists</h1>
                  <p className="text-white/75 text-sm mt-1 max-w-md">
                    Tap a list to open its feed — only posts from people you added.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setModalOpen(true); setError(''); }}
                  className="flex items-center gap-2 rounded-2xl bg-white text-[#6D28D9] px-5 py-2.5 text-sm font-bold shadow-lg shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  <Plus size={18} strokeWidth={2.5} />
                  New List
                </button>
              </div>
            </div>

            <div className="flex-1 px-4 md:px-6 py-4">
              <div className="mx-auto max-w-6xl">
                <div className="mb-4 relative max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                  <input
                    type="text"
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    placeholder="Filter your lists..."
                    className="w-full rounded-xl bg-white border border-[#E5E7EB] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED] shadow-sm"
                  />
                </div>

                {loadingLists ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#6B7280] rounded-2xl border border-[#E5E7EB] bg-white">
                    <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
                    <span className="text-sm">Loading lists...</span>
                  </div>
                ) : filteredLists.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredLists.map((list, idx) => {
                      const color = LIST_COLORS[idx % LIST_COLORS.length];
                      const members = listMembersCache[list.id] || [];
                      const count = list.members ?? list.memberCount ?? 0;

                      return (
                        <div
                          key={list.id}
                          className="group relative rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-lg hover:scale-[1.02] ring-1 ring-[#E5E7EB] hover:ring-[#7C3AED]/40"
                          onClick={() => openListFeed(list)}
                          onMouseEnter={() => {
                            if (!listMembersCache[list.id]) fetchListMembers(list.id);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && openListFeed(list)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className={`bg-gradient-to-br ${color} p-4 text-white`}>
                            <div className="min-w-0">
                              <h3 className="font-bold text-base truncate">{list.name}</h3>
                              <p className="text-xs text-white/80 mt-0.5">
                                {count} {count === 1 ? 'member' : 'members'}
                              </p>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <MemberAvatarStack members={members} />
                              <ChevronRight
                                size={18}
                                className="text-white/70 transition-transform group-hover:translate-x-1"
                              />
                            </div>
                          </div>

                          <div
                            className="flex gap-1 p-2 bg-[#FAFAFA] border-t border-[#F3F4F6] opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Add people"
                              onClick={() => openAddUserModal(list.id)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-[#7C3AED] hover:bg-[#F5F3FF]"
                            >
                              <UserPlus size={12} /> Add
                            </button>
                            <button
                              type="button"
                              title="Edit list"
                              onClick={() => openEditList(list)}
                              className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6]"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              title="Delete list"
                              onClick={() => setDeleteConfirmId(list.id)}
                              className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          {deleteConfirmId === list.id && (
                            <div
                              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm p-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <p className="text-white text-sm font-medium text-center">Delete &quot;{list.name}&quot;?</p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs hover:bg-white/30"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading}
                                  onClick={() => handleDeleteList(list.id)}
                                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : lists.length > 0 ? (
                  <p className="text-center text-sm text-[#6B7280] py-12 rounded-2xl border border-[#E5E7EB] bg-white">
                    No lists match your search
                  </p>
                ) : (
                  <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[#D1D5DB] bg-white">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-[#F5F3FF] flex items-center justify-center text-[#7C3AED] mb-3">
                      <Sparkles size={24} />
                    </div>
                    <p className="text-sm font-medium text-[#111827]">No lists yet</p>
                    <p className="text-xs text-[#6B7280] mt-1 mb-4">Create a list to filter posts from specific people.</p>
                    <button
                      type="button"
                      onClick={() => setModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6D28D9]"
                    >
                      <Plus size={16} /> Create list
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SidebarInset>

      {/* Create List Modal — name only */}
      <Modal open={modalOpen} onClose={() => !actionLoading && setModalOpen(false)} title="Create a list">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">List name</label>
            <input
              type="text"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              placeholder="e.g. CS Squad, Alumni 2024"
              maxLength={80}
              autoFocus
              className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 focus:border-[#7C3AED]"
            />
          </div>
          <button
            type="button"
            disabled={actionLoading || !listName.trim()}
            onClick={handleCreateList}
            className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
            Create list
          </button>
        </div>
      </Modal>

      {/* Edit / Manage Modal */}
      <Modal
        open={editModalOpen}
        onClose={() => {
          if (actionLoading) return;
          setEditModalOpen(false);
          setEditList(null);
          setEditNameInitial('');
          setMemberRemoveConfirm(null);
        }}
        title="Manage list"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Rename list</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl border border-[#E5E7EB] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-[#111827]">Members ({editMembers.length})</p>
              <button
                type="button"
                onClick={() => editList && openAddUserModal(editList.id)}
                className="text-xs text-[#7C3AED] font-semibold flex items-center gap-1 hover:underline"
              >
                <UserPlus size={12} /> Add people
              </button>
            </div>
            {editMembers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-[#E5E7EB] py-8 text-center">
                <Users className="mx-auto h-8 w-8 text-[#9CA3AF] mb-2" />
                <p className="text-xs text-[#6B7280]">No members — add people to filter their posts</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {editMembers.map((m) => {
                  const memberKey = String(m.id || m._id || m.username);
                  const mId = String(m.id || m._id || '');
                  const mUser = (m.username || '').toLowerCase();
                  const isConfirming = memberRemoveConfirm && (
                    (memberRemoveConfirm.userId && mId && String(memberRemoveConfirm.userId) === mId)
                    || (memberRemoveConfirm.username && mUser && memberRemoveConfirm.username.toLowerCase() === mUser)
                  );

                  if (isConfirming) {
                    return (
                      <li
                        key={memberKey}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-3"
                      >
                        <p className="text-sm text-[#111827] text-center mb-3">
                          Do you want to remove{' '}
                          <span className="font-semibold">{memberRemoveConfirm.name}</span> from this list?
                        </p>
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => setMemberRemoveConfirm(null)}
                            className="px-4 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handleRemoveMember}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                            Delete
                          </button>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={memberKey}
                      className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2.5 hover:border-[#C4B5FD] transition-colors"
                    >
                      <Link to={`/user/${m.username}`} className="flex items-center gap-2 min-w-0 flex-1">
                        {m.profilePhoto ? (
                          <img src={m.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-xs font-bold text-white">
                            {(m.name || 'U')[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate text-[#111827]">{m.name}</p>
                          <p className="text-xs text-[#6B7280]">@{m.username}</p>
                        </div>
                      </Link>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => requestRemoveMember(editList.id, m)}
                        className="shrink-0 ml-2 p-2 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-50"
                        title="Remove from list"
                      >
                        <UserMinus size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            disabled={actionLoading || !editName.trim() || !hasEditListChanges}
            onClick={handleSaveEditList}
            className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </Modal>

      {/* Add User Modal */}
      <Modal
        open={addUserModalOpen}
        onClose={() => {
          if (actionLoading) return;
          setAddUserModalOpen(false);
          setAddModalMembers([]);
          setAddUserListId(null);
        }}
        title="Add people"
        size="lg"
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              placeholder="Search name or @username..."
              autoFocus
              className="w-full rounded-xl border border-[#E5E7EB] pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>
          {userSearchLoading && (
            <p className="text-xs text-[#6B7280] flex items-center gap-1 justify-center py-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching...
            </p>
          )}
          <ul className="max-h-72 overflow-y-auto space-y-1">
            {userSearchResults.map((u) => {
              const alreadyAdded = isUserInAddModalList(u);
              return (
                <li key={u._id}>
                  <button
                    type="button"
                    disabled={actionLoading || alreadyAdded}
                    onClick={() => handleAddUserToList(u.username)}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 border text-left transition-all ${
                      alreadyAdded
                        ? 'bg-[#ECFDF5] border-[#A7F3D0] cursor-default'
                        : 'border-transparent hover:bg-[#F5F3FF] hover:border-[#EDE9FE] active:scale-[0.99] disabled:opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {u.profilePhoto ? (
                        <img src={u.profilePhoto} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-[#EDE9FE]" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center text-sm font-bold text-white">
                          {(u.name || 'U')[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-[#111827]">{u.name}</p>
                        <p className="text-xs text-[#6B7280]">@{u.username}</p>
                      </div>
                    </div>
                    {alreadyAdded ? (
                      <span className="flex items-center gap-1 rounded-full bg-[#10B981] px-2.5 py-1 text-[11px] font-semibold text-white">
                        <Check size={14} strokeWidth={2.5} />
                        Added
                      </span>
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7C3AED] text-white">
                        <Plus size={16} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {userSearchQuery.trim().length >= 2 && !userSearchLoading && userSearchResults.length === 0 && (
              <p className="text-xs text-center text-[#6B7280] py-6">No users found</p>
            )}
            {userSearchQuery.trim().length < 2 && (
              <p className="text-xs text-center text-[#9CA3AF] py-6">Type at least 2 characters to search</p>
            )}
          </ul>
        </div>
      </Modal>
    </SidebarProvider>
  );
}
