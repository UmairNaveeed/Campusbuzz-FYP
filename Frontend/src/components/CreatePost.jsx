import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FormInput from './FormInput';
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
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { createPost as createPostApi, searchUsersForMention, getTrendingHashtags, searchHashtags } from '../services/api';
import { getMentionContext, getHashtagContext } from '../utils/mentionUtils';
import { useCreatePost } from '../context/CreatePostContext';
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

export default function CreatePost({ isModal = false }) {
  const navigate = useNavigate();
  const { closeCreatePost, openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile } = useProfile();
  const [content, setContent] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [mentions, setMentions] = useState('');
  const [images, setImages] = useState([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [showMentionsFieldDropdown, setShowMentionsFieldDropdown] = useState(false);
  const [mentionsFieldSuggestions, setMentionsFieldSuggestions] = useState([]);
  const [mentionsFieldQuery, setMentionsFieldQuery] = useState('');
  const [mentionsFieldStartIndex, setMentionsFieldStartIndex] = useState(0);
  const [mentionsFieldCursorPosition, setMentionsFieldCursorPosition] = useState(0);
  const [mentionsFieldHighlightedIndex, setMentionsFieldHighlightedIndex] = useState(0);
  const [mentionsFieldLoading, setMentionsFieldLoading] = useState(false);
  const [showHashtagDropdown, setShowHashtagDropdown] = useState(false);
  const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
  const [hashtagQuery, setHashtagQuery] = useState('');
  const [hashtagStartIndex, setHashtagStartIndex] = useState(0);
  const [hashtagCursorPosition, setHashtagCursorPosition] = useState(0);
  const [hashtagHighlightedIndex, setHashtagHighlightedIndex] = useState(0);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [showHashtagsFieldDropdown, setShowHashtagsFieldDropdown] = useState(false);
  const [hashtagsFieldSuggestions, setHashtagsFieldSuggestions] = useState([]);
  const [hashtagsFieldQuery, setHashtagsFieldQuery] = useState('');
  const [hashtagsFieldStartIndex, setHashtagsFieldStartIndex] = useState(0);
  const [hashtagsFieldCursorPosition, setHashtagsFieldCursorPosition] = useState(0);
  const [hashtagsFieldHighlightedIndex, setHashtagsFieldHighlightedIndex] = useState(0);
  const [hashtagsFieldLoading, setHashtagsFieldLoading] = useState(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mentionDropdownRef = useRef(null);
  const mentionsFieldDropdownRef = useRef(null);
  const mentionsFieldInputRef = useRef(null);
  const hashtagDropdownRef = useRef(null);
  const hashtagsFieldDropdownRef = useRef(null);
  const hashtagsFieldInputRef = useRef(null);
  const textareaRef = useRef(null);

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

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const MAX_CHARACTERS = 280;

  const normalizeHashtag = (tag) => {
    return String(tag || '').trim().replace(/^#/, '').toLowerCase();
  };

  const extractHashtagsFromText = (text) => {
    const matches = String(text || '').match(/#([A-Za-z0-9_]+)/g) || [];
    return matches.map((tag) => normalizeHashtag(tag));
  };

  const buildTagPart = (hashtagsValue) => {
    const hashtagsTrimmed = (hashtagsValue || '').trim();
    if (!hashtagsTrimmed) return '';

    const uniqueTags = [];
    const seen = new Set();

    hashtagsTrimmed.split(',').forEach((t) => {
      const trimmed = t.trim().replace(/^#/, '');
      const normalized = normalizeHashtag(trimmed);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        uniqueTags.push('#' + normalized);
      }
    });

    return uniqueTags.join(' ');
  };

  const buildMentionPart = (mentionsValue) => {
    const mentionsTrimmed = (mentionsValue || '').trim();
    if (!mentionsTrimmed) return '';
    return mentionsTrimmed.split(',').map((m) => {
      const trimmed = m.trim().replace(/^@/, '');
      return trimmed ? '@' + trimmed : '';
    }).filter(Boolean).join(' ');
  };

  const buildFullContent = () => {
    const text = (content || '').trim();
    const mentionPart = buildMentionPart(mentions);

    const existingTags = new Set(extractHashtagsFromText(text));
    const allTags = (buildTagPart(hashtags) || '')
      .split(' ')
      .filter(Boolean)
      .map((tag) => normalizeHashtag(tag));

    const tagsToAppend = allTags.filter((tag) => !existingTags.has(tag));
    const tagPart = tagsToAppend.length ? tagsToAppend.map((tag) => '#' + tag).join(' ') : '';

    let fullText = text;
    if (tagPart) fullText += (fullText ? ' ' : '') + tagPart;
    if (mentionPart) fullText += (fullText ? ' ' : '') + mentionPart;

    return fullText.trim();
  };

  const getRemainingCharacters = () => {
    const fullContent = buildFullContent();
    return MAX_CHARACTERS - fullContent.length;
  };

  const handleContentChange = (newContent) => {
    // Calculate what the new full content would be
    const tagPart = buildTagPart(hashtags);
    const mentionPart = buildMentionPart(mentions);
    let testFullText = newContent.trim();
    if (tagPart) testFullText += (testFullText ? ' ' : '') + tagPart;
    if (mentionPart) testFullText += (testFullText ? ' ' : '') + mentionPart;
    
    // Only allow the change if it doesn't exceed the limit
    if (testFullText.length <= MAX_CHARACTERS) {
      setContent(newContent);
    } else {
      // Try to truncate to fit within limit
      const availableSpace = MAX_CHARACTERS - (tagPart.length + (tagPart ? 1 : 0) + mentionPart.length + (mentionPart ? 1 : 0));
      if (availableSpace > 0) {
        setContent(newContent.slice(0, availableSpace));
      }
    }
  };

  const handleHashtagsChange = (newHashtags) => {
    const tagPart = buildTagPart(newHashtags);
    const mentionPart = buildMentionPart(mentions);
    let testFullText = (content || '').trim();
    if (tagPart) testFullText += (testFullText ? ' ' : '') + tagPart;
    if (mentionPart) testFullText += (testFullText ? ' ' : '') + mentionPart;
    
    if (testFullText.length <= MAX_CHARACTERS) {
      setHashtags(newHashtags);
    }
  };

  const handleMentionsChange = (newMentions) => {
    const tagPart = buildTagPart(hashtags);
    const mentionPart = buildMentionPart(newMentions);
    let testFullText = (content || '').trim();
    if (tagPart) testFullText += (testFullText ? ' ' : '') + tagPart;
    if (mentionPart) testFullText += (testFullText ? ' ' : '') + mentionPart;
    
    if (testFullText.length <= MAX_CHARACTERS) {
      setMentions(newMentions);
    }
  };

  const handleMentionsFieldChange = (e) => {
    const newMentions = e.target.value;
    const start = e.target.selectionStart !== undefined ? e.target.selectionStart : newMentions.length;
    
    handleMentionsChange(newMentions);
    
    // Use setTimeout to ensure selectionStart is accurate after React updates
    setTimeout(() => {
      if (mentionsFieldInputRef.current) {
        const currentStart = mentionsFieldInputRef.current.selectionStart !== undefined 
          ? mentionsFieldInputRef.current.selectionStart 
          : newMentions.length;
        setMentionsFieldCursorPosition(currentStart);
        const ctx = getMentionsFieldContext(newMentions, currentStart);
        if (ctx !== null) {
          setShowMentionsFieldDropdown(true);
          setMentionsFieldQuery(ctx.query || '');
          setMentionsFieldStartIndex(ctx.startIndex);
        } else {
          setShowMentionsFieldDropdown(false);
          setMentionsFieldQuery('');
        }
      }
    }, 0);
  };

  const handleHashtagsFieldChange = (e) => {
    const newHashtags = e.target.value;
    const start = e.target.selectionStart !== undefined ? e.target.selectionStart : newHashtags.length;
    
    handleHashtagsChange(newHashtags);
    
    // Use setTimeout to ensure selectionStart is accurate after React updates
    setTimeout(() => {
      if (hashtagsFieldInputRef.current) {
        const currentStart = hashtagsFieldInputRef.current.selectionStart !== undefined 
          ? hashtagsFieldInputRef.current.selectionStart 
          : newHashtags.length;
        setHashtagsFieldCursorPosition(currentStart);
        const ctx = getHashtagsFieldContext(newHashtags, currentStart);
        if (ctx !== null) {
          setShowHashtagsFieldDropdown(true);
          setHashtagsFieldQuery(ctx.query || '');
          setHashtagsFieldStartIndex(ctx.startIndex);
        } else {
          setShowHashtagsFieldDropdown(false);
          setHashtagsFieldQuery('');
        }
      }
    }, 0);
  };

  const insertHashtagsFieldHashtag = (hashtagName) => {
    if (!hashtagName) return;
    // Remove # if user included it
    const cleanHashtag = hashtagName.startsWith('#') ? hashtagName.slice(1) : hashtagName;
    
    const before = hashtags.slice(0, hashtagsFieldStartIndex);
    const after = hashtags.slice(hashtagsFieldCursorPosition);
    
    // Remove any existing partial hashtag text, then add #hashtag
    // Check if we need comma before
    const beforeTrimmed = before.trim();
    const needsComma = beforeTrimmed && !beforeTrimmed.endsWith(',') && !beforeTrimmed.endsWith(' ');
    const prefix = needsComma ? ', ' : (beforeTrimmed && !beforeTrimmed.endsWith(',') ? ' ' : '');
    
    // Check if we need to add comma after
    const afterTrimmed = after.trim();
    const needsCommaAfter = afterTrimmed && !afterTrimmed.startsWith(',');
    
    // Automatically add # before the hashtag
    const newHashtags = before + prefix + `#${cleanHashtag}` + (needsCommaAfter ? ', ' : '') + after;
    handleHashtagsChange(newHashtags);
    setShowHashtagsFieldDropdown(false);
    setHashtagsFieldSuggestions([]);
    setHashtagsFieldQuery('');
    setTimeout(() => {
      if (hashtagsFieldInputRef.current) {
        const newStart = hashtagsFieldStartIndex + prefix.length + cleanHashtag.length + 1; // +1 for #
        const pos = needsCommaAfter ? newStart + 2 : newStart; // +2 for ', '
        hashtagsFieldInputRef.current.focus();
        hashtagsFieldInputRef.current.setSelectionRange(pos, pos);
        setHashtagsFieldCursorPosition(pos);
      }
    }, 0);
  };

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
        setImages((prev) => [...prev, reader.result]);
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
    const currentContent = content;
    const newContent = currentContent + emoji;
    if (newContent.length <= MAX_CHARACTERS) {
      handleContentChange(newContent);
      setShowEmojiPicker(false);
    }
  };

  const handleHashtagButtonClick = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart || content.length;
      const end = textarea.selectionEnd || content.length;
      
      // Insert "#" at cursor position
      const before = content.slice(0, start);
      const after = content.slice(end);
      const newContent = before + '#' + after;
      
      if (newContent.length <= MAX_CHARACTERS) {
        handleContentChange(newContent);
        
        // Set cursor position after "#"
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = start + 1;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newPos, newPos);
            setHashtagCursorPosition(newPos);
            
            // Trigger hashtag dropdown
            const ctx = getHashtagContext(newContent, newPos);
            if (ctx) {
              setShowHashtagDropdown(true);
              setHashtagQuery(ctx.query);
              setHashtagStartIndex(ctx.startIndex);
            }
          }
        }, 0);
      }
    } else {
      // If textarea is not focused, just add "#" at the end
      const newContent = content + '#';
      if (newContent.length <= MAX_CHARACTERS) {
        handleContentChange(newContent);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            const newPos = newContent.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
      }
    }
  };

  const getHashtagsFieldContext = (value, selectionStart) => {
    const textBefore = value.slice(0, selectionStart);
    
    // Find the start of current word (either after comma, space, or at beginning)
    let wordStart = textBefore.lastIndexOf(',');
    if (wordStart === -1) wordStart = textBefore.lastIndexOf(' ');
    if (wordStart === -1) wordStart = 0;
    else wordStart = wordStart + 1; // Move past comma/space
    
    // Get the current word being typed (user doesn't need to type #)
    const textAfter = value.slice(selectionStart);
    const commaAfter = textAfter.indexOf(',');
    const spaceAfter = textAfter.indexOf(' ');
    const wordEnd = commaAfter === -1 && spaceAfter === -1
      ? value.length
      : commaAfter === -1
        ? selectionStart + spaceAfter
        : spaceAfter === -1
          ? selectionStart + commaAfter
          : selectionStart + Math.min(commaAfter, spaceAfter);
    
    const query = value.slice(wordStart, wordEnd).trim();
    
    // Remove # if user typed it, but we'll add it automatically
    const cleanQuery = query.startsWith('#') ? query.slice(1) : query;
    
    // Show suggestions if there's any text being typed
    if (cleanQuery && cleanQuery.length > 0) {
      return { startIndex: wordStart, query: cleanQuery };
    }
    
    return null;
  };

  const getMentionsFieldContext = (value, selectionStart) => {
    const textBefore = value.slice(0, selectionStart);
    
    // Find the start of current word (either after comma, space, or at beginning)
    let wordStart = textBefore.lastIndexOf(',');
    if (wordStart === -1) wordStart = textBefore.lastIndexOf(' ');
    if (wordStart === -1) wordStart = 0;
    else wordStart = wordStart + 1; // Move past comma/space
    
    // Get the current word being typed
    const textAfter = value.slice(selectionStart);
    const commaAfter = textAfter.indexOf(',');
    const spaceAfter = textAfter.indexOf(' ');
    const wordEnd = commaAfter === -1 && spaceAfter === -1
      ? value.length
      : commaAfter === -1
        ? selectionStart + spaceAfter
        : spaceAfter === -1
          ? selectionStart + commaAfter
          : selectionStart + Math.min(commaAfter, spaceAfter);
    
    const query = value.slice(wordStart, wordEnd).trim();
    
    // Show suggestions if there's any text being typed (user doesn't need to type @)
    if (query && query.length > 0) {
      return { startIndex: wordStart, query };
    }
    
    return null;
  };

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
    if (!showMentionsFieldDropdown) {
      setMentionsFieldSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      // If query is empty or just whitespace, don't search
      const query = mentionsFieldQuery ? mentionsFieldQuery.trim() : '';
      if (!query) {
        setMentionsFieldSuggestions([]);
        setMentionsFieldLoading(false);
        return;
      }
      setMentionsFieldLoading(true);
      try {
        const res = await searchUsersForMention(query);
        const users = (res.users || []).slice(0, 8);
        setMentionsFieldSuggestions(users);
        setMentionsFieldHighlightedIndex(0);
      } catch (err) {
        console.error('Mention search error:', err);
        setMentionsFieldSuggestions([]);
      } finally {
        setMentionsFieldLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [showMentionsFieldDropdown, mentionsFieldQuery]);

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
    if (!showHashtagsFieldDropdown) {
      setHashtagsFieldSuggestions([]);
      return;
    }
    const timeoutId = setTimeout(async () => {
      const query = hashtagsFieldQuery ? hashtagsFieldQuery.trim() : '';
      if (!query) {
        // If no query, don't show suggestions
        setHashtagsFieldSuggestions([]);
        setHashtagsFieldLoading(false);
        return;
      }
      setHashtagsFieldLoading(true);
      try {
        // Search hashtags from all posts that start with the query
        const res = await searchHashtags(query);
        const hashtags = (res.hashtags || []).slice(0, 8);
        setHashtagsFieldSuggestions(hashtags.map(h => ({ name: h.name || h.hashtag || h })));
        setHashtagsFieldHighlightedIndex(0);
      } catch (err) {
        console.error('Hashtag search error:', err);
        setHashtagsFieldSuggestions([]);
      } finally {
        setHashtagsFieldLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [showHashtagsFieldDropdown, hashtagsFieldQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target) && 
          textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowMentionDropdown(false);
      }
      if (mentionsFieldDropdownRef.current && !mentionsFieldDropdownRef.current.contains(e.target) && 
          mentionsFieldInputRef.current && !mentionsFieldInputRef.current.contains(e.target)) {
        setShowMentionsFieldDropdown(false);
      }
      if (hashtagDropdownRef.current && !hashtagDropdownRef.current.contains(e.target) && 
          textareaRef.current && !textareaRef.current.contains(e.target)) {
        setShowHashtagDropdown(false);
      }
      if (hashtagsFieldDropdownRef.current && !hashtagsFieldDropdownRef.current.contains(e.target) && 
          hashtagsFieldInputRef.current && !hashtagsFieldInputRef.current.contains(e.target)) {
        setShowHashtagsFieldDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertHashtag = (hashtagName) => {
    if (!hashtagName) return;
    // Remove # if user included it
    const cleanHashtag = hashtagName.startsWith('#') ? hashtagName.slice(1) : hashtagName;
    const before = content.slice(0, hashtagStartIndex);
    const after = content.slice(hashtagCursorPosition);
    const newContent = (before + `#${cleanHashtag} ` + after);
    if (newContent.length <= MAX_CHARACTERS) {
      handleContentChange(newContent);
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

  const insertMentionsFieldMention = (username) => {
    if (!username) return;
    const before = mentions.slice(0, mentionsFieldStartIndex);
    const after = mentions.slice(mentionsFieldCursorPosition);
    
    // Remove any existing @ or partial username, then add @username
    const beforeTrimmed = before.trim();
    const needsComma = beforeTrimmed && !beforeTrimmed.endsWith(',') && !beforeTrimmed.endsWith(' ');
    const prefix = needsComma ? ', ' : (beforeTrimmed && !beforeTrimmed.endsWith(',') ? ' ' : '');
    
    // Check if we need to add comma after
    const afterTrimmed = after.trim();
    const needsCommaAfter = afterTrimmed && !afterTrimmed.startsWith(',');
    
    const newMentions = before + prefix + `@${username}` + (needsCommaAfter ? ', ' : '') + after;
    handleMentionsChange(newMentions);
    setShowMentionsFieldDropdown(false);
    setMentionsFieldSuggestions([]);
    setMentionsFieldQuery('');
    setTimeout(() => {
      if (mentionsFieldInputRef.current) {
        const newStart = mentionsFieldStartIndex + prefix.length + username.length + 1; // +1 for @
        const pos = needsCommaAfter ? newStart + 2 : newStart; // +2 for ', '
        mentionsFieldInputRef.current.focus();
        mentionsFieldInputRef.current.setSelectionRange(pos, pos);
        setMentionsFieldCursorPosition(pos);
      }
    }, 0);
  };

  const insertMention = (username) => {
    if (!username) return;
    const before = content.slice(0, mentionStartIndex);
    const after = content.slice(cursorPosition);
    const newContent = (before + `@${username} ` + after);
    if (newContent.length <= MAX_CHARACTERS) {
      handleContentChange(newContent);
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


  const handlePublish = async () => {
    const fullContent = buildFullContent();
    if (!fullContent.trim() && images.length === 0) {
      setError('Please add some content or an image/video.');
      return;
    }
    if (fullContent.length > MAX_CHARACTERS) {
      setError(`Content must be ${MAX_CHARACTERS} characters or less.`);
      return;
    }
    
    // Check if video file is too large when base64 encoded (base64 increases size by ~33%)
    // Backend limit is 50MB, so we allow up to ~40MB base64 to be safe
    if (images.length > 0) {
      const media = images[0];
      if (media.startsWith('data:video/')) {
        const base64Size = media.length;
        const estimatedBytes = Math.ceil((base64Size * 3) / 4);
        const maxAllowedBytes = 40 * 1024 * 1024; // 40MB base64 (backend limit is 50MB)
        if (estimatedBytes > maxAllowedBytes) {
          setError(`Video file is too large (${(estimatedBytes / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is ~${Math.round(maxAllowedBytes / (1024 * 1024))}MB.`);
          return;
        }
      }
    }
    
    setError('');
    setPosting(true);
    try {
      // Send the first image if available (backend accepts single image)
      const imageToSend = images.length > 0 ? images[0] : null;
      await createPostApi(fullContent || '', imageToSend);
      window.dispatchEvent(new Event('postsUpdated'));
      
      // Reset form
      setContent('');
      setHashtags('');
      setMentions('');
      setImages([]);
      setError('');
      
      if (isModal) {
        closeCreatePost();
      } else {
        navigate('/home');
      }
    } catch (err) {
      console.error('Post creation error:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to post.';
      setError(errorMessage);
    } finally {
      setPosting(false);
    }
  };

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

  // Extract form content to be reusable (only the form fields, not sidebar)
  const formContent = (
    <>
              <div className="relative">
                <label className="block text-sm font-medium text-[#111827] mb-1.5">What's on your mind?</label>
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    placeholder="Share something with the campus..."
                    value={content}
                    onChange={(e) => {
                      const val = e.target.value;
                      handleContentChange(val);
                      const start = e.target.selectionStart || 0;
                      setCursorPosition(start);
                      const mentionCtx = getMentionContext(val, start);
                      const hashtagCtx = getHashtagContext(val, start);
                      // Prioritize hashtag if both are detected
                      if (hashtagCtx) {
                        setShowHashtagDropdown(true);
                        setHashtagQuery(hashtagCtx.query);
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
                    rows={4}
                    className="w-full rounded-xl border border-[#D8D8D8] bg-[#ECECEF] px-4 py-2.5 text-sm placeholder:text-[#7E8599] text-[#2F3348] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 transition-shadow resize-none min-h-[82px]"
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
                </div>
                <div className="mt-2 flex justify-end">
                  <span className={`text-sm font-semibold ${
                    getRemainingCharacters() < 0 
                      ? 'text-red-600' 
                      : getRemainingCharacters() <= 20 
                        ? 'text-orange-500' 
                        : 'text-[#6B7280]'
                  }`}>
                    {buildFullContent().length}/{MAX_CHARACTERS}
                  </span>
                </div>
              </div>

              {/* Media preview */}
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((media, i) => (
                    <div key={i} className="relative rounded-xl overflow-hidden border border-[#E5E7EB] w-32 h-32">
                      {media.startsWith('data:video/') ? (
                        <video src={media} className="w-full h-full object-cover" controls />
                      ) : (
                        <img src={media} alt="" className="w-full h-full object-cover" />
                      )}
                      <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*,video/*"
                className="hidden"
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#111827]">Hashtags</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                    <Hash size={16} />
                  </div>
                  <input
                    ref={hashtagsFieldInputRef}
                    type="text"
                    placeholder="e.g. capstone, SEAS, research"
                    value={hashtags}
                    onChange={handleHashtagsFieldChange}
                    onKeyDown={(e) => {
                      if (!showHashtagsFieldDropdown || hashtagsFieldSuggestions.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHashtagsFieldHighlightedIndex((i) => (i + 1) % hashtagsFieldSuggestions.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHashtagsFieldHighlightedIndex((i) => (i - 1 + hashtagsFieldSuggestions.length) % hashtagsFieldSuggestions.length);
                      } else if (e.key === 'Enter' && hashtagsFieldSuggestions[hashtagsFieldHighlightedIndex]) {
                        e.preventDefault();
                        insertHashtagsFieldHashtag(hashtagsFieldSuggestions[hashtagsFieldHighlightedIndex].name);
                      } else if (e.key === 'Escape') {
                        setShowHashtagsFieldDropdown(false);
                      }
                    }}
                    className="w-full rounded-xl border border-[#D8D8D8] bg-[#ECECEF] pl-10 pr-4 py-2.5 text-sm placeholder:text-[#7E8599] text-[#2F3348] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 transition-shadow"
                  />
                  {showHashtagsFieldDropdown && (
                    <div
                      ref={hashtagsFieldDropdownRef}
                      className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden"
                    >
                      {hashtagsFieldLoading ? (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">Searching...</div>
                      ) : hashtagsFieldQuery && hashtagsFieldQuery.trim() && hashtagsFieldSuggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">No hashtags found</div>
                      ) : hashtagsFieldSuggestions.length > 0 ? (
                        hashtagsFieldSuggestions.map((h, i) => (
                          <button
                            key={h.name || i}
                            type="button"
                            onClick={() => insertHashtagsFieldHashtag(h.name)}
                            onMouseEnter={() => setHashtagsFieldHighlightedIndex(i)}
                            className={`w-full px-4 py-2.5 text-left text-sm ${
                              i === hashtagsFieldHighlightedIndex ? 'bg-[#F5F3FF]' : 'hover:bg-[#F3F4F6]'
                            }`}
                          >
                            <div className="font-medium text-[#111827]">#{h.name}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">Type a hashtag name to search</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#111827]">Mentions</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                    <AtSign size={16} />
                  </div>
                  <input
                    ref={mentionsFieldInputRef}
                    type="text"
                    placeholder="e.g. @saman.z, @eyeamruba"
                    value={mentions}
                    onChange={handleMentionsFieldChange}
                    onKeyDown={(e) => {
                      if (!showMentionsFieldDropdown || mentionsFieldSuggestions.length === 0) return;
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMentionsFieldHighlightedIndex((i) => (i + 1) % mentionsFieldSuggestions.length);
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setMentionsFieldHighlightedIndex((i) => (i - 1 + mentionsFieldSuggestions.length) % mentionsFieldSuggestions.length);
                      } else if (e.key === 'Enter' && mentionsFieldSuggestions[mentionsFieldHighlightedIndex]) {
                        e.preventDefault();
                        insertMentionsFieldMention(mentionsFieldSuggestions[mentionsFieldHighlightedIndex].username);
                      } else if (e.key === 'Escape') {
                        setShowMentionsFieldDropdown(false);
                      }
                    }}
                    className="w-full rounded-xl border border-[#D8D8D8] bg-[#ECECEF] pl-10 pr-4 py-2.5 text-sm placeholder:text-[#7E8599] text-[#2F3348] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 transition-shadow"
                  />
                  {showMentionsFieldDropdown && (
                    <div
                      ref={mentionsFieldDropdownRef}
                      className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden"
                    >
                      {mentionsFieldLoading ? (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">Searching...</div>
                      ) : mentionsFieldQuery && mentionsFieldQuery.trim() && mentionsFieldSuggestions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">No users found</div>
                      ) : mentionsFieldQuery && mentionsFieldQuery.trim() && mentionsFieldSuggestions.length > 0 ? (
                        mentionsFieldSuggestions.map((u, i) => (
                          <button
                            key={u._id || u.id || u.username}
                            type="button"
                            onClick={() => insertMentionsFieldMention(u.username)}
                            onMouseEnter={() => setMentionsFieldHighlightedIndex(i)}
                            className={`w-full px-4 py-2.5 text-left text-sm ${
                              i === mentionsFieldHighlightedIndex ? 'bg-[#F5F3FF]' : 'hover:bg-[#F3F4F6]'
                            }`}
                          >
                            <div className="font-medium text-[#111827]">{u.name || u.username}</div>
                            <div className="text-xs text-[#6B7280]">@{u.username}</div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-[#6B7280]">Type a username to search</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {getRemainingCharacters() < 0 && !error && (
                <p className="text-sm text-red-600">Your post exceeds the {MAX_CHARACTERS} character limit. Please shorten your content.</p>
              )}

              {/* Action bar */}
              <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-4">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={handleImageButtonClick} className="rounded-lg p-2 text-[#7C3AED] hover:bg-[#F5F3FF] transition-colors" title="Add photo or video">
                    <Image size={18} />
                  </button>
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
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={posting || (!buildFullContent().trim() && images.length === 0) || buildFullContent().length > MAX_CHARACTERS}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={14} /> {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
    </>
  );

  // If modal mode, return just the form content
  if (isModal) {
    return formContent;
  }

  // Otherwise return full page with sidebar
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
                        isActive={item.label === 'Create Post'}
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
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
              {initial}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        {/* Top bar */}
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <div className="flex items-center gap-1">
              <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="h-9 gap-2 rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm font-medium text-[#374151]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">{initial}</span>
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

        {/* Create Post content */}
        <div className="px-6 py-5">
          <div className="mx-auto max-w-2xl">
            <h1 className="text-2xl font-bold text-[#111827] mb-6">Create Post</h1>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-5">
              {formContent}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
