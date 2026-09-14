import { Link } from 'react-router-dom';
import { Heart, MessageCircle } from 'lucide-react';
import { formatPostContent } from '../utils/formatPostContent';
import { formatDepartmentLabel } from '../utils/departmentLabel';
import { formatTimeAgo } from '../utils/postMappers';

function authorUsername(author) {
  if (!author?.username) return 'user';
  return String(author.username).replace(/^@+/, '');
}

export default function SharedPostPreview({ post, onOpenPost }) {
  if (!post) return null;

  const postId = String(post.id || post._id || '');
  const author = post.author || {};
  const username = authorUsername(author);
  const profilePath = username ? `/user/${username}` : '/home';
  const timeLabel = formatTimeAgo(post.createdAt || post.created_at);
  const likes = post.likesCount ?? post.likes ?? 0;
  const comments = post.commentsCount ?? post.comments ?? 0;
  const dept = author.department || author.program;

  const handleOpen = (e) => {
    if (!postId || !onOpenPost) return;
    e.preventDefault();
    onOpenPost(postId);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen(e);
        }
      }}
      className="w-full max-w-[320px] cursor-pointer rounded-2xl border border-[#D8D8D8] bg-white text-left shadow-sm overflow-hidden transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7C3AED]/40"
    >
      <div
        className="flex items-center gap-2.5 px-3 pt-3 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Link to={profilePath} className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {author.profilePhoto ? (
            <img src={author.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#8B5CF6] text-sm font-bold text-white">
              {(author.name || 'U')[0].toUpperCase()}
            </div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={profilePath}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-semibold text-[#111827] hover:underline"
          >
            {author.name || 'User'}
          </Link>
          <p className="truncate text-xs text-[#6B7280]">@{username}</p>
          {dept && (
            <p className="truncate text-[10px] font-medium text-[#6D28D9]/80">
              {formatDepartmentLabel(dept)}
            </p>
          )}
        </div>
        {timeLabel && <span className="shrink-0 text-[10px] text-[#9CA3AF]">{timeLabel}</span>}
      </div>

      {post.content && (
        <div className="px-3 pb-2 text-sm leading-relaxed text-[#111827]">
          <p className="whitespace-pre-wrap break-words line-clamp-6">{formatPostContent(post.content)}</p>
        </div>
      )}

      {post.image && (
        <div className="border-t border-[#E5E7EB] bg-[#F9FAFB]">
          {post.image.startsWith('data:video/') ||
          (typeof post.image === 'string' && post.image.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
            <video
              src={post.image}
              className="w-full max-h-72 object-cover"
              controls
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img src={post.image} alt="" className="w-full max-h-72 object-cover" />
          )}
        </div>
      )}

      {(likes > 0 || comments > 0) && (
        <div className="flex items-center gap-4 border-t border-[#E5E7EB] px-3 py-2 text-xs text-[#6B7280]">
          {likes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Heart size={14} className="text-[#EF4444]" />
              {likes}
            </span>
          )}
          {comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={14} />
              {comments}
            </span>
          )}
        </div>
      )}

      <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-center text-[11px] font-medium text-[#7C3AED]">
        View post
      </div>
    </div>
  );
}
