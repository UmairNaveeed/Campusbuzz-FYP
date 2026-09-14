import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowPathIcon,
  UsersIcon,
  DocumentTextIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import { getAdminDashboardStats } from '../../services/api';

function StatCard({ icon: Icon, label, value, hint, onClick, alert, accent }) {
  const Wrapper = onClick ? 'button' : 'div';
  const accentClasses = {
    blue: 'bg-blue-50/80 border-blue-100 text-slate-900',
    purple: 'bg-violet-50/80 border-violet-100 text-slate-900',
    amber: 'bg-amber-50/80 border-amber-100 text-slate-900',
  }[accent] || 'bg-white';

  const iconClasses = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
  }[accent] || 'bg-[#193965]/8 text-[#193965]';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-5 transition-all ${accentClasses} ${
        onClick ? 'hover:shadow-lg cursor-pointer' : ''
      } ${alert ? 'border-amber-300 bg-amber-50/40' : ''}`}
    >
      <div className={`rounded-lg p-2.5 w-fit ${iconClasses}`}>
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-2xl font-semibold text-[#212529] tracking-tight">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-900">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
    </Wrapper>
  );
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const [reportOverview, setReportOverview] = useState([]);
  const [moodBreakdown, setMoodBreakdown] = useState([]);
  const [approvedAlumni, setApprovedAlumni] = useState([]);

  const defaultStartDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  })();
  const defaultEndDate = new Date().toISOString().split('T')[0];

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminDashboardStats(defaultStartDate, defaultEndDate);
      if (data?.success) {
        setStats(data.stats || null);
        setReportOverview(data.reportOverview || []);
        setMoodBreakdown(data.sentimentSummary || []);
        setApprovedAlumni(data.approvedAlumni || []);
      } else {
        setError(data?.error || 'Failed to load dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const totalReports = reportOverview.reduce((sum, r) => sum + r.count, 0);
  const moodScore = Math.max(0, Math.min(100, stats?.moodScore ?? 0));
  const hasMoodData = moodBreakdown.some((s) => s.percentage > 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] lg:flex-row">
      <AdminSidebar />

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-6 py-8 lg:px-10 lg:py-10">
          <div className="rounded-[2rem] bg-white px-6 py-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/70 lg:px-8 lg:py-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-[#193965] font-semibold">Admin Dashboard</p>
                <h1 className="mt-3 text-3xl font-semibold text-[#0f172a]">Campus performance</h1>
              </div>

              <button
                type="button"
                onClick={() => loadDashboard()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-[#193965] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#13294d] disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-24">
              <div className="animate-spin h-11 w-11 border-2 border-[#193965] border-t-transparent rounded-full" />
            </div>
          ) : stats ? (
            <div className="space-y-8 mt-8">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  icon={UsersIcon}
                  label="Campus users"
                  value={stats.totalUsers}
                  hint={`${stats.activeUsers?.toLocaleString() ?? 0} active · ${stats.suspendedUsers ?? 0} suspended`}
                  onClick={() => navigate('/user-management')}
                  accent="blue"
                />
                <StatCard
                  icon={DocumentTextIcon}
                  label="Total posts"
                  value={stats.totalPosts}
                  hint={`${stats.postsInRange?.toLocaleString() ?? 0} in range`}
                  accent="purple"
                />
                <StatCard
                  icon={ShieldExclamationIcon}
                  label="Reported posts"
                  value={stats.pendingReportedPosts}
                  hint={totalReports > 0 ? `${totalReports} pending reports` : 'No active reports'}
                  onClick={() => navigate('/post-moderation')}
                  alert={stats.pendingReportedPosts > 0}
                  accent="amber"
                />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5 gap-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Report types</h2>
                      <p className="mt-2 text-sm text-slate-500">Where attention is needed most.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/post-moderation')}
                      className="rounded-full bg-slate-50 px-4 py-2 text-xs font-semibold text-[#193965] hover:bg-slate-100"
                    >
                      Open moderation
                    </button>
                  </div>
                  {reportOverview.length === 0 ? (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
                      No pending reports — the feed is currently clear.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {reportOverview.map((report) => (
                        <li key={report.type} className="flex items-center justify-between rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
                          <span className="text-sm font-medium text-slate-700">{report.type}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">{report.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5 gap-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Campus mood</h2>
                      <p className="mt-2 text-sm text-slate-500">Sentiment from recent posts.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/sentiment-analysis')}
                      className="rounded-full bg-slate-50 px-4 py-2 text-xs font-semibold text-[#193965] hover:bg-slate-100"
                    >
                      View details
                    </button>
                  </div>

                  {!hasMoodData && stats.postsInRange === 0 ? (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
                      Not enough posts in this date range to calculate mood.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="rounded-3xl bg-[#eff6ff] p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm text-slate-500">Overall mood score</p>
                            <p className="mt-2 text-3xl font-semibold text-slate-900">{moodScore}%</p>
                          </div>
                          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm">
                            {stats.postsInRange?.toLocaleString() ?? 0} posts
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {moodBreakdown.map((item) => (
                          <div key={item.label} className="rounded-3xl border border-slate-100 bg-slate-50 p-4 text-center">
                            <div className="mx-auto mb-3 h-12 w-12 rounded-full" style={{ backgroundColor: item.color }} />
                            <p className="text-lg font-semibold text-slate-900 tabular-nums">{item.percentage}%</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5 gap-3">
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Approved alumni</h2>
                      <p className="mt-2 text-sm text-slate-500">Users whose alumni signup requests were accepted.</p>
                    </div>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-semibold text-violet-700">
                      {stats.approvedAlumniCount ?? approvedAlumni.length}
                    </span>
                  </div>

                  {approvedAlumni.length === 0 ? (
                    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-500">
                      No approved alumni yet.
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {approvedAlumni.map((alumni) => (
                        <li key={alumni.email || alumni.username || alumni.name} className="rounded-3xl border border-slate-100 bg-slate-50 px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{alumni.name || 'Unnamed alumni'}</p>
                              <p className="mt-1 text-sm text-slate-500">{alumni.email || 'No email provided'}</p>
                            </div>
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {alumni.username ? `@${alumni.username}` : 'No username'}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
