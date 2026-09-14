import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import PostCard from './PostCard';
import api from '../services/api';
import { mapBackendPostToCard } from '../utils/postMappers';

export default function SharedPostViewerModal({ postId, onClose }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/posts/${postId}`);
      if (res.data?.success && res.data?.post) {
        setPost(mapBackendPostToCard(res.data.post));
      } else {
        setError('Post not found');
        setPost(null);
      }
    } catch {
      setError('Could not load this post');
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!postId) return null;

  const handleLike = async (id) => {
    try {
      const res = await api.put(`/api/posts/${id}/like`);
      if (res.data?.success) {
        setPost((prev) =>
          prev
            ? {
                ...prev,
                liked: res.data.isLiked,
                likes: res.data.likesCount ?? prev.likes,
              }
            : prev
        );
      }
    } catch {
      /* ignore */
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="View post"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close on post panel */}
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 py-3">
          <h2 className="text-base font-semibold text-[#111827]">Post</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
            aria-label="Close"
          >
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-[#6B7280]">
              <Loader2 size={28} className="animate-spin text-[#7C3AED]" />
              <p className="text-sm">Loading post…</p>
            </div>
          )}
          {!loading && error && (
            <div className="px-6 py-16 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={loadPost}
                className="mt-3 text-sm font-medium text-[#7C3AED] hover:underline"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && post && (
            <PostCard post={post} onLike={handleLike} onReport={() => {}} onUpdate={loadPost} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
