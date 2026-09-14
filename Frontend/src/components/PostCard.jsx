import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Flag,
  ThumbsUp,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Send,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  X,
  Image,
  Search,
  Check,
  Smile,
  Meh,
  Frown,
  Sparkles,
} from 'lucide-react';
import { createComment, getPostComments, likeComment, updatePost, deletePost, repostPost, sharePost as sharePostApi, searchUsersForMention } from '../services/api';
import { useProfile } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { formatDepartmentLabel } from '../utils/departmentLabel';
import { formatPostContent, filterHashtagsNotInText } from '../utils/formatPostContent';
import ReportPostModal from './ReportPostModal';

const MAX_COMMENT_CHARACTERS = 280;

function getSentimentBadgeConfig(sentiment) {
  if (!sentiment) return null;
  const label = (
    typeof sentiment === 'string'
      ? sentiment
      : sentiment.label || sentiment.SentimentLabel || sentiment.sentiment_label || ''
  ).toLowerCase().trim();

  if (!label) return null;

  const rawConfidence = typeof sentiment === 'object'
    ? (sentiment.confidence ?? sentiment.Confidence)
    : null;
  const confidence = rawConfidence != null && !isNaN(rawConfidence)
    ? Math.round(rawConfidence > 1 ? rawConfidence : rawConfidence * 100)
    : null;

  if (label === 'positive') {
    return {
      label: 'Positive',
      emoji: '😊',
      Icon: Smile,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 hover:bg-emerald-100/90 shadow-sm shadow-emerald-500/5',
      title: confidence != null
        ? `Positive sentiment (${confidence}% confidence)`
        : 'Positive sentiment',
      confidence,
    };
  }
  if (label === 'negative') {
    return {
      label: 'Negative',
      emoji: '🙁',
      Icon: Frown,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/90 hover:bg-rose-100/90 shadow-sm shadow-rose-500/5',
      title: confidence != null
        ? `Negative sentiment (${confidence}% confidence)`
        : 'Negative sentiment',
      confidence,
    };
  }
  if (label === 'neutral') {
    return {
      label: 'Neutral',
      emoji: '😐',
      Icon: Meh,
      badgeClass: 'bg-slate-50 text-slate-700 border-slate-200/90 hover:bg-slate-100/90 shadow-sm shadow-slate-500/5',
      title: confidence != null
        ? `Neutral sentiment (${confidence}% confidence)`
        : 'Neutral sentiment',
      confidence,
    };
  }
  return null;
}

