import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  UsersIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  HashtagIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  DocumentChartBarIcon,
} from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import { getAdminReport } from '../../services/api';
import { downloadCsv, downloadPdf, formatMetricValue } from '../../utils/adminReportExport';

const REPORT_TYPES = [
  { id: 'user-activity', label: 'User activity', icon: UsersIcon },
  { id: 'content-analytics', label: 'Content analytics', icon: ChartBarIcon },
  { id: 'moderation-actions', label: 'Moderation', icon: ShieldCheckIcon },
  { id: 'trends-analysis', label: 'Trends analysis', icon: HashtagIcon },
  { id: 'discussion-forums', label: 'Discussion forums', icon: ChatBubbleLeftRightIcon },
];

const DATE_RANGES = [
  { id: 'last-7-days', label: '7 days' },
  { id: 'last-30-days', label: '30 days' },
  { id: 'last-90-days', label: '90 days' },
  { id: 'last-year', label: '1 year' },
];

const METRIC_CARD_STYLES = [
  'bg-gradient-to-br from-[#193965] to-[#2a4f7a] text-white border-[#193965]',
  'bg-gradient-to-br from-[#1e4a7a] to-[#356291] text-white border-[#1e4a7a]',
  'bg-gradient-to-br from-[#2563a8] to-[#4a7ab5] text-white border-[#2563a8]',
  'bg-gradient-to-br from-[#3b6ea8] to-[#5c8fc4] text-white border-[#3b6ea8]',
];

