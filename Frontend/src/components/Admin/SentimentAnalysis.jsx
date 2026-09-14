import React, { useState, useEffect, useCallback } from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import { getAdminSentimentOverview } from '../../services/api';

const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'discussions', label: 'Discussions' },
  { id: 'trends', label: 'Trends' },
];

const RANGE_MAP = { Weekly: 'weekly', Monthly: 'monthly', Yearly: 'yearly' };
const EMPTY_DIST = { overall: 0, positive: 0, neutral: 0, negative: 0, total: 0 };

function DonutChart({ distribution }) {
  const { positive, neutral, negative, overall, total } = distribution;
  const circumference = 2 * Math.PI * 90;

  if (!total) {
    return (
      <div className="w-56 h-56 flex items-center justify-center rounded-full border-[28px] border-gray-200">
        <span className="text-gray-400 text-sm text-center px-4">No data yet</span>
      </div>
    );
  }

  const neutralDash = (neutral / 100) * circumference;
  const positiveDash = (positive / 100) * circumference;
  const negativeDash = (negative / 100) * circumference;

  return (
    <div className="relative w-56 h-56">
      <svg className="transform -rotate-90 w-56 h-56" viewBox="0 0 256 256">
        <circle cx="128" cy="128" r="90" fill="none" stroke="#e5e7eb" strokeWidth="32" />
        <circle cx="128" cy="128" r="90" fill="none" stroke="#9ca3af" strokeWidth="32" strokeDasharray={`${neutralDash} ${circumference}`} strokeLinecap="round" />
        <circle cx="128" cy="128" r="90" fill="none" stroke="#22c55e" strokeWidth="32" strokeDasharray={`${positiveDash} ${circumference}`} strokeDashoffset={-neutralDash} strokeLinecap="round" />
        <circle cx="128" cy="128" r="90" fill="none" stroke="#ef4444" strokeWidth="32" strokeDasharray={`${negativeDash} ${circumference}`} strokeDashoffset={-(neutralDash + positiveDash)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center flex-col">
        <p className="text-3xl font-bold text-[#212529]">{Math.max(0, Math.min(100, overall))}%</p>
        <p className="text-xs text-gray-500">Mood score (0–100)</p>
      </div>
    </div>
  );
}

const SentimentAnalysis = () => {
  const [selectedTab, setSelectedTab] = useState('discussions');
  const [timeRange, setTimeRange] = useState('Weekly');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [distribution, setDistribution] = useState(EMPTY_DIST);
  const [samples, setSamples] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mlAvailable, setMlAvailable] = useState(null);
  const [forumOptions, setForumOptions] = useState([]);
  const [rangeNote, setRangeNote] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        tab: selectedTab,
        q: appliedKeyword,
      };
      
      if (useCustomDates) {
        params.startDate = customStartDate;
        params.endDate = customEndDate;
      } else {
        params.range = RANGE_MAP[timeRange] || 'weekly';
      }
      
      const data = await getAdminSentimentOverview(params);
      if (data?.success) {
        setDistribution(data.distribution || EMPTY_DIST);
        setSamples(data.samples || []);
        setItems(data.items || []);
        setMlAvailable(data.mlServiceAvailable ?? null);
        setForumOptions(data.forumOptions || []);
        setRangeNote(data.rangeNote || '');
      } else {
        setError(data?.error || 'Failed to load sentiment');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load sentiment');
    } finally {
      setLoading(false);
    }
  }, [selectedTab, timeRange, appliedKeyword, useCustomDates, customStartDate, customEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-8 min-w-0">
        <div className="max-w-5xl">
          <div className="mb-6 flex justify-between items-start gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-[#212529]">Sentiment Analysis</h1>
              <p className="text-gray-600 text-sm mt-1">Live % from your campus data (ML + stored labels).</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#193965] border border-[#193965] rounded-lg hover:bg-blue-50 disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {mlAvailable === true && (
            <p className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              ML service connected — full model analysis is active.
            </p>
          )}
          {mlAvailable === false && (
            <p className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              ML service offline — using keyword fallback. In a terminal run: cd MLService → .\venv\Scripts\python.exe app.py (port 5001), then Refresh.
            </p>
          )}
          {rangeNote && (
            <p className="mb-3 text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {rangeNote}
            </p>
          )}
          {error && (
            <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-2 border-b border-gray-200 mb-4">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTab(t.id)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px ${
                  selectedTab === t.id ? 'border-[#193965] text-[#193965]' : 'border-transparent text-gray-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mb-4 flex gap-2 flex-wrap items-center">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="search"
                list={selectedTab === 'discussions' ? 'forum-names-list' : undefined}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setAppliedKeyword(keyword.trim())}
                placeholder={
                  selectedTab === 'discussions'
                    ? 'Forum name e.g. FYP (matches group title)'
                    : selectedTab === 'trends'
                      ? 'Topic e.g. session or gift'
                      : 'Search post text (optional)'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              {selectedTab === 'discussions' && forumOptions.length > 0 && (
                <datalist id="forum-names-list">
                  {forumOptions.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAppliedKeyword(keyword.trim())}
              className="px-4 py-2 bg-[#193965] text-white text-sm font-medium rounded-lg"
            >
              Apply
            </button>
            {appliedKeyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('');
                  setAppliedKeyword('');
                }}
                className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="Weekly">Last 7 days</option>
              <option value="Monthly">Last 30 days</option>
              <option value="Yearly">Last year</option>
            </select>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin h-10 w-10 border-2 border-[#193965] border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-10">
                <DonutChart distribution={distribution} />
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-gray-600">
                    <strong>{distribution.total}</strong> items analyzed
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-800">{distribution.positive}%</p>
                      <p className="text-xs text-green-700">Positive ({distribution.positiveCount ?? 0})</p>
                    </div>
                    <div className="bg-gray-50 border rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-800">{distribution.neutral}%</p>
                      <p className="text-xs text-gray-600">Neutral ({distribution.neutralCount ?? 0})</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-red-800">{distribution.negative}%</p>
                      <p className="text-xs text-red-700">Negative ({distribution.negativeCount ?? 0})</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loading && selectedTab === 'posts' && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h2 className="text-lg font-semibold text-[#212529] mb-3">Recent posts</h2>
                {samples.length === 0 ? (
                  <p className="text-sm text-gray-500">No posts in this time range. Try &quot;Last 30 days&quot; or clear the search filter.</p>
                ) : (
                  <ul className="space-y-2 max-h-80 overflow-y-auto">
                    {samples.map((row) => (
                      <li key={row.id} className="flex gap-3 justify-between items-start text-sm border border-gray-100 rounded-lg px-3 py-2">
                        <span className="text-gray-800 flex-1">{row.text}</span>
                        <span className={`shrink-0 font-medium ${
                          row.sentiment === 'Positive' ? 'text-green-700' :
                          row.sentiment === 'Negative' ? 'text-red-700' : 'text-gray-600'
                        }`}>
                          {row.sentiment} ({row.confidence}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default SentimentAnalysis;
