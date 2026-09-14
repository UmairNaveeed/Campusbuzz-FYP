import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { updatePostVisibility as updatePostVisibilityApi, searchUsersForMention } from '../services/api';
import CommentModal from './CommentModal';
import { useAuth } from '../context/AuthContext';
import { formatPostContent } from '../utils/formatPostContent';

const TweetCard = ({ postId, avatar, name, handle, time, text, image, stats, hashtags, mentions, postAuthor, onUpdate, isShared, sharedByUsername, sharedByName, visibility: visibilityProp = 'public' }) => {
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const [isLiked, setIsLiked] = useState(stats?.liked || false);
  const [likesCount, setLikesCount] = useState(stats?.likes || stats?.likesCount || 0);
  const [commentsCount, setCommentsCount] = useState(stats?.comments || stats?.commentsCount || 0);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState(visibilityProp);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const menuRef = useRef(null);
  const cardRef = useRef(null);
  const displayTime = time || 'Just now';

  // Listen for notification deep link: open this post and optionally open comments (Instagram-style)
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      const targetPostId = detail?.postId ?? detail;
      const id = Number(targetPostId);
      const myId = Number(postId);
      if (Number.isNaN(id) || myId !== id) return;
      
      // First, scroll to the post so user sees which post got the notification
      if (cardRef.current) {
        cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      
      // Then, if it's a comment/reply notification, open the comment modal after a delay
      // This gives the user time to see the post first (Instagram-style)
      if (detail?.openComments) {
        setTimeout(() => {
          setShowCommentModal(true);
        }, 800); // 800ms delay - enough time to see the post before comments open
      }
    };
    window.addEventListener('openPostById', handler);
    return () => window.removeEventListener('openPostById', handler);
  }, [postId]);

  // Extract username from handle (format: @username)
  const username = handle ? handle.replace('@', '') : null;

  // Check if current user is the post author
  useEffect(() => {
    if (!firebaseUser) {
      setIsAuthor(false);
      return;
    }

    // Check if postAuthor's firebaseId matches current user's firebaseId
    const authorFirebaseId = postAuthor?.firebaseId;
    const currentUserFirebaseId = firebaseUser.uid;
    
    setIsAuthor(authorFirebaseId === currentUserFirebaseId);
  }, [firebaseUser, postAuthor]);

  useEffect(() => {
    setVisibility(visibilityProp);
  }, [visibilityProp]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleSetVisibility = async (newVisibility) => {
    setShowMenu(false);
    setVisibilityLoading(true);
    try {
      await updatePostVisibilityApi(postId, newVisibility);
      setVisibility(newVisibility);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Update visibility failed:', err);
      alert(err.response?.data?.error || 'Failed to update visibility');
    } finally {
      setVisibilityLoading(false);
    }
  };

  const formatText = (text) =>
    formatPostContent(text, {
      mentionClassName: 'text-brand-primary font-medium cursor-pointer hover:underline',
      hashtagClassName: 'text-brand-primary font-medium cursor-pointer hover:underline',
    });

  const visibleHashtags = filterHashtagsNotInText(text, hashtags);

  const handleUsernameClick = (e) => {
    e.stopPropagation();
    if (username) {
      navigate(`/user/${username}`);
    }
  };
  
  const handleNameClick = (e) => {
    e.stopPropagation();
    if (username) {
      navigate(`/user/${username}`);
    }
  };

  // Handle like/unlike
  const handleLike = async (e) => {
    e.stopPropagation();
    if (!postId || loading) return;

    try {
      setLoading(true);
      const response = await api.put(`/api/posts/${postId}/like`);
      
      console.log('Like response:', response.data);
      
      if (response.data.success !== false) {
        setIsLiked(response.data.isLiked);
        const newLikesCount = response.data.likesCount || 0;
        setLikesCount(newLikesCount);
        console.log('Updated likes count to:', newLikesCount);
      }
      
      // Notify parent component to update
      if (onUpdate) {
        onUpdate();
      }
    } catch (err) {
      console.error('Like failed:', err);
      console.error('Error response:', err.response?.data);
      alert(err.response?.data?.error || 'Failed to like post');
    } finally {
      setLoading(false);
    }
  };

  // Handle comment click
  const handleCommentClick = (e) => {
    e.stopPropagation();
    setShowCommentModal(true);
  };

  // Handle report
  const handleReport = async (reason, description) => {
    if (!postId) return;

    try {
      await api.post(`/api/posts/${postId}/report`, { reason, description });
      alert('Post reported successfully');
      setShowReportModal(false);
    } catch (err) {
      console.error('Report failed:', err);
      alert(err.response?.data?.error || 'Failed to report post');
    }
  };

  // Handle delete post
  const handleDelete = async () => {
    if (!postId) return;

    try {
      setLoading(true);
      await api.delete(`/api/posts/${postId}`);
      alert('Post deleted successfully');
      setShowDeleteConfirm(false);
      // Notify parent to refresh
      if (onUpdate) {
        onUpdate();
      }
      // Dispatch event to refresh posts
      window.dispatchEvent(new Event('postsUpdated'));
    } catch (err) {
      console.error('Delete failed:', err);
      alert(err.response?.data?.error || 'Failed to delete post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        ref={cardRef}
        className="bg-white border border-[#dfe2eb] rounded-2xl px-4 py-4 w-full"
      >
        {/* Shared by header - Twitter style */}
        {isShared && sharedByUsername && (
          <div className="flex items-center gap-2 mb-2 ml-10">
            <svg className="w-4 h-4 text-text-secondary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.885 12.938 9 12.482 9 12c0-.482-.115-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-xs text-[#7f859a]">
              <span 
                className="text-text-primary font-semibold cursor-pointer hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/user/${sharedByUsername}`);
                }}
              >
                @{sharedByUsername}
              </span>
              {' '}shared this
            </span>
          </div>
        )}
        
        <div className="flex min-h-[110px]">
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 mr-3 cursor-pointer"
              onClick={handleUsernameClick}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#8b5cf6] text-white text-sm font-semibold flex items-center justify-center flex-shrink-0 mr-3 cursor-pointer"
              onClick={handleUsernameClick}
            >
              {(name || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 flex flex-col gap-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
            <div className="flex items-end gap-1 min-w-0 flex-1">
              <span 
                onClick={handleNameClick}
                className="text-[20px] font-bold text-[#2f3348] whitespace-nowrap truncate cursor-pointer hover:underline"
              >
                {name}
              </span>
              <span 
                onClick={handleUsernameClick}
                className="text-[14px] font-normal text-[#7f859a] whitespace-nowrap truncate cursor-pointer hover:underline"
              >
                {handle} · {displayTime}
              </span>
            </div>
            {/* Three dots menu - Edit/Delete/Report options */}
            <div className="relative" ref={menuRef}>
              <button 
                className="flex-shrink-0 ml-2 hover:bg-[#f1f4ff] rounded-full p-1.5 transition-colors active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <svg className="w-3 h-1 sm:w-4 sm:h-1 md:w-[17px] text-text-primary" viewBox="0 0 17 4" fill="none">
                  <circle cx="2" cy="2" r="2" fill="currentColor"/>
                  <circle cx="8.5" cy="2" r="2" fill="currentColor"/>
                  <circle cx="15" cy="2" r="2" fill="currentColor"/>
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[160px]">
                  {isAuthor ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          setShowEditModal(true);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      {visibility === 'private' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetVisibility('public'); }}
                          disabled={visibilityLoading}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                          {visibilityLoading ? 'Updating...' : 'Make public'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetVisibility('private'); }}
                          disabled={visibilityLoading}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2 disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          {visibilityLoading ? 'Updating...' : 'Make private'}
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-red-600 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setShowReportModal(true);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Report
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {text && (
            <p className="text-[30px] font-normal text-[#3a3f54] leading-[1.35] break-words">
              {formatText(text)}
            </p>
          )}

          {image && (
            <div className="rounded-xl sm:rounded-2xl md:rounded-[20px] overflow-hidden w-full max-w-full md:max-w-[679px] h-auto">
              <img
                src={image}
                alt="Post"
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          {/* Hashtags */}
          {visibleHashtags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {visibleHashtags.map((tag, index) => (
                <span
                  key={index}
                  className="bg-[#eef0ff] text-[#6b5afc] rounded-full px-2 py-0.5 text-[14px] font-medium cursor-pointer hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/hashtag/${tag}`);
                  }}
                  title={`View posts with #${tag}`}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between text-[#747b90] pt-1">
            {/* Comment Button */}
            <button 
              onClick={handleCommentClick}
              className="flex items-center gap-2 cursor-pointer text-[20px] font-normal hover:text-[#6b5afc] transition-colors rounded-full px-2 py-1 hover:bg-[#f1f4ff] active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
              <span>{commentsCount}</span>
            </button>

            {/* Like Button */}
            <button
              onClick={handleLike}
              disabled={loading}
              className={`flex items-center gap-2 cursor-pointer text-[20px] transition-all rounded-full px-2 py-1 ${
                isLiked
                  ? 'text-action-like font-semibold bg-[#fde8ef]'
                  : 'font-normal hover:text-action-like hover:bg-[#fde8ef]'
              } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill={isLiked ? '#EF1C5C' : 'none'}>
                <path
                  d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.5783 8.50903 2.9987 7.05 2.9987C5.59096 2.9987 4.19169 3.5783 3.16 4.61C2.1283 5.6417 1.54871 7.04097 1.54871 8.5C1.54871 9.95903 2.1283 11.3583 3.16 12.39L4.22 13.45L12 21.23L19.78 13.45L20.84 12.39C21.351 11.8792 21.7564 11.2728 22.0329 10.6054C22.3095 9.93789 22.4518 9.22248 22.4518 8.5C22.4518 7.77752 22.3095 7.0621 22.0329 6.39464C21.7564 5.72718 21.351 5.12075 20.84 4.61Z"
                  stroke={isLiked ? '#EF1C5C' : 'currentColor'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className={isLiked ? 'text-action-like' : ''}>
                {likesCount}
              </span>
            </button>

            {/* Share Button - Instagram-style paper plane */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowShareModal(true);
              }}
              className="flex items-center gap-2 cursor-pointer text-[20px] font-normal hover:text-[#6b5afc] transition-colors rounded-full px-2 py-1 hover:bg-[#f1f4ff] active:scale-95"
              title="Share this post"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          postId={postId}
          postContent={text}
          postAuthor={postAuthor || { name, username }}
          onClose={() => setShowShareModal(false)}
          onShareSuccess={() => {
            if (onUpdate) {
              onUpdate();
            }
          }}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          onReport={handleReport}
        />
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <CommentModal
          postId={postId}
          postAuthor={postAuthor || { name, username: username }}
          postContent={text}
          onClose={() => setShowCommentModal(false)}
          onCommentAdded={() => {
            // Refresh comments count
            if (onUpdate) {
              onUpdate();
            }
            // Update local count
            setCommentsCount(prev => prev + 1);
          }}
        />
      )}

      {/* Edit Post Modal */}
      {showEditModal && (
        <EditPostModal
          postId={postId}
          currentContent={text}
          currentImage={image}
          onClose={() => setShowEditModal(false)}
          onUpdate={() => {
            setShowEditModal(false);
            if (onUpdate) {
              onUpdate();
            }
            window.dispatchEvent(new Event('postsUpdated'));
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Delete Post?</h2>
              <p className="text-gray-600 mb-6">
                This can't be undone and it will be removed from your profile, the timeline of any accounts that follow you, and from search results.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Share Modal Component
const ShareModal = ({ postId, postContent, postAuthor, onClose, onShareSuccess }) => {
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    if (!username.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const res = await searchUsersForMention(username.trim());
        setSuggestions((res.users || []).slice(0, 6));
        setShowSuggestions(true);
      } catch (err) {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [username]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim().replace(/^@/, ''); // Remove @ if present
    
    if (!cleanUsername) {
      setError('Please enter a username');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('📤 Sharing post:', { postId, sharedWithUsername: cleanUsername, message });
      
      const response = await api.post(`/api/posts/${postId}/share`, {
        sharedWithUsername: cleanUsername, // Send without @
        message: message.trim() || undefined,
      });

      if (response.data.success) {
        console.log('✅ Share successful:', response.data);
        setUsername('');
        setMessage('');
        onClose();
        if (onShareSuccess) {
          onShareSuccess();
        }
        // Show success message
        alert(`Post shared with @${cleanUsername} successfully!`);
      }
    } catch (err) {
      console.error('❌ Share failed:', err);
      console.error('❌ Error response:', err.response?.data);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to share post';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Share Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Post Preview */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-gray-900">{postAuthor?.name || 'User'}</span>
                <span className="text-gray-500 text-sm">
                  {postAuthor?.username ? `@${postAuthor.username.replace(/^@+/, '')}` : ''}
                </span>
              </div>
              <p className="text-gray-800 text-sm leading-relaxed line-clamp-3">{postContent}</p>
            </div>
          </div>
        </div>

        {/* Share Form */}
        <form onSubmit={handleShare} className="p-6">
          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Share with
            </label>
            <div className="relative" ref={suggestionsRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-500 text-sm">@</span>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.replace(/^@+/, '');
                  setUsername(value);
                  setError('');
                }}
                onFocus={() => username.trim() && setShowSuggestions(true)}
                placeholder="Search by username"
                className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  error 
                    ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                    : 'border-gray-300 focus:ring-brand-primary focus:border-brand-primary'
                }`}
                required
                autoFocus
              />
              {showSuggestions && (username.trim() || suggestions.length > 0) && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-56 overflow-y-auto">
                  {suggestionsLoading ? (
                    <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500">
                      {username.trim() ? 'No users found' : 'Type to search users'}
                    </div>
                  ) : (
                    suggestions.map((u) => (
                      <button
                        key={u._id || u.id || u.username}
                        type="button"
                        onClick={() => {
                          setUsername(u.username || '');
                          setShowSuggestions(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        {u.profilePhoto ? (
                          <img src={u.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate">{u.name || u.username}</div>
                          <div className="text-sm text-gray-500 truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Enter the username of the person you want to share this post with
            </p>
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Add a message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setMessage(e.target.value);
                }
              }}
              className="w-full border border-gray-300 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary transition-all"
              rows="4"
              placeholder="Write a message to go with this share..."
              maxLength={500}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                Let them know why you're sharing this
              </p>
              <p className={`text-xs ${message.length > 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                {message.length} / 500
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="flex-1 px-6 py-3 bg-brand-primary text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sharing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Post
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Report Modal Component
const ReportModal = ({ onClose, onReport }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reason) {
      onReport(reason, description);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">Report Post</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2"
              required
            >
              <option value="">Select a reason</option>
              <option value="hate_speech">Hate Speech</option>
              <option value="inappropriate_content">Inappropriate Content</option>
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-2"
              rows="3"
              placeholder="Provide additional details..."
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-full hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Post Modal Component
const EditPostModal = ({ postId, currentContent, currentImage, onClose, onUpdate }) => {
  const [content, setContent] = useState(currentContent || '');
  const [image, setImage] = useState(currentImage || null);
  const [imagePreview, setImagePreview] = useState(currentImage || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef(null);
  const maxLength = 280;

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setImagePreview(reader.result);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && !image) {
      setError('Post content or image is required');
      return;
    }

    if (content.length > maxLength) {
      setError(`Post must be ${maxLength} characters or less`);
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await api.put(`/api/posts/${postId}`, {
        content: content.trim(),
        image: image || undefined,
      });

      if (response.data.success) {
        onUpdate();
      }
    } catch (err) {
      console.error('Update failed:', err);
      setError(err.response?.data?.error || 'Failed to update post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-gray-900">Edit Post</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <textarea
            value={content}
            onChange={(e) => {
              if (e.target.value.length <= maxLength) {
                setContent(e.target.value);
                setError('');
              }
            }}
            placeholder="What's happening?"
            className="w-full border-none outline-none resize-none text-lg text-gray-900 placeholder-gray-500 min-h-[150px]"
            rows="6"
          />

          {/* Image Preview */}
          {imagePreview && (
            <div className="relative mb-4 rounded-xl overflow-hidden">
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full h-auto max-h-[400px] object-contain"
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Character Count and Image Button */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-4">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-brand-primary hover:bg-blue-50 rounded-full p-2.5 transition-all active:scale-95 hover:scale-105 group"
                title="Add image"
              >
                <svg className="w-6 h-6 transition-transform group-hover:rotate-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm ${content.length > maxLength * 0.9 ? 'text-orange-500' : 'text-gray-500'}`}>
                {content.length} / {maxLength}
              </span>
              <button
                type="submit"
                disabled={loading || (!content.trim() && !image) || content.length > maxLength}
                className="px-6 py-2 bg-brand-primary text-white rounded-full font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Updating...' : 'Update'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TweetCard;