const ReportsAnalytics = () => {
  const [reportType, setReportType] = useState('user-activity');
  const [dateRange, setDateRange] = useState('last-30-days');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { type: reportType };
      if (useCustomDates) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      } else {
        params.range = dateRange;
      }
      const data = await getAdminReport(params);
      if (data?.success) {
        setReport(data);
      } else {
        setError(data?.error || 'Failed to load report');
        setReport(null);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load report');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [reportType, dateRange, useCustomDates, customStartDate, customEndDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const activeType = REPORT_TYPES.find((t) => t.id === reportType);
  const ActiveTypeIcon = activeType?.icon;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#e8eef5] via-[#f4f6f9] to-[#dce8f5]">
      <AdminSidebar />

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-6 py-8 lg:px-10 lg:py-10">
          {/* Header banner */}
          <div className="rounded-2xl bg-gradient-to-r from-[#193965] via-[#1e4a7a] to-[#2563a8] p-6 sm:p-8 mb-8 shadow-lg shadow-[#193965]/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex rounded-xl bg-white/15 p-3 backdrop-blur-sm">
                  <DocumentChartBarIcon className="w-8 h-8 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Reports &amp; Analytics</h1>
                  <p className="text-blue-100/90 text-sm mt-1">
                    Live campus insights — pick a report and time range
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={loadReport}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[#193965] bg-white rounded-lg hover:bg-blue-50 disabled:opacity-60 shadow-sm shrink-0"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh report
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#193965]/15 shadow-sm shadow-[#193965]/5 p-6 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#193965] mb-4">
              Configure report
            </p>

            <p className="text-sm font-medium text-gray-700 mb-2">Report type</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 mb-5">
              {REPORT_TYPES.map((t) => {
                const Icon = t.icon;
                const active = reportType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setReportType(t.id)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all border ${
                      active
                        ? 'bg-[#193965] text-white border-[#193965] shadow-md shadow-[#193965]/25'
                        : 'bg-blue-50/60 text-[#193965] border-blue-100 hover:bg-blue-100/80 hover:border-[#193965]/30'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                    <span className="text-left leading-tight">{t.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
              <CalendarDaysIcon className="w-4 h-4 text-[#193965]" />
              Date range
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomDates}
                    onChange={(e) => setUseCustomDates(e.target.checked)}
                    className="w-4 h-4 text-[#193965] rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Use custom date range</span>
                </label>
              </div>

              {!useCustomDates ? (
                <div className="flex flex-wrap gap-2">
                  {DATE_RANGES.map((r) => {
                    const active = dateRange === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setDateRange(r.id)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                          active
                            ? 'bg-[#193965] text-white shadow-sm'
                            : 'bg-white text-[#193965] border border-[#193965]/25 hover:bg-blue-50'
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex gap-3 items-end">
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <label className="text-sm font-medium text-gray-700">From:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      disabled={loading}
                      className="text-sm border-none outline-none bg-transparent cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <label className="text-sm font-medium text-gray-700">To:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      disabled={loading}
                      className="text-sm border-none outline-none bg-transparent cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/80 rounded-xl border border-[#193965]/10">
              <div className="animate-spin h-10 w-10 border-2 border-[#193965] border-t-transparent rounded-full" />
              <p className="text-sm text-[#193965] mt-4 font-medium">Building your report…</p>
            </div>
          ) : report ? (
            <div className="bg-white rounded-xl border border-[#193965]/15 shadow-md shadow-[#193965]/8 overflow-hidden">
              {/* Report title bar */}
              <div className="bg-gradient-to-r from-[#193965]/10 via-blue-50 to-[#193965]/5 px-6 py-5 border-b border-[#193965]/10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {ActiveTypeIcon && (
                      <div className="rounded-lg bg-[#193965] p-2.5">
                        <ActiveTypeIcon className="w-5 h-5 text-white" strokeWidth={1.75} />
                      </div>
                    )}
                    <div>
                      <h2 className="text-lg font-bold text-[#193965]">{report.title}</h2>
                      <p className="text-sm text-gray-600 mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#193965]/10 text-[#193965] text-xs font-medium mr-2">
                          {report.rangeLabel}
                        </span>
                        {new Date(report.generatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadPdf(report)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#193965] bg-white border border-[#193965]/30 rounded-lg hover:bg-blue-50 shadow-sm"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Export PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadCsv(report)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#193965] rounded-lg hover:bg-[#0f2a52] shadow-sm"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {report.rangeNote && (
                  <p className="mb-6 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    {report.rangeNote}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  {report.metrics?.map((metric, index) => (
                    <div
                      key={metric.label}
                      className={`rounded-xl border p-4 shadow-sm ${METRIC_CARD_STYLES[index % METRIC_CARD_STYLES.length]}`}
                    >
                      <p className="text-xs font-medium text-blue-100/90 mb-2">{metric.label}</p>
                      <p className="text-2xl font-bold tabular-nums">{formatMetricValue(metric.value)}</p>
                    </div>
                  ))}
                </div>

                {(report.reportType === 'trends-analysis' || report.reportType === 'discussion-forums') &&
                  report.items?.length > 0 && (
                  <div className="mb-8 rounded-xl border border-[#193965]/10 overflow-hidden">
                    <div className="bg-[#193965]/90 px-5 py-3">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                        {report.reportType === 'trends-analysis'
                          ? 'Trending topics'
                          : 'Discussion forums'}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-50/80">
                          <tr className="text-left text-gray-600">
                            <th className="px-4 py-3 font-medium">
                              {report.reportType === 'trends-analysis' ? 'Topic' : 'Forum'}
                            </th>
                            <th className="px-4 py-3 font-medium">Mentions</th>
                            <th className="px-4 py-3 font-medium">Sentiment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {report.items.map((row) => (
                            <tr key={row.id} className="hover:bg-blue-50/40">
                              <td className="px-4 py-3 font-medium text-[#193965]">
                                {row.trend || row.forumName}
                              </td>
                              <td className="px-4 py-3 tabular-nums">
                                {row.mentions ?? row.postsCount ?? 0}
                              </td>
                              <td className="px-4 py-3">{row.sentiment}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {(report.reportType === 'trends-analysis' || report.reportType === 'discussion-forums') &&
                  !report.items?.length && (
                  <p className="mb-8 text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-6 text-center">
                    No {report.reportType === 'trends-analysis' ? 'trending topics' : 'forum activity'} in this
                    period. Try a longer date range.
                  </p>
                )}

                {report.breakdown?.length > 0 &&
                  report.reportType !== 'trends-analysis' &&
                  report.reportType !== 'discussion-forums' && (
                  <div className="mb-8 rounded-xl bg-blue-50/50 border border-[#193965]/10 p-5">
                    <h3 className="text-sm font-bold text-[#193965] uppercase tracking-wide mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-[#193965] rounded-full" />
                      {report.reportType === 'moderation-actions'
                        ? 'Reports by category (post moderation)'
                        : 'Breakdown'}
                    </h3>
                    {report.reportType === 'community-health' ? (
                      <div className="flex items-end justify-between gap-4 max-w-md mx-auto sm:mx-0">
                        {report.breakdown.map((item) => (
                          <div key={item.label} className="flex-1 text-center">
                            <div
                              className="mx-auto w-full max-w-[72px] rounded-t-lg shadow-sm"
                              style={{
                                height: `${Math.max(16, item.value * 1.1)}px`,
                                backgroundColor: item.color || '#9ca3af',
                              }}
                            />
                            <p className="mt-2 text-lg font-bold text-[#193965] tabular-nums">{item.value}%</p>
                            <p className="text-xs text-gray-600 font-medium">{item.label}</p>
                          </div>
                        ))}
                      </div>
                    ) : report.reportType === 'moderation-actions' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                        {report.breakdown.map((item) => {
                          const isHate = item.label === 'Hate Speech';
                          return (
                            <div
                              key={item.label}
                              className={`rounded-xl border-2 p-5 ${
                                isHate
                                  ? 'border-red-200 bg-red-50/80'
                                  : 'border-amber-200 bg-amber-50/80'
                              }`}
                            >
                              <p
                                className={`text-sm font-semibold mb-2 ${
                                  isHate ? 'text-red-800' : 'text-amber-900'
                                }`}
                              >
                                {item.label}
                              </p>
                              <p
                                className={`text-3xl font-bold tabular-nums ${
                                  isHate ? 'text-red-700' : 'text-amber-800'
                                }`}
                              >
                                {formatMetricValue(item.value)}
                              </p>
                              <p className="text-xs text-gray-600 mt-2">Pending reports in this category</p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <ul className="divide-y divide-[#193965]/10 max-w-lg">
                        {report.breakdown.map((item) => (
                          <li key={item.label} className="flex justify-between py-3 text-sm">
                            <span className="text-gray-700 font-medium">{item.label}</span>
                            <span className="font-bold text-[#193965] tabular-nums">
                              {formatMetricValue(item.value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {report.reportType !== 'moderation-actions' && (
                  <div className="rounded-xl border border-[#193965]/10 overflow-hidden">
                    <div className="bg-[#193965] px-5 py-3">
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
                        Detailed statistics
                      </h3>
                    </div>
                    <ul className="divide-y divide-blue-100 bg-white">
                      {report.details?.map((row, i) => (
                        <li
                          key={row.label}
                          className={`flex justify-between py-3.5 px-5 text-sm ${
                            i % 2 === 0 ? 'bg-blue-50/30' : 'bg-white'
                          }`}
                        >
                          <span className="text-gray-700">{row.label}</span>
                          <span className="font-semibold text-[#193965] tabular-nums">
                            {formatMetricValue(row.value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default ReportsAnalytics;
