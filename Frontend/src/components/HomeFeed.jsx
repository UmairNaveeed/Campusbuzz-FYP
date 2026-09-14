import { useState, useEffect, useCallback, useRef } from 'react';
import PostCard from './PostCard';
import {
  AtSign,
  Bell,
  Hash,
  Home,
  Image,
  List,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  Send,
  Smile,
  UserCircle,
  X,
  Sparkles,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from './ui/sidebar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './ui/navigation-menu';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import api, {
  getPosts,
  createPost as createPostApi,
  searchUsersForMention,
  searchHashtags,
} from '../services/api';
import { mapBackendPostToCard } from '../utils/postMappers';
import { getMentionContext, getHashtagContext } from '../utils/mentionUtils';
import CampusTrendsWidget from './CampusTrendsWidget';
import WhoToFollowWidget from './WhoToFollowWidget';

export default function HomeFeed() {
  const navigate = useNavigate();
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const [postText, setPostText] = useState('');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [likeLoading, setLikeLoading] = useState(null);
  const [error, setError] = useState('');
  const [postSentimentFeedback, setPostSentimentFeedback] = useState(null);
  const [image, setImage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [showHashtagDropdown, setShowHashtagDropdown] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [hashtagStartIndex, setHashtagStartIndex] = useState(0);
  const [hashtagCursorPosition, setHashtagCursorPosition] = useState(0);
  const [hashtagHighlightedIndex, setHashtagHighlightedIndex] = useState(0);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mentionDropdownRef = useRef(null);
  const hashtagDropdownRef = useRef(null);
  const textareaRef = useRef(null);

  const MAX_CHARACTERS = 280;
  const commonEmojis = [
    // Smileys & People
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', 
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', 
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', 
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', 
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', 
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', 
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', 
    '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', 
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', 
    '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', 
    '🤖', '🎃',
    // Gestures & Body Parts
    '👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', 
    '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', 
    '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', 
    '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', 
    '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋',
    // Hearts & Emotions
    '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', 
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
    // Symbols & Objects
    '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', 
    '🗨️', '🗯️', '💭', '💤', '🔥', '✨', '⭐', '🌟', '💫', '⚡', 
    '☄️', '💥', '💢', '💨', '💦', '💤',
    // Celebration & Events
    '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🎯', '🎮', 
    '🎰', '🎲', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🧩',
    // Activities & Sports
    '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', 
    '🥅', '🏒', '🏑', '🏏', '⛳', '🏹', '🎣', '🥊', '🥋', '🎽', 
    '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤼', '🤸', 
    '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', 
    '🧗', '🚵', '🚴',
    // Travel & Transport
    '🚀', '✈️', '🛫', '🛬', '🛩️', '💺', '🚁', '🚟', '🚠', '🚡', 
    '🛰️', '🛸',
    // Food & Drinks
    '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', 
    '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', 
    '🌶️', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', 
    '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', 
    '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', 
    '🍜', '🍲', '🍛', '🍣', '🍱', '🍚', '🍙', '🍘', '🍥', '🥠', 
    '🥟', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🍰', '🎂', '🍮', 
    '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', 
    '🍼', '☕', '🍵', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', 
    '🍸', '🍹', '🧃', '🧉', '🧊',
    // Nature & Weather
    '🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌙', '🌚', 
    '🌛', '🌜', '🌝', '🌞', '⭐', '🌟', '🌠', '☀️', '⛅', '☁️', 
    '⛈️', '🌤️', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️', '🌪️', '🌫️', 
    '🌬️', '🌀', '🌈', '☂️', '☔', '⛱️', '⚡', '❄️', '☃️', '⛄', 
    '☄️', '💧', '🔥', '🌊',
    // Objects & Misc
    '⌛', '⏳', '⌚', '⏰', '⏱️', '⏲️', '🕰️', '🕛', '🕧', '🕐', 
    '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', 
    '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', 
    '🕦', '📚', '📖', '📝', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️', 
    '📏', '📐', '📌', '📍', '📎', '🖇️', '📑', '🔖', 
    '🏷️', '💰', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹'
  ];

  const getRemainingCharacters = () => {
    return MAX_CHARACTERS - (postText || '').length;
  };

  const handlePostTextChange = (newText) => {
    if (newText.length <= MAX_CHARACTERS) {
      setPostText(newText);
      setError('');
    } else {
      setPostText(newText.slice(0, MAX_CHARACTERS));
    }
  };

  const fetchFeed = useCallback(async () => {
    if (!firebaseUser) {
      setPosts([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const feedData = await getPosts();
      const feedRaw = Array.isArray(feedData)
        ? feedData
        : feedData?.posts || feedData?.tweets || [];
      setPosts(feedRaw.map(mapBackendPostToCard));
      
      // Check for pending navigation from notifications
      const pendingNav = sessionStorage.getItem('pendingPostNavigation');
      if (pendingNav) {
        try {
          const navInfo = JSON.parse(pendingNav);
          // Clear it immediately to avoid duplicate navigation
          sessionStorage.removeItem('pendingPostNavigation');
          
          console.log('HomeFeed: Posts loaded, dispatching navigation event', navInfo);
          
          // Wait for posts to render in DOM, then dispatch event
          // Use requestAnimationFrame to ensure DOM is updated
          requestAnimationFrame(() => {
            setTimeout(() => {
              console.log('HomeFeed: Dispatching openPostById event', navInfo);
              window.dispatchEvent(new CustomEvent('openPostById', { 
                detail: navInfo
              }));
            }, 500); // Give enough time for posts to render
          });
        } catch (err) {
          console.error('Failed to parse pending navigation:', err);
          sessionStorage.removeItem('pendingPostNavigation');
        }
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Removed fetchTrends - will implement trending logic later

  useEffect(() => {
    fetchFeed();
    const onUpdate = () => fetchFeed();
    window.addEventListener('postsUpdated', onUpdate);
    return () => window.removeEventListener('postsUpdated', onUpdate);
  }, [fetchFeed]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Check if it's an image or video
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please select an image or video file.');
      return;
    }
    
    // Check file size - more lenient limits
    const maxImageSize = 10 * 1024 * 1024; // 10MB for images
    const maxVideoSize = 25 * 1024 * 1024; // 25MB for videos (base64 will be ~33MB, backend limit is 50MB)
    
    if (file.type.startsWith('video/') && file.size > maxVideoSize) {
      setError(`Video file size must be less than ${Math.round(maxVideoSize / (1024 * 1024))}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    
    if (file.type.startsWith('image/') && file.size > maxImageSize) {
      setError(`Image file size must be less than ${Math.round(maxImageSize / (1024 * 1024))}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }
    
    setError(''); // Clear any previous errors
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        setImage(reader.result);
        setError('');
      } else {
        setError('Failed to read file. Please try again.');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file. The file may be corrupted or too large.');
    };
    reader.onabort = () => {
      setError('File reading was cancelled.');
    };
    try {
      reader.readAsDataURL(file);
    } catch (err) {
      setError(`Error reading file: ${err.message}`);
    }
    
    // Reset file input so same file can be selected again
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleImageButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleEmojiClick = (emoji) => {
    const currentText = postText;
    const newText = currentText + emoji;
    if (newText.length <= MAX_CHARACTERS) {
      handlePostTextChange(newText);
      setShowEmojiPicker(false);
    }
  };

  const syncAutocompleteFromCursor = useCallback((val, start) => {
    setCursorPosition(start);
    const mentionCtx = getMentionContext(val, start);
    const hashtagCtx = getHashtagContext(val, start);
    if (hashtagCtx) {
      setShowHashtagDropdown(true);
      setHashtagQuery(hashtagCtx.query || '');
      setHashtagStartIndex(hashtagCtx.startIndex);
      setHashtagCursorPosition(start);
      setShowMentionDropdown(false);
    } else if (mentionCtx) {
      setShowMentionDropdown(true);
      setMentionQuery(mentionCtx.query);
      setMentionStartIndex(mentionCtx.startIndex);
      setShowHashtagDropdown(false);
    } else {
      setShowMentionDropdown(false);
      setShowHashtagDropdown(false);
    }
  }, []);

  useEffect(() => {
    if (!showMentionDropdown) return;
    const timeoutId = setTimeout(async () => {
      if (!mentionQuery.trim()) {
        setMentionSuggestions([]);
        setMentionLoading(false);
        return;
      }
      setMentionLoading(true);
      try {
        const res = await searchUsersForMention(mentionQuery);
        const users = (res.users || []).slice(0, 8);
        setMentionSuggestions(users);
        setHighlightedIndex(0);
      } catch (err) {
        console.error('Mention search error:', err);
        setMentionSuggestions([]);
      } finally {
        setMentionLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [showMentionDropdown, mentionQuery]);

  useEffect(() => {
    if (!showHashtagDropdown) {
      setHashtagSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      const query = hashtagQuery ? hashtagQuery.trim() : '';
      if (!query) {
        // If no query, don't show suggestions
        setHashtagSuggestions([]);
        setHashtagLoading(false);
        return;
      }
      setHashtagLoading(true);
      try {
        // Search hashtags from all posts that start with the query
        const res = await searchHashtags(query);
        const hashtags = (res.hashtags || []).slice(0, 8);
        setHashtagSuggestions(hashtags.map(h => ({ name: h.name || h.hashtag || h })));
        setHashtagHighlightedIndex(0);
      } catch (err) {
        console.error('Hashtag search error:', err);
        setHashtagSuggestions([]);
      } finally {
        setHashtagLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [showHashtagDropdown, hashtagQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target) && 
          textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowMentionDropdown(false);
      }
      if (hashtagDropdownRef.current && !hashtagDropdownRef.current.contains(e.target) && 
          textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowHashtagDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertMention = (username) => {
    if (!username) return;
    const before = postText.slice(0, mentionStartIndex);
    const after = postText.slice(cursorPosition);
    const newText = (before + `@${username} ` + after);
    if (newText.length <= MAX_CHARACTERS) {
      handlePostTextChange(newText);
      setShowMentionDropdown(false);
      setMentionSuggestions([]);
      setMentionQuery('');
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = mentionStartIndex + username.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    }
  };

  const insertHashtag = (hashtagName) => {
    if (!hashtagName) return;
    // Remove # if user included it
    const cleanHashtag = hashtagName.startsWith('#') ? hashtagName.slice(1) : hashtagName;
    const before = postText.slice(0, hashtagStartIndex);
    const after = postText.slice(hashtagCursorPosition);
    const newText = (before + `#${cleanHashtag} ` + after);
    if (newText.length <= MAX_CHARACTERS) {
      handlePostTextChange(newText);
      setShowHashtagDropdown(false);
      setHashtagSuggestions([]);
      setHashtagQuery('');
      setTimeout(() => {
        if (textareaRef.current) {
          const pos = hashtagStartIndex + cleanHashtag.length + 2;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    }
  };

  const handleMentionButtonClick = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || postText.length;
      const end = textarea.selectionEnd || postText.length;
      
      // Insert "@" at cursor position
      const before = postText.slice(0, start);
      const after = postText.slice(end);
      const newText = before + '@' + after;
      
      if (newText.length <= MAX_CHARACTERS) {
        handlePostTextChange(newText);
        
        // Set cursor position after "@"
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = start + 1;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            setCursorPosition(newPos);
            
            // Trigger mention dropdown
            const ctx = getMentionContext(newText, newPos);
            if (ctx) {
              setShowMentionDropdown(true);
              setMentionQuery(ctx.query);
              setMentionStartIndex(ctx.startIndex);
            }
          }
        }, 0);
      }
    } else {
      // If textarea is not focused, just add "@" at the end
      const newText = postText + '@';
      if (newText.length <= MAX_CHARACTERS) {
        handlePostTextChange(newText);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const newPos = newText.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
            setCursorPosition(newPos);
            setShowMentionDropdown(true);
            setMentionQuery('');
            setMentionStartIndex(newPos - 1);
          }
        }, 0);
      }
    }
  };

  const handleHashtagButtonClick = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || postText.length;
      const end = textarea.selectionEnd || postText.length;
      
      // Insert "#" at cursor position
      const before = postText.slice(0, start);
      const after = postText.slice(end);
      const newText = before + '#' + after;
      
      if (newText.length <= MAX_CHARACTERS) {
        handlePostTextChange(newText);
        
        // Set cursor position after "#"
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = start + 1;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            setHashtagCursorPosition(newPos);
            
            // Trigger hashtag dropdown
            const ctx = getHashtagContext(newText, newPos);
            if (ctx) {
              setShowHashtagDropdown(true);
              setHashtagQuery(ctx.query || '');
              setHashtagStartIndex(ctx.startIndex);
              setHashtagCursorPosition(newPos);
            } else {
              // Even if context is null, show dropdown when just "#" is typed
              setShowHashtagDropdown(true);
              setHashtagQuery('');
              setHashtagStartIndex(newPos - 1);
              setHashtagCursorPosition(newPos);
            }
          }
        }, 0);
      }
    } else {
      // If textarea is not focused, just add "#" at the end
      const newText = postText + '#';
      if (newText.length <= MAX_CHARACTERS) {
        handlePostTextChange(newText);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const newPos = newText.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
            setHashtagCursorPosition(newPos);
            setCursorPosition(newPos);
            setShowHashtagDropdown(true);
            setHashtagQuery('');
            setHashtagStartIndex(newPos - 1);
          }
        }, 0);
      }
    }
  };

  const handleCreatePost = async () => {
    const content = postText.trim();
    if (!content && !image) {
      setError('Please add some content or an image/video.');
      return;
    }
    if (content.length > MAX_CHARACTERS) {
      setError(`Content must be ${MAX_CHARACTERS} characters or less.`);
      return;
    }
    
    // Check if video file is too large when base64 encoded (base64 increases size by ~33%)
    // Backend limit is 50MB, so we allow up to ~40MB base64 to be safe
    if (image && image.startsWith('data:video/')) {
      const base64Size = image.length;
      const estimatedBytes = Math.ceil((base64Size * 3) / 4);
      const maxAllowedBytes = 40 * 1024 * 1024; // 40MB base64 (backend limit is 50MB)
      if (estimatedBytes > maxAllowedBytes) {
        setError(`Video file is too large (${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is ~${Math.round(maxAllowedBytes / (1024 * 1024))}MB.`);
        return;
      }
    }
    
    setError('');
    setPosting(true);
    try {
      const data = await createPostApi(content || '', image);
      const created = data?.post;
      const isFlagged = data?.analysis?.is_hate_speech;
      const sentimentLabel = data?.analysis?.sentiment || created?.SentimentLabel;
      const sentimentConfidence = created?.Confidence ?? data?.analysis?.confidence;
      if (sentimentLabel && !isFlagged) {
        setPostSentimentFeedback({
          label: sentimentLabel,
          confidence: sentimentConfidence,
        });
        setTimeout(() => setPostSentimentFeedback(null), 6000);
      }
      if (created && !isFlagged) {
        const mapped = mapBackendPostToCard({
          ...created,
          isLiked: false,
          userReposted: false,
        });
        setPosts((prev) => {
          const id = String(mapped.id);
          if (prev.some((p) => String(p.id) === id)) return prev;
          return [mapped, ...prev];
        });
      }
      setPostText('');
      setImage(null);
      await fetchFeed();
      window.dispatchEvent(new Event('postsUpdated'));
    } catch (err) {
      console.error('Create post failed:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to post';
      setError(errorMessage);
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (postId) => {
    if (likeLoading === postId) return;
    setLikeLoading(postId);
    try {
      await api.put(`/api/posts/${postId}/like`);
      setPosts((prev) =>
        prev.map((p) => {
          if (String(p.id) !== String(postId)) return p;
          return {
            ...p,
            liked: !p.liked,
            likes: p.liked ? p.likes - 1 : p.likes + 1,
          };
        })
      );
    } catch (err) {
      console.error('Like failed:', err);
    } finally {
      setLikeLoading(null);
    }
  };

  const handleReport = () => {
    alert('Thank you. Your report was submitted and will be reviewed by an administrator.');
  };

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const menuItems = [
    { label: 'Home Feed', icon: Home, to: '/home' },
    { label: 'Create Post', icon: PlusCircle, to: '/create-post' },
    { label: 'Profile', icon: UserCircle, to: '/profile' },
    { label: 'Notifications', icon: Bell, to: '/notifications' },
    { label: 'Messages', icon: Mail, to: '/messages' },
    { label: 'Trends', icon: Hash, to: '/explore' },
    { label: 'Lists', icon: List, to: '/lists' },
    { label: 'Forums', icon: MessageSquare, to: '/discussion' },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarContent className="bg-sidebar px-2 py-3">
          <Link to="/home" className="flex items-center gap-2 px-2 pb-3 text-white text-xl font-bold rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            <CampusBuzzIcon className="h-6 w-6 shrink-0 text-white" fill="white" />
            CampusBuzz
          </Link>
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase text-[11px] tracking-[0.12em] text-white/60">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  if (item.label === 'Create Post') {
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          onClick={openCreatePost}
                          className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.label === 'Home Feed'}
                        className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                      >
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        {(item.label === 'Forums' && forumCount > 0) && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                            {forumCount > 99 ? '99+' : forumCount}
                          </span>
                        )}
                        {(item.label === 'Messages' && messageSidebarCount > 0) && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                            {messageSidebarCount > 99 ? '99+' : messageSidebarCount}
                          </span>
                        )}
                        {(item.label === 'Notifications' && notificationCount > 0) && (
                          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                            {notificationCount > 99 ? '99+' : notificationCount}
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
          <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initial}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <div className="flex items-center gap-1">
              <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="h-9 gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]">
                      {profile?.profilePhoto ? (
                        <img src={profile.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">{initial}</span>
                      )}
                      {displayName}
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="min-w-[180px]">
                      <ul className="grid gap-1 p-2">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Profile</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Settings</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <button type="button" onClick={handleLogout} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            Logout
                          </button>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-5">
          <div className="mx-auto w-full max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {postSentimentFeedback && (
                  <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 text-emerald-800 text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2.5">
                      <Sparkles size={16} className="text-emerald-600 shrink-0" />
                      <span>
                        Post published! Sentiment classified as{' '}
                        <strong className="capitalize font-semibold text-emerald-900">{postSentimentFeedback.label}</strong>
                        {postSentimentFeedback.confidence ? ` (${postSentimentFeedback.confidence}% confidence)` : ''}.
                      </span>
                    </div>
                    <button
                      onClick={() => setPostSentimentFeedback(null)}
                      className="text-emerald-600 hover:text-emerald-900 p-1 rounded-lg transition-colors"
                      aria-label="Dismiss notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-sm font-bold text-white shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        placeholder="What's buzzing on campus?"
                        value={postText}
                        onChange={(e) => {
                          const val = e.target.value;
                          handlePostTextChange(val);
                          syncAutocompleteFromCursor(val, e.target.selectionStart || 0);
                        }}
                        onSelect={(e) => {
                          syncAutocompleteFromCursor(postText, e.target.selectionStart || 0);
                        }}
                        onKeyDown={(e) => {
                          if (showHashtagDropdown && hashtagSuggestions.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHashtagHighlightedIndex((i) => (i + 1) % hashtagSuggestions.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHashtagHighlightedIndex((i) => (i - 1 + hashtagSuggestions.length) % hashtagSuggestions.length);
                            } else if (e.key === 'Enter' && hashtagSuggestions[hashtagHighlightedIndex]) {
                              e.preventDefault();
                              insertHashtag(hashtagSuggestions[hashtagHighlightedIndex].name);
                            } else if (e.key === 'Escape') {
                              setShowHashtagDropdown(false);
                            }
                            return;
                          }
                          if (showMentionDropdown && mentionSuggestions.length > 0) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setHighlightedIndex((i) => (i + 1) % mentionSuggestions.length);
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setHighlightedIndex((i) => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                            } else if (e.key === 'Enter' && mentionSuggestions[highlightedIndex]) {
                              e.preventDefault();
                              insertMention(mentionSuggestions[highlightedIndex].username);
                            } else if (e.key === 'Escape') {
                              setShowMentionDropdown(false);
                            }
                          }
                        }}
                        rows={3}
                        className="w-full resize-none rounded-xl border-0 bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                      />
                      {showMentionDropdown && (
                        <div
                          ref={mentionDropdownRef}
                          className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden"
                        >
                          {mentionLoading ? (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">Searching...</div>
                          ) : !mentionQuery.trim() ? (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">Type a username to search</div>
                          ) : mentionSuggestions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">No users found</div>
                          ) : (
                            mentionSuggestions.map((u, i) => (
                              <button
                                key={u._id || u.id || u.username}
                                type="button"
                                onClick={() => insertMention(u.username)}
                                onMouseEnter={() => setHighlightedIndex(i)}
                                className={`w-full px-4 py-2.5 text-left text-sm ${
                                  i === highlightedIndex ? 'bg-[#F5F3FF]' : 'hover:bg-[#F3F4F6]'
                                }`}
                              >
                                <div className="font-medium text-[#111827]">{u.name || u.username}</div>
                                <div className="text-xs text-[#6B7280]">@{u.username}</div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {showHashtagDropdown && (
                        <div
                          ref={hashtagDropdownRef}
                          className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden"
                        >
                          {hashtagLoading ? (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">Searching...</div>
                          ) : hashtagQuery && hashtagQuery.trim() && hashtagSuggestions.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">No hashtags found</div>
                          ) : hashtagSuggestions.length > 0 ? (
                            hashtagSuggestions.map((h, i) => (
                              <button
                                key={h.name || i}
                                type="button"
                                onClick={() => insertHashtag(h.name)}
                                onMouseEnter={() => setHashtagHighlightedIndex(i)}
                                className={`w-full px-4 py-2.5 text-left text-sm ${
                                  i === hashtagHighlightedIndex ? 'bg-[#F5F3FF]' : 'hover:bg-[#F3F4F6]'
                                }`}
                              >
                                <div className="font-medium text-[#111827]">#{h.name}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-[#6B7280]">Type after # to search hashtags</div>
                          )}
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <span className={`text-sm font-semibold ${
                          getRemainingCharacters() < 0 
                            ? 'text-red-600' 
                            : getRemainingCharacters() <= 20 
                              ? 'text-orange-500' 
                              : 'text-[#6B7280]'
                        }`}>
                          {(postText || '').length}/{MAX_CHARACTERS}
                        </span>
                      </div>
                      {/* Media preview */}
                      {image && (
                        <div className="mt-3 relative rounded-xl overflow-hidden border border-[#E5E7EB] max-w-md">
                          {image.startsWith('data:video/') ? (
                            <video src={image} className="w-full max-h-64 object-cover" controls />
                          ) : (
                            <img src={image} alt="Preview" className="w-full max-h-64 object-cover" />
                          )}
                          <button 
                            onClick={() => setImage(null)} 
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
                      {/* Hidden file input */}
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        accept="image/*,video/*"
                        className="hidden"
                      />
                      <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={handleImageButtonClick} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Add photo or video"><Image size={18} /></button>
                          <div className="relative" ref={emojiPickerRef}>
                            <button 
                              type="button" 
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                              className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" 
                              title="Add emoji"
                            >
                              <Smile size={18} />
                            </button>
                            {showEmojiPicker && (
                              <div className="absolute bottom-full left-0 mb-2 bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-3 z-50 w-80 max-h-96 overflow-y-auto">
                                <div className="grid grid-cols-8 gap-1">
                                  {commonEmojis.map((emoji) => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() => handleEmojiClick(emoji)}
                              className="hover:bg-[#F5F3FF] rounded-lg p-1.5 text-xl transition-colors flex items-center justify-center aspect-square"
                                      title={emoji}
                                    >
                                      <span className="leading-none">{emoji}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={handleHashtagButtonClick} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Add hashtag"><Hash size={18} /></button>
                          <button type="button" onClick={handleMentionButtonClick} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Mention user"><AtSign size={18} /></button>
                        </div>
                        <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleCreatePost}
                            disabled={(!postText.trim() && !image) || posting || (postText || '').length > MAX_CHARACTERS}
                            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Send size={14} />
                          {posting ? 'Posting...' : 'Post'}
                        </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">Loading feed...</div>
                ) : posts.length === 0 ? (
                  <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center text-[#6B7280]">No posts yet. Be the first to post!</div>
                ) : (
                  posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLike={handleLike}
                      onReport={handleReport}
                      onUpdate={fetchFeed}
                    />
                  ))
                )}
              </div>

              <div className="space-y-4">
                <CampusTrendsWidget className="shadow-sm border-[#E5E7EB]" />

                <WhoToFollowWidget className="shadow-sm border-[#E5E7EB]" />
                
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
