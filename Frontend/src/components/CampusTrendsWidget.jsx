import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { getTrendingHashtags, getMyDepartmentTrendAnalytics } from '../services/api';
import { mapBackendHashtagToTrend } from '../utils/postMappers';
import { useProfile } from '../context/ProfileContext';
import { formatDepartmentLabel } from '../utils/departmentLabel';

const MAX_ITEMS = 5;
const DEPT_TREND_SLOTS = 2;
const UNIVERSITY_CATEGORY = 'University-wide · Trending';

function isValidHashtag(tag) {
  const clean = String(tag || '').replace(/^#/, '').trim();
  return clean.length > 0 && clean.toLowerCase() !== 'undefined';
}

function formatCount(n, label) {
  const num = Number(n) || 0;
  if (num >= 1000) return `${(num / 1000).toFixed(1).replace(/\.0$/, '')}K ${label}`;
  return `${num.toLocaleString()} ${label}`;
}

function mapDeptTopic(row, departmentLabel, departmentId) {
  const tag = String(row.topic || row.hashtag || '').replace(/^#/, '');
  return {
    id: `dept-${tag}`,
    hashtag: tag,
    posts: row.engagement ?? 0,
    countLabel: 'engagement',
    categoryLabel: `${departmentLabel} · Trending`,
    departmentId: departmentId || null,
    scope: 'department',
    trending: true,
  };
}

function mapCampusTrend(h, index) {
  const base = mapBackendHashtagToTrend(h, index);
  return {
    ...base,
    categoryLabel: UNIVERSITY_CATEGORY,
    departmentId: null,
    scope: 'campus',
    countLabel: 'posts',
  };
}

function TrendRow({ trend, rank, onSelect }) {
  const countLabel = trend.countLabel || 'posts';
  return (
    <button
      type="button"
      onClick={() => onSelect(trend)}
      className="group w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[#f4f2ff]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#8a90a5] truncate">
            {rank}. {trend.categoryLabel || UNIVERSITY_CATEGORY}
          </p>
          <p className="mt-0.5 text-[15px] font-bold text-[#2f3348] truncate group-hover:text-[#6b5afc] transition-colors">
            #{trend.hashtag}
          </p>
          <p className="mt-0.5 text-[12px] text-[#8a90a5]">
            {formatCount(trend.posts ?? 0, countLabel)}
          </p>
        </div>
        {trend.trending && (
          <TrendingUp size={14} className="shrink-0 text-[#16a34a] mt-1 opacity-80" aria-hidden />
        )}
      </div>
    </button>
  );
}

function buildSidebarTrends(deptTopics, deptLabel, deptId, campusHashtags) {
  const used = new Set();

  const deptItems = (deptTopics || [])
    .map((row) => mapDeptTopic(row, deptLabel, deptId))
    .filter((t) => isValidHashtag(t.hashtag) && (t.posts ?? 0) > 0)
    .slice(0, DEPT_TREND_SLOTS);

  deptItems.forEach((t) => used.add(t.hashtag.toLowerCase()));

  const campusItems = (campusHashtags || [])
    .map((h, i) => mapCampusTrend(h, i))
    .filter(
      (t) =>
        isValidHashtag(t.hashtag) &&
        (t.posts ?? 0) > 0 &&
        !used.has(t.hashtag.toLowerCase())
    );

  return [...deptItems, ...campusItems].slice(0, MAX_ITEMS);
}

/**
 * Sidebar trends: top 2 from the user's department, then university-wide.
 */
export default function CampusTrendsWidget({ className = '' }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [displayed, setDisplayed] = useState([]);
  const [deptLabel, setDeptLabel] = useState('');
  const [loading, setLoading] = useState(true);

  const profileDept = formatDepartmentLabel(profile?.department || '');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getTrendingHashtags(80).catch(() => ({ hashtags: [] })),
      getMyDepartmentTrendAnalytics().catch(() => ({
        success: true,
        topTrendingTopics: [],
        scope: null,
      })),
    ])
      .then(([campusData, deptData]) => {
        if (cancelled) return;

        const scope = deptData?.scope;
        const label =
          scope?.departmentLabel ||
          (profileDept ? profileDept : '') ||
          'Your department';
        const deptId = scope?.departmentId || null;
        const deptTopics = deptData?.topTrendingTopics || [];
        const campusRaw = campusData?.hashtags || [];

        setDeptLabel(label);
        setDisplayed(buildSidebarTrends(deptTopics, label, deptId, campusRaw));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileDept]);

  const goToTrend = (trend) => {
    const clean = String(trend.hashtag || '').replace(/^#/, '').trim();
    if (!isValidHashtag(clean)) return;
    const q = trend.departmentId
      ? `?departmentId=${encodeURIComponent(trend.departmentId)}`
      : '';
    navigate(`/hashtag/${encodeURIComponent(clean)}${q}`);
  };

  return (
    <div className={`bg-white border border-[#dfe2eb] rounded-2xl overflow-hidden ${className}`}>
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xl font-bold text-[#2f3348]">Trending on Campus</h3>
          <Link
            to="/explore"
            className="text-xs font-semibold text-[#6b5afc] hover:text-[#5b4aef] shrink-0"
          >
            See all
          </Link>
        </div>
      </div>

      <div className="px-1 pb-2 min-h-[120px]">
        {loading ? (
          <div className="px-3 py-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 w-1/3 bg-[#ececf4] rounded" />
                <div className="h-4 w-2/3 bg-[#ececf4] rounded" />
                <div className="h-2.5 w-1/4 bg-[#ececf4] rounded" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-[#8a90a5] text-center py-8 px-4">
            No trends yet. Post with hashtags to start one in your department or campus-wide.
          </p>
        ) : (
          <div className="divide-y divide-[#f0f1f5]">
            {displayed.map((trend, i) => (
              <TrendRow
                key={`${trend.scope}-${trend.id}-${trend.hashtag}`}
                trend={trend}
                rank={i + 1}
                onSelect={goToTrend}
              />
            ))}
          </div>
        )}
      </div>

      <Link
        to="/explore"
        className="flex items-center justify-center gap-1 py-3 text-sm font-medium text-[#6b5afc] hover:bg-[#faf9ff] border-t border-[#f0f1f5] transition-colors"
      >
        Show more
      </Link>
    </div>
  );
}
