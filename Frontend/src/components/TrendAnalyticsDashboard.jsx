import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Flame,
  Heart,
  LayoutDashboard,
  MessageCircle,
  Repeat2,
  Share2,
  Sparkles,
  Users,
} from 'lucide-react';

function formatMonthKey(key) {
  if (!key || typeof key !== 'string') return '';
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  try {
    return new Date(y, m - 1, 1).toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return key;
  }
}

function BackChip({ label, onBack }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 rounded-full border border-[#E9D5FF] bg-white px-4 py-2 text-sm font-semibold text-[#5B21B6] shadow-sm transition hover:border-[#C4B5FD] hover:bg-[#FAF5FF]"
    >
      <ArrowLeft size={18} className="opacity-90" aria-hidden /> {label}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 pb-2">
      <div className="h-48 rounded-3xl bg-gradient-to-br from-[#F5F3FF] via-white to-[#EDE9FE] animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 rounded-3xl bg-[#FAF5FF] animate-pulse" />
        <div className="h-72 rounded-3xl bg-[#FAF5FF] animate-pulse" />
      </div>
    </div>
  );
}

function TopicRow({ rank, topic, engagement, onNavigateTag }) {
  return (
    <button
      type="button"
      onClick={() => onNavigateTag(topic)}
      className="flex w-full items-center gap-3 rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-[#C4B5FD] hover:shadow-[0_4px_20px_-8px_rgba(91,33,182,0.35)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE9FE] text-xs font-bold text-[#5B21B6] ring-1 ring-[#DDD6FE]">
        {rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold text-[#111827]">#{topic}</span>
      <span className="shrink-0 rounded-full bg-[#F5F3FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#5B21B6] ring-1 ring-[#EDE9FE] tabular-nums">
        {Number(engagement).toLocaleString()} eng.
      </span>
    </button>
  );
}

function PostBriefRow({ post }) {
  const a = post.author;
  return (
    <div className="rounded-xl border border-[#F3F4F6] bg-white p-3.5 text-sm shadow-sm ring-1 ring-transparent transition hover:border-[#E9D5FF] hover:ring-[#F5F3FF]">
      <p className="line-clamp-2 text-[#374151] leading-snug">{post.contentSnippet || '—'}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
        <span className="flex items-center gap-0.5">
          <Heart size={12} className="text-rose-500" /> {post.likes ?? 0}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle size={12} className="text-sky-600" /> {post.comments ?? 0}
        </span>
        <span className="flex items-center gap-0.5">
          <Share2 size={12} /> {post.shares ?? 0}
        </span>
        <span className="flex items-center gap-0.5">
          <Repeat2 size={12} /> {post.reposts ?? 0}
        </span>
        <span className="ml-auto rounded-md bg-[#F5F3FF] px-1.5 py-0.5 font-semibold text-[#7C3AED] tabular-nums">
          Σ {post.total?.toLocaleString?.() ?? post.total}
        </span>
      </div>
      {a?.username && (
        <p className="mt-1.5 truncate text-[11px] text-[#9CA3AF]">
          {a.name || a.username} · @{a.username}
        </p>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-[#EDE9FE] bg-white shadow-sm ring-1 ring-black/[0.03] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-[#F5F3FF] bg-gradient-to-r from-[#FAF5FF] via-white to-[#FBFAFF] px-4 py-3.5">
        {Icon ? (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDE9FE] ring-1 ring-[#DDD6FE]">
            <Icon className="h-4 w-4 text-[#6D28D9]" strokeWidth={2} />
          </span>
        ) : null}
        <h2 className="flex-1 text-sm font-semibold tracking-tight text-[#111827]">{title}</h2>
      </div>
      <div className="bg-[#FAFBFF]/80 px-4 py-4">{children}</div>
    </section>
  );
}

export default function TrendAnalyticsDashboard({
  loading,
  error,
  payload,
  schoolName,
  departmentLabel,
  onBack,
}) {
  const navigate = useNavigate();

  const goTag = (topic) => {
    const t = String(topic || '').replace(/^#/, '');
    if (t) navigate(`/hashtag/${encodeURIComponent(t)}`);
  };

  const goUser = (username) => {
    const u = String(username || '').replace(/^@/, '');
    if (u) navigate(`/user/${encodeURIComponent(u)}`);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <BackChip label="Back to departments" onBack={onBack} />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        <BackChip label="Back to departments" onBack={onBack} />
        <div className="rounded-3xl border border-red-100 bg-red-50/95 px-5 py-4 text-sm leading-relaxed text-red-900 shadow-sm">
          <p className="font-semibold">Could not load analytics</p>
          <p className="mt-2 text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  if (!payload) return null;

  const scope = payload.scope || {};
  const note = payload.engagementNote || payload.engagementFormula || '';
  const months = payload.engagementByMonth || [];
  const maxMonthEng = Math.max(1, ...months.map((m) => m.engagement || 0));

  const statBadge = (
    <>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#F5F3FF] px-3 py-1.5 text-xs font-semibold text-[#5B21B6] ring-1 ring-[#EDE9FE]">
        {(scope.userCount ?? 0).toLocaleString()} users
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#4338CA] ring-1 ring-white/70 backdrop-blur-sm">
        {(scope.postCount ?? 0).toLocaleString()} posts
      </span>
      {scope.postCount >= 5000 ? (
        <span className="inline-flex shrink-0 rounded-xl bg-amber-500/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-white/30">
          Cap 5000
        </span>
      ) : null}
    </>
  );

  return (
    <div className="space-y-6 pb-6">
      <BackChip label="Back to departments" onBack={onBack} />

      <header className="relative isolate overflow-hidden rounded-3xl border border-[#E9D5FF]/90 shadow-[0_20px_50px_-28px_rgba(91,33,182,0.5)] ring-1 ring-black/[0.04]">
        <div className="relative bg-gradient-to-br from-[#5B21B6] via-[#7C3AED] to-[#A855F7] px-6 py-10 text-white md:px-8">
          <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#F472B6]/25 blur-[80px]" aria-hidden />
          <div className="pointer-events-none absolute -bottom-32 -left-16 h-56 w-56 rounded-full bg-indigo-300/35 blur-[60px]" aria-hidden />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <div className="flex h-[3.9rem] w-[3.9rem] shrink-0 items-center justify-center rounded-2xl bg-white/18 ring-2 ring-white/30 backdrop-blur-sm">
                <LayoutDashboard className="h-[1.6rem] w-[1.6rem] text-white opacity-95" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 pt-0.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">{schoolName}</p>
                <h1 className="mt-1.5 text-balance text-2xl font-bold leading-tight tracking-tight md:text-3xl">{departmentLabel}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">{statBadge}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#EDE9FE] bg-gradient-to-br from-[#FAFBFF] to-[#F3F4F8] px-6 py-4 md:px-8 md:py-5">
          {note && (
            <p className="text-xs leading-relaxed text-[#6B7280]">
              <span className="font-semibold text-[#5B21B6]">Engagement formula: </span>
              <span>{note}</span>
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section icon={Flame} title="Top trending topics (by hashtag engagement on posts)">
          {(payload.topTrendingTopics || []).length ? (
            <ul className="space-y-2">
              {payload.topTrendingTopics.map((row, i) => (
                <li key={row.topic || row.hashtag}>
                  <TopicRow
                    rank={i + 1}
                    topic={row.topic || row.hashtag}
                    engagement={row.engagement}
                    onNavigateTag={goTag}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">No hashtag activity in this cohort yet.</p>
          )}
        </Section>

        <Section icon={Users} title="Most active students">
          {(payload.mostActiveStudents || []).length ? (
            <ul className="space-y-2">
              {payload.mostActiveStudents.map((u, i) => (
                <li key={u.userId}>
                  <button
                    type="button"
                    onClick={() => goUser(u.username)}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#F3F4F6] bg-white px-3 py-2.5 text-left text-sm shadow-sm transition hover:border-[#C4B5FD] hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EDE9FE] text-xs font-bold text-[#5B21B6] ring-1 ring-[#DDD6FE]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[#111827]">{u.name || u.username}</p>
                      <p className="truncate text-xs text-[#6B7280]">@{u.username}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-[#F5F3FF] px-2 py-1 text-[11px] font-bold text-[#5B21B6] ring-1 ring-[#EDE9FE] tabular-nums">
                      {u.postCount}&nbsp;posts
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#6B7280]">No qualifying posts yet.</p>
          )}
        </Section>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Section icon={Heart} title="Most liked">
          <div className="space-y-2">
            {(payload.mostLikedPosts || []).map((p) => (
              <PostBriefRow key={p.id} post={p} />
            ))}
            {!(payload.mostLikedPosts || []).length && (
              <p className="text-sm text-[#6B7280]">No posts yet.</p>
            )}
          </div>
        </Section>
        <Section icon={MessageCircle} title="Most commented">
          <div className="space-y-2">
            {(payload.mostCommentedPosts || []).map((p) => (
              <PostBriefRow key={p.id} post={p} />
            ))}
            {!(payload.mostCommentedPosts || []).length && (
              <p className="text-sm text-[#6B7280]">No posts yet.</p>
            )}
          </div>
        </Section>
        <Section icon={Share2} title="Most shared">
          <div className="space-y-2">
            {(payload.mostSharedPosts || []).map((p) => (
              <PostBriefRow key={p.id} post={p} />
            ))}
            {!(payload.mostSharedPosts || []).length && (
              <p className="text-sm text-[#6B7280]">No posts yet.</p>
            )}
          </div>
        </Section>
        <Section icon={Sparkles} title="Viral posts (Σ engagement)">
          <div className="space-y-2">
            {(payload.viralPosts || []).map((p) => (
              <PostBriefRow key={p.id} post={p} />
            ))}
            {!(payload.viralPosts || []).length && (
              <p className="text-sm text-[#6B7280]">No posts yet.</p>
            )}
          </div>
        </Section>
      </div>

      <Section icon={BarChart3} title="Engagement over time (by post month)">
        {months.length ? (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-[#6B7280]">
              Total engagement Σ (likes + comments + shares + reposts) summed by calendar month.
            </p>
            <ul className="space-y-4">
              {months.map((row) => {
                const pct = Math.round(((row.engagement || 0) / maxMonthEng) * 100);
                return (
                  <li key={row.month} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <span className="w-28 shrink-0 text-xs font-semibold text-[#374151] sm:pt-0.5">{formatMonthKey(row.month)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex h-3.5 overflow-hidden rounded-full bg-[#E5E7EB] ring-1 ring-[#F3F4F6]">
                        <div
                          className="rounded-full bg-gradient-to-r from-[#7C3AED] to-[#E879F9] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-[width] duration-500"
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-3 tabular-nums text-xs font-semibold sm:w-44">
                      <span className="text-[#5B21B6]">{Number(row.engagement || 0).toLocaleString()}</span>
                      <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#6B7280]">
                        {row.posts} pts
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[#6B7280]">No dated posts to chart.</p>
        )}
      </Section>
    </div>
  );
}
