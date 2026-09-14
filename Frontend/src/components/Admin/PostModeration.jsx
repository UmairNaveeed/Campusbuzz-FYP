import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import {
  getAdminReportedPosts,
  getAdminReportedPostDetail,
} from '../../services/api';

const SECTION_KEY = 'flagged_content';

const EMPTY_SECTIONS = {
  [SECTION_KEY]: { label: 'Hate/Inappropriate Content', posts: [] },
};

function formatPostContent(text) {
  if (!text || typeof text !== 'string') return '(No content)';
  const cleaned = text
    .replace(/\bundefined\b/gi, '')
    .replace(/#\s*(?=\s|$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || '(No readable content)';
}

function formatReportedAt(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const PostModeration = () => {
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewPostId, setViewPostId] = useState(null);
  const [viewDetail, setViewDetail] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminReportedPosts(debouncedSearch);
      if (data?.success) {
        setSections(data.sections || EMPTY_SECTIONS);
        setTotal(data.total ?? data.posts?.length ?? 0);
      } else {
        setError(data?.error || 'Failed to load flagged posts');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load flagged posts');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const flaggedPosts = sections[SECTION_KEY]?.posts ?? [];
  const emptySuffix = debouncedSearch ? ` for "${debouncedSearch}"` : '';

  const openView = async (postId) => {
    setViewPostId(postId);
    setViewLoading(true);
    setViewDetail(null);
    try {
      const data = await getAdminReportedPostDetail(postId);
      if (data?.success) setViewDetail(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to load post details');
      setViewPostId(null);
    } finally {
      setViewLoading(false);
    }
  };

  const closeView = () => {
    setViewPostId(null);
    setViewDetail(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 p-8 bg-gray-50 min-w-0">
        <div className="max-w-6xl">
          <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-[#212529] mb-1">Post Moderation</h1>
              <p className="text-gray-600 text-sm">
                Record of hate speech and inappropriate content. Admins can view only — users may delete their own posts.
              </p>
            </div>
            <button
              type="button"
              onClick={loadPosts}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-[#193965] border border-[#193965] rounded-lg hover:bg-blue-50 disabled:opacity-50 shrink-0"
            >
              Refresh
            </button>
          </div>

          {error && (
            <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search post, username, or email…"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm text-[#212529] bg-white focus:outline-none focus:ring-2 focus:ring-[#193965]/30 focus:border-[#193965]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 shrink-0">
              {loading ? 'Loading…' : `${flaggedPosts.length} records · ${total} total`}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
              </div>
            ) : flaggedPosts.length === 0 ? (
              <p className="text-center text-gray-500 py-20 px-6 text-base">
                {total === 0 && !debouncedSearch
                  ? 'No flagged posts on record.'
                  : `No flagged posts${emptySuffix}.`}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[45%]">
                        Post
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[22%]">
                        Author
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[15%]">
                        Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[10%]">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-[8%]">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {flaggedPosts.map((post) => (
                      <tr key={post.id} className="hover:bg-gray-50/90 align-top">
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-2 mb-2">
                            {post.isDeleted && (
                              <span className="inline-block text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                                Deleted by user
                              </span>
                            )}
                            {post.detectionSource === 'ml' && (
                              <span className="inline-block text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                ML Detected
                              </span>
                            )}
                            {post.detectionSource === 'both' && (
                              <span className="inline-block text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                                ML + Report
                              </span>
                            )}
                          </div>
                          <p className="text-[15px] leading-relaxed text-[#212529] whitespace-pre-wrap break-words">
                            {formatPostContent(post.content)}
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
                            {post.reportsCount > 0
                              ? `${post.reportsCount} report${post.reportsCount === 1 ? '' : 's'}`
                              : 'Auto-flagged'}
                            {post.hateConfidence != null ? ` · ${post.hateConfidence}% confidence` : ''}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-semibold text-[#212529]">
                            {post.author?.username && post.author.username !== '—'
                              ? `@${post.author.username}`
                              : '—'}
                          </p>
                          {post.author?.name && (
                            <p className="text-sm text-gray-600 mt-0.5">{post.author.name}</p>
                          )}
                          {post.author?.email && post.author.email !== '—' && (
                            <p className="text-xs text-gray-400 mt-1 break-all">{post.author.email}</p>
                          )}
                        </td>
                        <td className="px-6 py-5 text-sm text-gray-700">
                          {post.category || post.reason}
                        </td>
                        <td className="px-6 py-5 whitespace-nowrap text-sm text-gray-600">
                          {formatReportedAt(post.reportedAt)}
                        </td>
                        <td className="px-6 py-5">
                          <button
                            type="button"
                            onClick={() => openView(post.id)}
                            className="px-3 py-2 text-sm font-medium text-[#193965] border border-[#193965] rounded-lg hover:bg-blue-50"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {viewPostId && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeView}
        >
          <div
            className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center z-10">
              <h3 className="text-lg font-bold text-[#212529]">Post record</h3>
              <button
                type="button"
                onClick={closeView}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
                aria-label="Close"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            {viewLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#193965] border-t-transparent" />
              </div>
            ) : viewDetail?.post ? (
              <div className="p-6 space-y-5">
                {viewDetail.post.isDeleted && (
                  <p className="text-sm font-medium text-gray-600 bg-gray-100 rounded-lg px-3 py-2">
                    This post was deleted by the user.
                  </p>
                )}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Author
                  </h4>
                  <p className="text-base font-medium text-[#212529]">
                    @{viewDetail.post.author?.username || '—'}
                  </p>
                  {viewDetail.post.author?.email && (
                    <p className="text-sm text-gray-600 mt-1">{viewDetail.post.author.email}</p>
                  )}
                </section>
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Post content
                  </h4>
                  <p className="text-base leading-relaxed text-[#212529] whitespace-pre-wrap">
                    {formatPostContent(viewDetail.post.content)}
                  </p>
                </section>
                {viewDetail.post.image && (
                  <img
                    src={viewDetail.post.image}
                    alt=""
                    className="rounded-lg max-h-56 w-full object-cover border border-gray-200"
                  />
                )}
                {viewDetail.post.mlDetected && (
                  <section className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                      ML Detection
                    </h4>
                    <p className="text-sm text-red-800">
                      Auto-flagged as hate speech
                      {viewDetail.post.hateSpeech?.confidence != null
                        ? ` · ${viewDetail.post.hateSpeech.confidence}% confidence`
                        : ''}
                    </p>
                  </section>
                )}
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Student reports ({viewDetail.reports?.length || 0})
                  </h4>
                  {(viewDetail.reports || []).length === 0 ? (
                    <p className="text-sm text-gray-500">No student reports.</p>
                  ) : (
                    <ul className="space-y-3">
                      {(viewDetail.reports || []).map((r) => (
                        <li
                          key={r.id}
                          className="rounded-lg border border-gray-200 p-4 bg-gray-50"
                        >
                          <p
                            className={`text-sm font-semibold ${
                              r.reasonCode === 'hate_speech'
                                ? 'text-red-700'
                                : r.reasonCode === 'inappropriate_content'
                                  ? 'text-amber-800'
                                  : 'text-gray-800'
                            }`}
                          >
                            {r.reason}
                          </p>
                          {r.reportedBy?.username && (
                            <p className="text-sm text-gray-600 mt-1">
                              Reported by @{r.reportedBy.username}
                            </p>
                          )}
                          {r.description && (
                            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                              {r.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostModeration;
