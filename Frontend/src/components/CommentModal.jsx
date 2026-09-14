import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatPostContent } from '../utils/formatPostContent';

const CommentModal = ({ postId, postAuthor, postContent, onClose, onCommentAdded }) => {
  const navigate = useNavigate();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState({});
  const { user } = useAuth();
  const textareaRef = useRef(null);
  const commentsEndRef = useRef(null);
  const maxLength = 2200; // Instagram's character limit

  useEffect(() => {
    if (postId) {
      fetchComments();
    }
  }, [postId]);

  useEffect(() => {
    // Auto-scroll to bottom when new comments are added
    if (comments.length > 0 && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      if (!postId) return;
      
      const response = await api.get(`/api/posts/${postId}/comments`);
      
      if (response.data.success) {
        const commentsData = response.data.comments || [];
        const formattedComments = commentsData.map((comment, idx) => {
          if (!comment._id && comment.id) {
            comment._id = comment.id;
          }
          if (!comment.createdAt && comment.created_at) {
            comment.createdAt = comment.created_at;
          }
          if (comment.author && !comment.author._id && comment.author.id) {
            comment.author._id = comment.author.id;
          }
          if (comment.replies && Array.isArray(comment.replies)) {
            comment.replies = comment.replies.map(reply => {
              if (!reply._id && reply.id) {
                reply._id = reply.id;
              }
              if (!reply.createdAt && reply.created_at) {
                reply.createdAt = reply.created_at;
              }
              if (reply.author && !reply.author._id && reply.author.id) {
                reply.author._id = reply.author.id;
              }
              return reply;
            });
          }
          if (!comment.repliesCount && comment.replies) {
            comment.repliesCount = comment.replies.length;
          }
          return comment;
        });
        setComments(formattedComments);
      } else {
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentContent.trim() || submitting) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/api/posts/${postId}/comments`, {
        content: commentContent.trim(),
      });

      if (response.data.success) {
        setCommentContent('');
        setTimeout(async () => {
          await fetchComments();
        }, 100);
        if (onCommentAdded) {
          onCommentAdded();
        }
      }
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId) => {
    const content = replyContent[parentCommentId]?.trim();
    if (!content || submitting) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/api/posts/${postId}/comments`, {
        content: content,
        parentCommentId: parentCommentId,
      });

      if (response.data.success) {
        setReplyContent(prev => {
          const newContent = { ...prev };
          delete newContent[parentCommentId];
          return newContent;
        });
        setReplyingTo(null);
        setTimeout(async () => {
          await fetchComments();
        }, 100);
        if (onCommentAdded) {
          onCommentAdded();
        }
      }
    } catch (err) {
      console.error('Failed to submit reply:', err);
      alert(err.response?.data?.error || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo`;
    return `${Math.floor(days / 365)}y`;
  };

  const linkClassName = 'text-[#00376b] font-medium cursor-pointer hover:underline';

  const formatText = (text) =>
    formatPostContent(text, {
      mentionClassName: linkClassName,
      hashtagClassName: linkClassName,
      onMentionClick: (username) => {
        onClose();
        navigate(`/user/${encodeURIComponent(username)}`);
      },
      onHashtagClick: (tag) => {
        onClose();
        navigate(`/hashtag/${encodeURIComponent(tag)}`);
      },
    });

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-[500px] h-[90vh] max-h-[800px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Instagram Style */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 bg-white">
          <h2 className="text-base font-semibold text-gray-900">Comments</h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Post Preview - Clean Instagram Style */}
        <div className="px-4 py-4 border-b border-gray-200 flex-shrink-0 bg-white">
          <div className="flex items-start gap-3">
            {postAuthor?.profilePhoto ? (
              <img
                src={postAuthor.profilePhoto}
                alt={postAuthor?.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 cursor-pointer ring-1 ring-gray-200 hover:ring-gray-300 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  navigate(`/user/${postAuthor?.username}`);
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 ring-1 ring-gray-200">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span 
                  className="font-semibold text-sm text-gray-900 cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    navigate(`/user/${postAuthor?.username}`);
                  }}
                >
                  {postAuthor?.name || 'User'}
                </span>
                {postAuthor?.username && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="text-xs text-gray-500">@{postAuthor.username.replace(/^@+/, '')}</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-900 leading-relaxed break-words">
                {formatText(postContent)}
              </p>
            </div>
          </div>
        </div>

        {/* Comments List - Instagram Style */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 text-sm">Loading comments...</div>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">No comments yet</p>
              <p className="text-xs mt-1">Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {comments.map((comment, index) => {
                const commentKey = comment._id || comment.id || `comment-${index}`;
                return (
                  <CommentItem
                    key={commentKey}
                    comment={comment}
                    onReply={() => setReplyingTo(comment._id || comment.id)}
                    onCancelReply={() => {
                      setReplyingTo(null);
                      setReplyContent(prev => {
                        const newContent = { ...prev };
                        delete newContent[comment._id || comment.id];
                        return newContent;
                      });
                    }}
                    showReplyForm={replyingTo === (comment._id || comment.id)}
                    replyContent={replyContent[comment._id || comment.id] || ''}
                    setReplyContent={(content) => {
                      setReplyContent(prev => ({
                        ...prev,
                        [comment._id || comment.id]: content
                      }));
                    }}
                    onSubmitReply={() => handleSubmitReply(comment._id || comment.id)}
                    submitting={submitting}
                    formatText={formatText}
                    formatTimeAgo={formatTimeAgo}
                    navigate={navigate}
                    onClose={onClose}
                  />
                );
              })}
              <div ref={commentsEndRef} />
            </div>
          )}
        </div>

        {/* Comment Input - Instagram Style */}
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <form onSubmit={handleSubmitComment} className="flex items-center gap-2">
            {user?.profilePhoto ? (
              <img
                src={user.profilePhoto}
                alt={user?.name}
                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1 relative">
              <input
                ref={textareaRef}
                type="text"
                value={commentContent}
                onChange={(e) => {
                  if (e.target.value.length <= maxLength) {
                    setCommentContent(e.target.value);
                  }
                }}
                placeholder="Add a comment..."
                className="w-full px-3 py-2 pr-20 bg-transparent border-none outline-none text-sm placeholder-gray-400"
              />
              <button
                type="submit"
                disabled={!commentContent.trim() || submitting}
                className="absolute right-0 top-1/2 -translate-y-1/2 text-[#0095f6] font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-70 transition-opacity"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Comment Item Component - Instagram Style
const CommentItem = ({ 
  comment, 
  onReply,
  onCancelReply,
  showReplyForm, 
  replyContent, 
  setReplyContent, 
  onSubmitReply, 
  submitting,
  formatText,
  formatTimeAgo,
  navigate,
  onClose
}) => {
  const [showReplies, setShowReplies] = useState(true);
  const [liked, setLiked] = useState(false);
  const maxLength = 2200;

  const handleLike = async () => {
    // TODO: Implement like functionality
    setLiked(!liked);
  };

  return (
    <div className="flex gap-3">
      {/* Avatar */}
      {comment.author?.profilePhoto ? (
        <img
          src={comment.author.profilePhoto}
          alt={comment.author?.name}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 cursor-pointer"
          onClick={() => {
            onClose();
            navigate(`/user/${comment.author?.username}`);
          }}
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}

      {/* Comment Content */}
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span 
            className="font-semibold text-sm text-gray-900 cursor-pointer hover:underline mr-2"
            onClick={() => {
              onClose();
              navigate(`/user/${comment.author?.username}`);
            }}
          >
            {comment.author?.name || 'Unknown'}
          </span>
          <span className="text-sm text-gray-900 break-words leading-relaxed">
            {formatText(comment.content)}
          </span>
        </div>

        {/* Comment Actions */}
        <div className="flex items-center gap-4 mb-2">
          <span className="text-xs text-gray-500">{formatTimeAgo(comment.createdAt)}</span>
          <button
            onClick={onReply}
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            Reply
          </button>
          {comment.repliesCount > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
            >
              {showReplies ? 'Hide' : 'View'} {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="ml-4 mt-2 mb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => {
                  if (e.target.value.length <= maxLength) {
                    setReplyContent(e.target.value);
                  }
                }}
                placeholder={`Reply to @${comment.author?.username || 'user'}...`}
                className="flex-1 px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-full outline-none focus:border-gray-300"
                autoFocus
              />
              <button
                onClick={onSubmitReply}
                disabled={!replyContent.trim() || submitting}
                className="px-3 py-1.5 text-sm text-[#0095f6] font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-70"
              >
                {submitting ? 'Posting...' : 'Post'}
              </button>
              <button
                onClick={onCancelReply}
                className="px-2 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Replies */}
        {showReplies && comment.replies && comment.replies.length > 0 && (
          <div className="ml-4 mt-2 space-y-3">
            {comment.replies.map((reply, replyIndex) => (
              <div key={reply._id || reply.id || `reply-${replyIndex}`} className="flex gap-3">
                {reply.author?.profilePhoto ? (
                  <img
                    src={reply.author.profilePhoto}
                    alt={reply.author?.name}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      onClose();
                      navigate(`/user/${reply.author?.username}`);
                    }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="mb-1">
                    <span 
                      className="font-semibold text-xs text-gray-900 cursor-pointer hover:underline mr-1.5"
                      onClick={() => {
                        onClose();
                        navigate(`/user/${reply.author?.username}`);
                      }}
                    >
                      {reply.author?.name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-900 break-words leading-relaxed">
                      {formatText(reply.content)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">{formatTimeAgo(reply.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentModal;
