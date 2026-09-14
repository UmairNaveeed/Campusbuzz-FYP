import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  Building2,
  Hash,
  Home,
  List,
  Mail,
  MessageSquare,
  PlusCircle,
  UserCircle,
} from 'lucide-react';
import TrendCard from './TrendCard';
import { getDepartmentTrendAnalytics } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
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

export default function DepartmentTrends() {
  const navigate = useNavigate();
  const { departmentId } = useParams();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trends, setTrends] = useState([]);
  const [schoolLabel, setSchoolLabel] = useState('');
  const [departmentLabel, setDepartmentLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!departmentId) return;
      setLoading(true);
      setError('');
      try {
        const data = await getDepartmentTrendAnalytics(departmentId);
        if (cancelled) return;
        if (data?.success) {
          setTrends((data.topTrendingTopics || []).map((row, i) => ({
            id: String(row.topic || row.hashtag || i),
            hashtag: String(row.topic || row.hashtag || '').replace(/^#/, ''),
            posts: row.engagement ?? 0,
            department: data.scope?.departmentLabel || data.scope?.department || '',
            trending: true,
          })));
          setDepartmentLabel(data.scope?.departmentLabel || data.scope?.department || '');
          setSchoolLabel(data.scope?.schoolLabel || data.scope?.school || '');
        } else {
          setError(data?.error || 'Could not load department trends.');
        }
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load department trends.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [departmentId]);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const initial = (displayName || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { label: 'Profile', icon: UserCircle, to: '/profile' },
    { label: 'Home Feed', icon: Home, to: '/home' },
    { label: 'Create Post', icon: PlusCircle, action: openCreatePost },
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
            CampusBuzz
          </Link>
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase text-[11px] tracking-[0.12em] text-white/60">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.action ? (
                      <SidebarMenuButton onClick={item.action} className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10">
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </div>
                      </SidebarMenuButton>
                    ) : (
                      <SidebarMenuButton asChild className={`text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10 ${item.to === '/explore' ? 'data-[active=true]' : ''}`}>
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
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
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
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate('/explore')}
              className="inline-flex items-center gap-2 rounded-full border border-[#E9D5FF] bg-white px-4 py-2 text-sm font-semibold text-[#5B21B6] shadow-sm transition hover:border-[#C4B5FD] hover:bg-[#FAF5FF]"
            >
              <ArrowLeft size={18} className="opacity-90" aria-hidden /> Back to trends
            </button>
          </div>

          <div className="overflow-hidden rounded-3xl border border-[#E9D5FF]/90 bg-white shadow-[0_20px_50px_-28px_rgba(91,33,182,0.55)] ring-1 ring-black/[0.03] mb-6">
            <div className="relative isolate overflow-hidden bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#A78BFA] px-6 pb-10 pt-8 text-white md:px-8">
              <div className="relative flex items-start gap-4">
                <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-inner ring-2 ring-white/30 backdrop-blur-sm">
                  <Building2 className="h-9 w-9 text-white opacity-95" strokeWidth={1.75} aria-hidden />
                </div>
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/95 ring-1 ring-white/25 backdrop-blur-sm">
                    {schoolLabel}
                  </span>
                  <h1 className="mt-3 text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">
                    {departmentLabel}
                  </h1>
                </div>
              </div>
            </div>
          </div>

          <h2 className="mb-4 text-lg font-bold text-[#111827]">Trending hashtags</h2>
          {loading ? (
            <p className="text-[#6B7280] py-4">Loading trends…</p>
          ) : error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>
          ) : trends.length > 0 ? (
            <div className="space-y-3">
              {trends.map((trend, i) => (
                <TrendCard
                  key={`${trend.id}-${trend.hashtag}`}
                  trend={trend}
                  rank={i + 1}
                  onClick={(tag) => navigate(`/hashtag/${encodeURIComponent(tag)}?departmentId=${encodeURIComponent(departmentId)}`)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[#6B7280] py-4">No trending hashtags in this department yet.</p>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
