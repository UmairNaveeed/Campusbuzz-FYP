import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Building2,
  Hash,
  Home,
  List,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  UserCircle,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link } from 'react-router-dom';
import TrendCard from './TrendCard';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import {
  getTrendingHashtags,
  getTrendAnalyticsSchoolsMeta,
} from '../services/api';
import { mapBackendHashtagToTrend } from '../utils/postMappers';
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

function mapDeptTopicToTrend(row, index, departmentLabel) {
  const tag = String(row.topic || row.hashtag || '').replace(/^#/, '');
  return {
    id: tag || String(index),
    hashtag: tag,
    posts: row.engagement ?? 0,
    department: departmentLabel,
    trending: true,
  };
}

/** Campus scope + schools (no “All” — default is university-wide). */
const EXPLORE_SCHOOL_IDS = ['SEAS', 'SAAS', 'SFADA', 'GBS'];

const SCHOOL_CHIP_HINT = {
  SEAS: 'Engineering & computing',
  SAAS: 'Arts, humanities & sciences',
  SFADA: 'Design & fine arts',
  GBS: 'Business & commerce',
};

function ExploreScopePicker({
  schools,
  schoolsLoading,
  schoolsError,
  view,
  trendScope,
  selectedSchool,
  onSelectUniversity,
  onSelectSchool,
}) {
  const universityActive = view === 'trends' && trendScope === 'University-wide';

  const baseBtn =
    'relative flex min-h-[72px] flex-1 min-w-[7.5rem] flex-col items-center justify-center gap-1 rounded-xl px-3 py-3 text-center transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7C3AED]';
  const activeBtn = 'bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/25';
  const idleBtn =
    'bg-white text-[#374151] ring-1 ring-[#E5E7EB] hover:bg-[#FAF5FF] hover:ring-[#C4B5FD] hover:text-[#5B21B6] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white disabled:hover:ring-[#E5E7EB]';

  return (
    <section className="mt-5" aria-label="Trend scope and schools">
      <p className="mb-3 text-sm text-[#6B7280]">
        Campus-wide hashtags or trends inside a school.
      </p>
      <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FC] p-2 shadow-sm">
        <div
          className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={universityActive}
            onClick={onSelectUniversity}
            className={`${baseBtn} ${universityActive ? activeBtn : idleBtn}`}
          >
            <Building2
              size={20}
              strokeWidth={2}
              className={universityActive ? 'text-white' : 'text-[#7C3AED]'}
              aria-hidden
            />
            <span className="text-sm font-bold leading-tight">University-wide</span>
            <span
              className={`text-[10px] font-medium leading-tight ${
                universityActive ? 'text-white/85' : 'text-[#9CA3AF]'
              }`}
            >
              All schools
            </span>
          </button>

          {EXPLORE_SCHOOL_IDS.map((schoolId) => {
            const school = schools.find((s) => s.id === schoolId);
            const disabled = schoolsLoading || !school || !!schoolsError;
            const active = view === 'departments' && selectedSchool?.id === schoolId;

            return (
              <button
                key={schoolId}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={disabled}
                title={school?.fullName || schoolId}
                onClick={() => school && onSelectSchool(school)}
                className={`${baseBtn} ${active ? activeBtn : idleBtn}`}
              >
                <span className="text-base font-bold tracking-tight">{schoolId}</span>
                <span
                  className={`max-w-[8.5rem] text-[10px] font-medium leading-tight line-clamp-2 ${
                    active ? 'text-white/85' : 'text-[#9CA3AF]'
                  }`}
                >
                  {SCHOOL_CHIP_HINT[schoolId] || school?.shortName || schoolId}
                </span>
              </button>
            );
          })}
        </div>
        {schoolsLoading && (
          <p className="mt-2 px-1 text-center text-xs text-[#9CA3AF]">Loading schools…</p>
        )}
      </div>
    </section>
  );
}

function metaLoadFailureMessage(error) {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const backendErr = typeof data?.error === 'string' ? data.error : null;

  if (!error?.response) {
    const isNetwork =
      error?.code === 'ERR_NETWORK' ||
      error?.code === 'ECONNABORTED' ||
      (typeof error?.message === 'string' && error.message.includes('Network Error'));
    return isNetwork
      ? 'Cannot reach the API server. Start the backend and check VITE_API_URL.'
      : (backendErr || error?.message || 'Could not load schools.');
  }
  if (status === 401) {
    return backendErr || 'Unauthorized.';
  }
  if (status === 404) {
    return 'School list endpoint not found — restart/update the backend.';
  }
  return backendErr || `Could not load schools (HTTP ${status}).`;
}