function CommentItem({ comment, postId, onReply, onLike, currentUserId }) {
  const [liked, setLiked] = useState(comment.liked || false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState(comment.replies || []);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const handleLike = async () => {
    try {
      const result = await likeComment(comment.id || comment._id);
      if (result.success) {
        setLiked(result.isLiked);
        setLikesCount(result.likesCount || 0);
        if (onLike) onLike();
      }
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  const handleShowReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    if (replies.length > 0) {
      setShowReplies(true);
      return;
    }
    // Load more replies if needed
    setLoadingReplies(true);
    try {
      const result = await getPostComments(postId);
      if (result.success && result.comments) {
        const parentComment = result.comments.find(c => (c.id || c._id) === (comment.id || comment._id));
        if (parentComment && parentComment.replies) {
          setReplies(parentComment.replies);
        }
      }
    } catch (err) {
      console.error('Failed to load replies:', err);
    } finally {
      setLoadingReplies(false);
      setShowReplies(true);
    }
  };

  const handlePostReply = async () => {
    if (!replyText.trim() || replyText.length > MAX_COMMENT_CHARACTERS) return;
    
    setPostingReply(true);
    try {
      const result = await createComment(postId, replyText, comment.id || comment._id);
      if (result.success && result.comment) {
        setReplies([...replies, result.comment]);
        setReplyText('');
        setReplying(false);
        if (onReply) onReply();
      }
    } catch (err) {
      console.error('Failed to post reply:', err);
      alert(err.response?.data?.error || 'Failed to post reply');
    } finally {
      setPostingReply(false);
    }
  };

  const author = comment.author || {};
  const isReply = !!comment.parentCommentId;
  const commentAuthorUser = (author.username || '').replace(/^@+/, '').trim();
  const commentAuthorProfileTo = commentAuthorUser
    ? `/user/${encodeURIComponent(commentAuthorUser)}`
    : null;

  const commentAvatar = commentAuthorProfileTo ? (
    <Link
      to={commentAuthorProfileTo}
      className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1"
      onClick={(e) => e.stopPropagation()}
    >
      {author.profilePhoto || author.avatar ? (
        <img
          src={author.profilePhoto || author.avatar}
          alt=""
          className="h-8 w-8 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-bold text-white cursor-pointer hover:opacity-90 transition-opacity">
          {(author.name?.[0] || 'U').toUpperCase()}
        </div>
      )}
    </Link>
  ) : author.profilePhoto || author.avatar ? (
    <img
      src={author.profilePhoto || author.avatar}
      alt=""
      className="h-8 w-8 rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-bold text-white shrink-0">
      {author.name?.[0] || 'U'}
    </div>
  );

  return (
    <div className={`${isReply ? 'ml-8 mt-2' : 'mt-3'}`}>
      <div className="flex gap-2">
        {commentAvatar}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl bg-[#F3F4F6] p-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-xs">{author.name || 'Unknown'}</span>
              <span className="text-xs text-[#6B7280]">@{(author.username || 'unknown').replace(/^@+/, '')}</span>
            </div>
            <p className="text-sm text-[#111827] whitespace-pre-wrap break-words">
              {formatPostContent(comment.content)}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-1.5 ml-1">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked ? 'text-blue-600' : 'text-[#6B7280] hover:text-blue-600'
              }`}
            >
              <ThumbsUp size={12} fill={liked ? 'currentColor' : 'none'} />
              <span>{likesCount}</span>
            </button>
            {!isReply && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-xs text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Reply
              </button>
            )}
            {!isReply && (comment.repliesCount > 0 || replies.length > 0) && (
              <button
                onClick={handleShowReplies}
                className="text-xs text-[#6B7280] hover:text-[#111827] transition-colors flex items-center gap-1"
              >
                {showReplies ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span>{comment.repliesCount || replies.length} {comment.repliesCount === 1 ? 'reply' : 'replies'}</span>
              </button>
            )}
          </div>
          {replying && !isReply && (
            <div className="mt-2 ml-1">
              <textarea
                value={replyText}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_COMMENT_CHARACTERS) {
                    setReplyText(e.target.value);
                  }
                }}
                placeholder="Write a reply..."
                className="w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-sm placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
                rows="2"
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-xs ${replyText.length > MAX_COMMENT_CHARACTERS ? 'text-red-600' : 'text-[#6B7280]'}`}>
                  {replyText.length}/{MAX_COMMENT_CHARACTERS}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setReplying(false);
                      setReplyText('');
                    }}
                    className="px-3 py-1 text-xs text-[#6B7280] hover:text-[#111827] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePostReply}
                    disabled={!replyText.trim() || replyText.length > MAX_COMMENT_CHARACTERS || postingReply}
                    className="px-3 py-1 text-xs font-medium text-white bg-[#8B5CF6] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {postingReply ? 'Posting...' : 'Reply'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showReplies && replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id || reply._id}
              comment={reply}
              postId={postId}
              onReply={onReply}
              onLike={onLike}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
      {loadingReplies && (
        <div className="ml-10 mt-2 text-xs text-[#6B7280]">Loading replies...</div>
      )}
    </div>
  );
}

