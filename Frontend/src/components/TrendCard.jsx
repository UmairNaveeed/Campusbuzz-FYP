import { TrendingUp } from 'lucide-react';

export default function TrendCard({ trend, rank, onClick, countLabel = 'posts' }) {
  return (
    <button
      onClick={() => onClick && onClick(trend.hashtag)}
      className="flex w-full items-center gap-4 rounded-2xl border border-[#D8D8D8] bg-white p-4 hover:shadow-md transition-all duration-300 group text-left"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#6D28D9] font-bold text-lg">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm group-hover:text-[#6D28D9] transition-colors">#{trend.hashtag}</span>
          {trend.trending && <TrendingUp size={14} className="text-[#16A34A]" />}
        </div>
        <p className="text-xs text-[#6B7280]">
          {(trend.posts ?? 0).toLocaleString()} {countLabel}
          {trend.department ? ` · ${trend.department}` : ''}
        </p>
      </div>
    </button>
  );
}