export default function Trending() {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();

  /** 'trends' = campus-wide; 'departments' = school dept list + hashtag trends only */
  const [view, setView] = useState('trends');
  const [trendScope, setTrendScope] = useState('University-wide');
  const [trends, setTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(true);

  const [schools, setSchools] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsError, setSchoolsError] = useState('');

  const [selectedSchool, setSelectedSchool] = useState(null);
  // department-specific trends moved to dedicated page

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    setTrendsLoading(true);
    getTrendingHashtags(120)
      .then((data) => {
        if (cancelled) return;
        const list = (data?.hashtags || []).map((h, i) => mapBackendHashtagToTrend(h, i));
        setTrends(list);
      })
      .catch(() => {
        if (!cancelled) setTrends([]);
      })
      .finally(() => {
        if (!cancelled) setTrendsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSchoolsLoading(true);
    setSchoolsError('');
    getTrendAnalyticsSchoolsMeta()
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.schools)) setSchools(data.schools);
        else setSchoolsError('Could not load school list.');
      })
      .catch((err) => {
        if (!cancelled) setSchoolsError(metaLoadFailureMessage(err));
      })
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const openSchool = useCallback((school) => {
    setSelectedSchool(school);
    setView('departments');
  }, []);

  const openSchoolById = useCallback(
    (schoolId) => {
      const s = schools.find((x) => x.id === schoolId);
      if (s) openSchool(s);
    },
    [schools, openSchool]
  );

  const backToTrendsHome = useCallback(() => {
    setView('trends');
    setSelectedSchool(null);
    // clear any department selection state (department page moved to its own route)
  }, []);

  const goToTopicPosts = useCallback(
    (tag, departmentId) => {
      const clean = String(tag || '').replace(/^#/, '').trim();
      if (!clean) return;
      const q = departmentId ? `?departmentId=${encodeURIComponent(departmentId)}` : '';
      navigate(`/hashtag/${encodeURIComponent(clean)}${q}`);
    },
    [navigate]
  );

  // Navigate to a dedicated department page.
  const selectDepartment = useCallback((dept) => {
    if (!dept?.id) return;
    navigate(`/explore/department/${encodeURIComponent(dept.id)}`);
  }, [navigate]);

  // department trends are now handled on the dedicated page

  const filteredTrends = trends.filter((t) => {
    const tag = String(t.hashtag || '').replace(/^#/, '').trim();
    return (
      t.department === 'University-wide' &&
      (t.posts ?? 0) > 1 &&
      tag.length > 0 &&
      tag.toLowerCase() !== 'undefined'
    );
  });

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

        <div className="px-4 sm:px-6 py-5 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl">
            {view === 'trends' && (
              <>
                <div className="mb-8">
                  <h1 className="text-2xl font-bold tracking-tight text-[#111827] sm:text-3xl">
                    Trending on Campus
                  </h1>
                  <ExploreScopePicker
                    schools={schools}
                    schoolsLoading={schoolsLoading}
                    schoolsError={schoolsError}
                    view={view}
                    trendScope={trendScope}
                    selectedSchool={selectedSchool}
                    onSelectUniversity={() => {
                      backToTrendsHome();
                      setTrendScope('University-wide');
                    }}
                    onSelectSchool={openSchool}
                  />
                </div>
                {schoolsError && !schoolsLoading && (
                  <p className="-mt-2 mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    School dashboards unavailable: {schoolsError}
                  </p>
                )}

                <h2 className="mb-4 text-lg font-bold text-[#111827]">Trending hashtags</h2>
                <div className="space-y-3">
                  {trendsLoading ? (
                    <p className="text-[#6B7280] py-4">Loading trends…</p>
                  ) : filteredTrends.length > 0 ? (
                    filteredTrends.map((trend, i) => (
                      <TrendCard
                        key={`${trend.id}-${trend.hashtag}`}
                        trend={trend}
                        rank={i + 1}
                        onClick={(tag) => goToTopicPosts(tag)}
                      />
                    ))
                  ) : (
                    <p className="text-[#6B7280] py-4">No trends to show yet.</p>
                  )}
                </div>
              </>
            )}

            {view === 'departments' && selectedSchool && (
              <div className="space-y-6 pb-4">
                <button
                  type="button"
                  onClick={backToTrendsHome}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E9D5FF] bg-white px-4 py-2 text-sm font-semibold text-[#5B21B6] shadow-sm transition hover:border-[#C4B5FD] hover:bg-[#FAF5FF]"
                >
                  <ArrowLeft size={18} className="opacity-90" aria-hidden /> Back to trends
                </button>

                <ExploreScopePicker
                  schools={schools}
                  schoolsLoading={schoolsLoading}
                  schoolsError={schoolsError}
                  view={view}
                  trendScope={trendScope}
                  selectedSchool={selectedSchool}
                  onSelectUniversity={() => {
                    backToTrendsHome();
                    setTrendScope('University-wide');
                  }}
                  onSelectSchool={openSchool}
                />

                <div className="overflow-hidden rounded-3xl border border-[#E9D5FF]/90 bg-white shadow-[0_20px_50px_-28px_rgba(91,33,182,0.55)] ring-1 ring-black/[0.03]">
                  <div className="relative isolate overflow-hidden bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#A78BFA] px-6 pb-10 pt-8 text-white md:px-8">
                    <div
                      className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-indigo-500/35 blur-2xl"
                      aria-hidden
                    />
                    <div className="relative flex items-start gap-4">
                      <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-2 ring-white/30 backdrop-blur-sm">
                        <Building2 className="h-9 w-9 text-white opacity-95" strokeWidth={1.75} aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/95 ring-1 ring-white/25 backdrop-blur-sm">
                          {selectedSchool.shortName}
                        </span>
                        <h1 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                          {selectedSchool.fullName}
                        </h1>
                        {selectedSchool.description && (
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90">
                            {selectedSchool.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#F3E8FF] bg-gradient-to-b from-[#FAFBFF] to-[#F3F4F8] px-6 py-6 md:px-8">
                    <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[#7C3AED]">
                      Departments
                    </h2>
                    <ul className="flex max-w-md flex-col gap-2">
                      {(selectedSchool.departments || []).map((d) => (
                        <li key={d.id}>
                          <button
                            type="button"
                            onClick={() => selectDepartment(d)}
                            className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                              'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#C4B5FD] hover:bg-[#FAF5FF] hover:text-[#5B21B6]'
                            }`}
                          >
                            {d.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                
              </div>
            )}

          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