export default function PostCard({ post, onLike, onComment, onShare, onReport, onUpdate }) {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { user: firebaseUser } = useAuth();
  const [liked, setLiked] = useState(post.liked || false);
  const [likes, setLikes] = useState(post.likes);
  const [reposted, setReposted] = useState(post.userReposted || false);
  const [repostsCount, setRepostsCount] = useState(post.repostsCount || post.reposts || 0);
  const [reposting, setReposting] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments || 0);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.content || '');
  const [editImage, setEditImage] = useState(post.image || null);
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState('');
  const [targetCommentId, setTargetCommentId] = useState(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const commentRefs = useRef({});
  const commentSectionRef = useRef(null);
  const menuRef = useRef(null);
  const editFileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cardRef = useRef(null);

  // Listen for notification deep link: open this post and optionally open comments
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      const targetPostId = detail?.postId ?? detail;
      if (!targetPostId) return;
      
      // Get all possible post ID formats for comparison
      const postIdVariants = [
        String(post.id || ''),
        String(post._id || ''),
        post.id,
        post._id,
        Number(post.id),
        Number(post._id),
      ].filter(Boolean).map(String);
      
      const targetIdStr = String(targetPostId);
      const targetIdNum = Number(targetPostId);
      
      // Check if any of the post ID variants match (handle both string and number formats)
      const matches = postIdVariants.some(id => {
        return id === targetIdStr || 
               id === String(targetIdNum) || 
               String(id) === String(targetIdStr) ||
               String(id) === String(targetIdNum);
      });
      
      if (!matches) return;
      
      console.log('PostCard: Matched post ID', { postId: post.id || post._id, targetPostId, detail });
      
      // Highlight the post
      setIsHighlighted(true);
      
      // Remove highlight after 5 seconds
      setTimeout(() => {
        setIsHighlighted(false);
      }, 5000);
      
      // First, scroll to the post so user sees which post got the notification
      if (cardRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          setTimeout(() => {
            cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        });
      }
      
      // Store target commentId if provided
      if (detail?.commentId) {
        setTargetCommentId(String(detail.commentId));
      }
      
      // Then, if it's a comment/reply/comment_like notification, open the comment modal after a delay
      if (detail?.openComments) {
        setTimeout(() => {
          setCommentOpen(true);
        }, 1000); // Increased delay to ensure post is visible first
      }
    };
    window.addEventListener('openPostById', handler);
    return () => window.removeEventListener('openPostById', handler);
  }, [post.id, post._id]);

  // Check if current user is the post author
  // Use firebaseId as the primary identifier (most reliable)
  const isOwnPost = (() => {
    if (!firebaseUser || !post.author) {
      return false;
    }
    
    const currentUserId = firebaseUser.uid;
    const authorFirebaseId = post.author.firebaseId;
    
    // Primary check: firebaseId match (most reliable)
    if (authorFirebaseId && currentUserId && authorFirebaseId === currentUserId) {
      return true;
    }
    
    // Fallback: check profile data if available
    if (profile) {
      // Check firebaseId match with profile
      if (profile.firebaseId && authorFirebaseId && profile.firebaseId === authorFirebaseId) {
        return true;
      }
      
      // Check _id match (convert to string for comparison)
      const profileId = profile._id ? String(profile._id) : null;
      const authorId = post.author._id ? String(post.author._id) : null;
      if (profileId && authorId && profileId === authorId) {
        return true;
      }
      
      // Check id match
      const profileId2 = profile.id ? String(profile.id) : null;
      const authorId2 = post.author.id ? String(post.author.id) : null;
      if (profileId2 && authorId2 && profileId2 === authorId2) {
        return true;
      }
      
      // Check username match (case-insensitive, remove @)
      if (profile.username && post.author.username) {
        const profileUsername = (profile.username.replace('@', '') || '').toLowerCase().trim();
        const authorUsername = (post.author.username.replace('@', '') || '').toLowerCase().trim();
        if (profileUsername && authorUsername && profileUsername === authorUsername) {
          return true;
        }
      }
    }
    
    return false;
  })();

  const handleLike = () => {
    setLiked(!liked);
    setLikes((l) => (liked ? l - 1 : l + 1));
    if (onLike) onLike(post.id);
  };

  const handleRepost = async () => {
    if (reposting) return;
    setReposting(true);
    try {
      const result = await repostPost(post.id);
      if (result.success) {
        setReposted(result.reposted);
        setRepostsCount((prev) => result.reposted ? prev + 1 : Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Failed to repost:', err);
      alert(err.response?.data?.error || 'Failed to repost');
    } finally {
      setReposting(false);
    }
  };

  const fetchComments = async () => {
    if (!commentOpen) return;
    setLoadingComments(true);
    try {
      const result = await getPostComments(post.id);
      if (result.success && result.comments) {
        setComments(result.comments);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    if (commentOpen) {
      fetchComments();
    }
  }, [commentOpen, post.id]);

  // Scroll to specific comment when comments are loaded and targetCommentId is set
  useEffect(() => {
    if (targetCommentId && comments.length > 0 && commentOpen) {
      // Wait a bit for comments to render
      setTimeout(() => {
        // First check top-level comments
        let commentRef = commentRefs.current[targetCommentId];
        
        // If not found in top-level, search in replies
        if (!commentRef) {
          // Search through all comments and their replies
          for (const comment of comments) {
            if (comment.replies && Array.isArray(comment.replies)) {
              for (const reply of comment.replies) {
                const replyId = String(reply.id || reply._id);
                if (replyId === targetCommentId) {
                  // Find the reply element - we need to expand replies first
                  // For now, just scroll to the parent comment
                  const parentId = String(comment.id || comment._id);
                  commentRef = commentRefs.current[parentId];
                  break;
                }
              }
            }
          }
        }
        
        if (commentRef) {
          commentRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the comment briefly
          commentRef.classList.add('ring-2', 'ring-[#7C3AED]', 'bg-[#F5F3FF]', 'rounded-lg', 'p-2', 'transition-all');
          setTimeout(() => {
            commentRef.classList.remove('ring-2', 'ring-[#7C3AED]', 'bg-[#F5F3FF]', 'rounded-lg', 'p-2', 'transition-all');
          }, 2000);
        }
        // Clear target after scrolling
        setTargetCommentId(null);
      }, 500);
    }
  }, [targetCommentId, comments, commentOpen]);

  // Auto-play video when it comes into view (Instagram-style)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !post.image) return;

    const isVideo = post.image.startsWith('data:video/') || 
                    post.image.startsWith('video/') || 
                    (typeof post.image === 'string' && post.image.match(/\.(mp4|webm|ogg|mov)$/i));
    
    if (!isVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Video is in view - play it
            video.play().catch((err) => {
              // Autoplay was prevented, user interaction required
              console.log('Autoplay prevented:', err);
            });
          } else {
            // Video is out of view - pause it
            video.pause();
          }
        });
      },
      {
        threshold: 0.5, // Play when 50% of video is visible
        rootMargin: '0px',
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      if (video) {
        video.pause();
      }
    };
  }, [post.image]);

  const handleCommentToggle = () => {
    setCommentOpen(!commentOpen);
    if (!commentOpen && onComment) {
      onComment(post.id);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim() || commentText.length > MAX_COMMENT_CHARACTERS) return;
    
    setPostingComment(true);
    try {
      const result = await createComment(post.id, commentText);
      if (result.success && result.comment) {
        setComments([result.comment, ...comments]);
        setCommentText('');
        setCommentsCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      alert(err.response?.data?.error || 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleCommentUpdate = () => {
    fetchComments();
    setCommentsCount((prev) => prev + 1);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleEdit = () => {
    setEditText(post.content || '');
    setEditImage(post.image || null);
    setEditError('');
    setEditOpen(true);
    setMenuOpen(false);
  };

  const handleEditFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check if it's an image or video
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setEditError('Please select an image or video file.');
      return;
    }
    
    // Check file size
    const maxImageSize = 10 * 1024 * 1024; // 10MB for images
    const maxVideoSize = 25 * 1024 * 1024; // 25MB for videos (base64 will be ~33MB, backend limit is 50MB)
    
    if (file.type.startsWith('video/') && file.size > maxVideoSize) {
      setEditError(`Video file size must be less than ${Math.round(maxVideoSize / (1024 * 1024))}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    
    if (file.type.startsWith('image/') && file.size > maxImageSize) {
      setEditError(`Image file size must be less than ${Math.round(maxImageSize / (1024 * 1024))}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    
    setEditError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setEditImage(reader.result);
        setEditError('');
      } else {
        setEditError('Failed to read file. Please try again.');
      }
    };
    reader.onerror = () => {
      setEditError('Failed to read file. The file may be corrupted or too large.');
    };
    reader.onabort = () => {
      setEditError('File reading was cancelled.');
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      setEditError(`Error reading file: ${err.message}`);
    }
    
    // Reset file input so same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleEditImageButtonClick = () => {
    editFileInputRef.current?.click();
  };

  const handleRemoveEditImage = () => {
    setEditImage(null);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.length > 280) return;
    
    setEditing(true);
    setEditError('');
    try {
      // Pass null if image was removed, or the new image
      const imageToSend = editImage === null ? null : (editImage || post.image);
      const result = await updatePost(post.id, editText, imageToSend);
      if (result.success) {
        setEditOpen(false);
        setEditImage(null);
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Failed to update post:', err);
      setEditError(err.response?.data?.error || 'Failed to update post');
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = () => {
    setDeleteConfirmOpen(true);
    setMenuOpen(false);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const result = await deletePost(post.id);
      if (result.success) {
        if (onUpdate) onUpdate();
      }
    } catch (err) {
      console.error('Failed to delete post:', err);
      alert(err.response?.data?.error || 'Failed to delete post');
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const postAuthorUsername = (post.author?.username || '').replace(/^@+/, '').trim();
  const postAuthorProfileTo = postAuthorUsername
    ? `/user/${encodeURIComponent(postAuthorUsername)}`
    : null;

  const postHeaderAvatar = postAuthorProfileTo ? (
    <Link
      to={postAuthorProfileTo}
      className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2"
      onClick={(e) => e.stopPropagation()}
      aria-label={`View ${post.author?.name || 'user'} profile`}
    >
      {post.author?.avatar || post.author?.profilePhoto ? (
        <img
          src={post.author.avatar || post.author.profilePhoto}
          alt=""
          className="h-10 w-10 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6] text-sm font-bold text-white cursor-pointer hover:opacity-90 transition-opacity">
          {(post.author?.name?.[0] || 'U').toUpperCase()}
        </div>
      )}
    </Link>
  ) : post.author?.avatar || post.author?.profilePhoto ? (
    <img
      src={post.author.avatar || post.author.profilePhoto}
      alt=""
      className="h-10 w-10 rounded-full object-cover shrink-0"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B5CF6] text-sm font-bold text-white shrink-0">
      {post.author?.name?.[0] || 'U'}
    </div>
  );

  return (
    <div 
      ref={cardRef} 
      className={`rounded-2xl border p-4 shadow-sm transition-all duration-500 ${
        isHighlighted 
          ? 'border-[#7C3AED] border-2 bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] shadow-lg shadow-[#7C3AED]/30 ring-2 ring-[#7C3AED]/20 scale-[1.02]' 
          : 'border-[#D8D8D8] bg-white'
      }`}
    >
      {post.isReposted && (post.repostedBy || post.repostedByName || post.repostedByUsername) && (
        <div className="mb-2 flex items-center gap-2 text-xs text-[#6B7280]">
          <Repeat2 size={14} className="text-[#10B981]" />
          <span>
            <span className="font-medium text-[#111827]">
              {post.repostedByName || post.repostedBy?.name || 'Someone'}
            </span>
            {' '}reposted
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        {postHeaderAvatar}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{post.author.name}</span>
            <span className="text-xs text-[#6B7280]">@{post.author.username?.replace(/^@+/, '')}</span>
            <span className="text-xs text-[#6B7280]">· {post.timestamp}</span>
            {(() => {
              const sData = post.sentiment || (post.SentimentLabel ? { label: post.SentimentLabel, confidence: post.Confidence } : null);
              const config = getSentimentBadgeConfig(sData);
              if (!config) return null;
              return (
                <span
                  title={config.title}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all duration-150 select-none ${config.badgeClass}`}
                >
                  <config.Icon size={12} className="shrink-0" />
                  <span>{config.label}</span>
                  {config.confidence != null && config.confidence > 0 && (
                    <span className="text-[10px] opacity-75 font-normal">
                      {config.confidence}%
                    </span>
                  )}
                </span>
              );
            })()}
          </div>
          {post.author.department && (
          <span className="text-xs text-[#6D28D9]/80 font-medium">{formatDepartmentLabel(post.author.department)}</span>
          )}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#6B7280]"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[#D8D8D8] bg-white p-1 shadow-lg z-10">
              {isOwnPost ? (
                <>
                  <button
                    onClick={handleEdit}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#111827] hover:bg-[#F3F4F6] transition-colors"
                  >
                    <Edit size={14} /> Edit Post
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={14} /> Delete Post
                  </button>
                </>
              ) : (
              <button
                onClick={() => {
                  setShowReportModal(true);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <Flag size={14} /> Report Post
              </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-sm leading-relaxed">
        <p className="whitespace-pre-wrap break-words">
          {formatPostContent(post.content)}
        </p>
      </div>

      {post.image && (
        <div className="mt-3 rounded-xl overflow-hidden border border-[#D8D8D8]">
          {post.image.startsWith('data:video/') || 
           post.image.startsWith('video/') || 
           (typeof post.image === 'string' && post.image.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
            <video 
              ref={videoRef}
              src={post.image} 
              className="w-full object-cover max-h-96" 
              controls 
              preload="auto"
              playsInline
              muted
              loop
            >
              Your browser does not support the video tag.
            </video>
          ) : (
          <img src={post.image} alt="" className="w-full object-cover max-h-72" />
          )}
        </div>
      )}

      {filterHashtagsNotInText(post.content, post.hashtags).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filterHashtagsNotInText(post.content, post.hashtags).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => navigate(`/hashtag/${encodeURIComponent(tag)}`)}
              className="rounded-full bg-[#EEF2FF] px-2.5 py-0.5 text-xs font-medium text-[#4F46E5] cursor-pointer hover:bg-[#DDD6FE] transition-colors"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-1 border-t border-[#D8D8D8] pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-all duration-200 ${
            liked ? 'text-blue-600 bg-blue-50' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
          }`}
        >
          <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} />
          <span>{likes}</span>
        </button>

        <button
          onClick={handleCommentToggle}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
            commentOpen ? 'text-[#8B5CF6] bg-[#F5F3FF]' : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
          }`}
        >
          <MessageCircle size={16} />
          <span>{commentsCount}</span>
        </button>

        <button
          onClick={handleRepost}
          disabled={reposting}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
            reposted
              ? 'text-[#10B981] bg-[#D1FAE5] hover:bg-[#A7F3D0]'
              : 'text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]'
          } ${reposting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Repeat2 size={16} />
          <span>{repostsCount}</span>
        </button>

        <button 
          onClick={() => setShareModalOpen(true)}
          className="ml-auto rounded-xl p-1.5 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
          title="Share post"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <ShareModal
          postId={post.id}
          postContent={post.content}
          postAuthor={post.author}
          onClose={() => setShareModalOpen(false)}
          onShareSuccess={() => {
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {commentOpen && (
        <div ref={commentSectionRef} className="mt-4 border-t border-[#D8D8D8] pt-4">
          {/* Comment Input */}
          <div className="mb-4">
            <textarea
              value={commentText}
              onChange={(e) => {
                if (e.target.value.length <= MAX_COMMENT_CHARACTERS) {
                  setCommentText(e.target.value);
                }
              }}
              placeholder="Write a comment..."
              className="w-full rounded-xl border border-[#D8D8D8] bg-white px-3 py-2 text-sm placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
              rows="3"
            />
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${commentText.length > MAX_COMMENT_CHARACTERS ? 'text-red-600' : 'text-[#6B7280]'}`}>
                {commentText.length}/{MAX_COMMENT_CHARACTERS}
              </span>
              <button
                onClick={handlePostComment}
                disabled={!commentText.trim() || commentText.length > MAX_COMMENT_CHARACTERS || postingComment}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-[#8B5CF6] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {postingComment ? (
                  'Posting...'
                ) : (
                  <>
                    <Send size={14} />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Comments List */}
          {loadingComments ? (
            <div className="text-center py-4 text-sm text-[#6B7280]">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-4 text-sm text-[#6B7280]">No comments yet. Be the first to comment!</div>
          ) : (
            <div className="space-y-1">
              {comments.map((comment) => {
                const commentId = String(comment.id || comment._id);
                return (
                  <div
                    key={commentId}
                    ref={(el) => {
                      if (el) commentRefs.current[commentId] = el;
                    }}
                  >
                    <CommentItem
                      comment={comment}
                      postId={post.id}
                      onReply={handleCommentUpdate}
                      onLike={handleCommentUpdate}
                      currentUserId={firebaseUser?.uid}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-[#111827]">Edit Post</h2>
              <button
                onClick={() => {
                  setEditOpen(false);
                  setEditImage(post.image || null);
                  setEditError('');
                }}
                className="p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#6B7280]"
              >
                <X size={20} />
              </button>
            </div>
            <textarea
              value={editText}
              onChange={(e) => {
                if (e.target.value.length <= 280) {
                  setEditText(e.target.value);
                }
              }}
              placeholder="What's happening?"
              className="w-full rounded-xl border border-[#D8D8D8] bg-white px-4 py-3 text-sm placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] resize-none"
              rows="6"
            />
            
            {/* Media Preview */}
            {editImage && (
              <div className="mt-3 relative rounded-xl overflow-hidden border border-[#D8D8D8]">
                {editImage.startsWith('data:video/') || 
                 editImage.startsWith('video/') || 
                 (typeof editImage === 'string' && editImage.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                  <video 
                    src={editImage} 
                    className="w-full object-cover max-h-64" 
                    controls 
                    preload="metadata"
                    playsInline
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <img src={editImage} alt="" className="w-full object-cover max-h-64" />
                )}
                <button
                  onClick={handleRemoveEditImage}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Error Message */}
            {editError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {editError}
              </div>
            )}

            {/* Media Upload Button */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditImageButtonClick}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                <Image size={16} />
                {editImage ? 'Change Media' : 'Add Photo/Video'}
              </button>
              <input
                type="file"
                ref={editFileInputRef}
                onChange={handleEditFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <span className={`text-sm ${editText.length > 280 ? 'text-red-600' : 'text-[#6B7280]'}`}>
                {editText.length}/280
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditOpen(false);
                    setEditImage(post.image || null);
                    setEditError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editText.trim() || editText.length > 280 || editing}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#8B5CF6] rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editing ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <ReportPostModal
          postId={post.id}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            if (onReport) onReport(post.id);
            else alert('Thank you. Your report was submitted and will be reviewed by an administrator.');
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-[#111827] mb-2">Delete Post?</h2>
            <p className="text-sm text-[#6B7280] mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleting(false);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Share Modal Component
function ShareModal({ postId, postContent, postAuthor, onClose, onShareSuccess }) {
  const { profile } = useProfile();
  const [searchQuery, setSearchQuery] = useState('');
  const [following, setFollowing] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingFollowing, setLoadingFollowing] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');

  // Load following list on mount
  useEffect(() => {
    const loadFollowing = async () => {
      // Only load if profile is available
      if (!profile?.username) {
        setLoadingFollowing(false);
        return;
      }
      
      try {
        setLoadingFollowing(true);
        // Use profile from context directly instead of fetching it again
        const followingResponse = await api.get(`/api/profile/${profile.username}/following`);
        setFollowing(followingResponse.data?.following || []);
      } catch (err) {
        console.error('Error loading following:', err);
        setFollowing([]);
      } finally {
        setLoadingFollowing(false);
      }
    };
    loadFollowing();
  }, [profile?.username]);

  // Search users when typing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchUsersForMention(searchQuery.trim());
        // Filter out users already in following list
        const followingUsernames = new Set(following.map(u => u.username?.toLowerCase()));
        const filtered = (res.users || []).filter(u => 
          !followingUsernames.has(u.username?.toLowerCase())
        );
        setSearchResults(filtered.slice(0, 20));
      } catch (err) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, following]);

  const toggleUser = (username) => {
    // Normalize username (remove @ prefix if present)
    const normalizedUsername = username.replace(/^@+/, '').trim();
    if (!normalizedUsername) return;
    
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(normalizedUsername)) {
      newSelected.delete(normalizedUsername);
    } else {
      newSelected.add(normalizedUsername);
    }
    setSelectedUsers(newSelected);
  };

  const handleShare = async () => {
    if (selectedUsers.size === 0) {
      return;
    }

    const selectedCount = selectedUsers.size;
    const selectedUsernames = Array.from(selectedUsers);

    try {
      setLoading(true);
      
      // Share with all selected users
      const sharePromises = selectedUsernames.map(async (username) => {
        const cleanUsername = username.replace(/^@+/, '').trim();
        if (!cleanUsername) {
          throw new Error(`Invalid username: ${username}`);
        }
        try {
          const result = await sharePostApi(postId, cleanUsername, message.trim() || undefined);
          if (result.success) {
            return { success: true, username: cleanUsername, result };
          } else {
            return { success: false, username: cleanUsername, error: result.error || result.message || 'Share failed' };
          }
        } catch (err) {
          console.error(`Failed to share with ${cleanUsername}:`, err);
          console.error('Error response:', err.response?.data);
          const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error';
          return { success: false, username: cleanUsername, error: errorMsg };
        }
      });
      
      const results = await Promise.all(sharePromises);
      
      // Count successful and failed shares
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success);
      
      if (successful > 0) {
        setSelectedUsers(new Set());
        setMessage('');
        onClose();
        if (onShareSuccess) {
          onShareSuccess();
        }
        if (failed.length > 0) {
          const failedMessages = failed.map(f => f.error).filter(Boolean).join('; ');
          alert(`Post shared with ${successful} user(s) successfully. ${failed.length} share(s) failed: ${failedMessages}`);
        } else {
          alert(`Post shared with ${successful} user(s) successfully!`);
        }
      } else {
        // All shares failed
        const errorMessages = failed.map(f => f.error).filter(Boolean);
        const uniqueErrors = [...new Set(errorMessages)];
        alert(`Failed to share post: ${uniqueErrors.join('; ') || 'Please try again.'}`);
      }
    } catch (err) {
      console.error('Share failed:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
      });
      const errorMsg = err.response?.data?.error || err.message || 'Please try again.';
      alert(`Failed to share post: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const UserItem = ({ user, isSelected, onToggle }) => {
    const username = user.username?.replace(/^@+/, '').trim() || '';
    return (
    <button
      type="button"
      onClick={() => onToggle(username)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F9FAFB] transition-colors"
    >
      {user.profilePhoto ? (
        <img src={user.profilePhoto} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">
            {(user.name || user.username || 'U')[0].toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0 text-left">
        <div className="font-semibold text-[#111827] truncate">{user.name || user.username}</div>
        <div className="text-sm text-[#6B7280] truncate">@{user.username}</div>
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        isSelected 
          ? 'bg-[#8B5CF6] border-[#8B5CF6]' 
          : 'border-[#D1D5DB] bg-white'
      }`}>
        {isSelected && <Check size={14} className="text-white" />}
      </div>
    </button>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full h-[600px] flex flex-col overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB] flex-shrink-0">
          <h2 className="text-lg font-semibold text-[#111827]">Share</h2>
          <button
            onClick={onClose}
            className="text-[#6B7280] hover:text-[#111827] transition-colors p-1 hover:bg-[#F3F4F6] rounded-full"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-3 border-b border-[#E5E7EB] flex-shrink-0">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
          <input
            type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full pl-10 pr-4 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] transition-all"
            />
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {loadingFollowing ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8B5CF6]"></div>
            </div>
          ) : searchQuery.trim() ? (
            // Search Results
            <div>
              {searching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#8B5CF6]"></div>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  {searchResults.map((user) => (
                    <UserItem
                      key={user._id || user.id || user.username}
                      user={user}
                      isSelected={selectedUsers.has(user.username?.replace(/^@+/, '').trim())}
                      onToggle={toggleUser}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[#6B7280] text-sm">
                  No users found
                </div>
              )}
            </div>
          ) : (
            // Following List
            <div>
              {following.length > 0 ? (
                following.map((user) => (
                  <UserItem
                    key={user.firebaseId || user.username}
                    user={user}
                    isSelected={selectedUsers.has(user.username?.replace(/^@+/, '').trim())}
                    onToggle={toggleUser}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-[#6B7280] text-sm">
                  You're not following anyone yet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Message Input & Send Button */}
        <div className="border-t border-[#E5E7EB] p-4 flex-shrink-0">
          <textarea
            value={message}
            onChange={(e) => {
              if (e.target.value.length <= 500) {
                setMessage(e.target.value);
              }
            }}
            className="w-full border border-[#D1D5DB] rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] transition-all text-sm mb-3"
            rows="2"
            placeholder="Write a message..."
            maxLength={500}
          />
          <button
            onClick={handleShare}
            disabled={loading || selectedUsers.size === 0}
            className="w-full px-4 py-2.5 bg-[#8B5CF6] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </span>
            ) : (
              `Send${selectedUsers.size > 0 ? ` (${selectedUsers.size})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
