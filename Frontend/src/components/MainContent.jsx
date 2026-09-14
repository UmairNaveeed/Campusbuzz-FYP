import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AtSymbolIcon,
  FaceSmileIcon,
  HashtagIcon,
  MapPinIcon,
  PhotoIcon,
} from '@heroicons/react/24/outline';
import TweetCard from './TweetCard';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import api, { searchUsersForMention } from '../services/api';
import { getMentionContext } from '../utils/mentionUtils';

const commonEmojis = ['😀', '😂', '😍', '🔥', '🎉', '👏', '👍', '❤️', '✨', '🚀', '📚', '😎'];

const MainContent = () => {
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { profile } = useProfile();
  const { user: firebaseUser } = useAuth();
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const textareaRef = useRef(null);
  const mentionDropdownRef = useRef(null);
  const maxLength = 280;

  const formatDateTime = (value) => {
    if (!value) return 'Just now';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Just now';
    return d.toLocaleString();
  };

  const fetchTweets = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const res = await api.get('/api/posts/feed');
      const data = res.data;
      if (Array.isArray(data)) {
        setTweets(data);
      } else if (Array.isArray(data?.posts)) {
        setTweets(data.posts);
      } else if (Array.isArray(data?.tweets)) {
        setTweets(data.tweets);
      } else {
        setTweets([]);
      }
    } catch (err) {
      console.error('Failed to fetch feed:', err.response?.data?.error || err.message);
      setTweets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTweets(true);
    const handlePostsUpdate = () => fetchTweets(false);
    window.addEventListener('postsUpdated', handlePostsUpdate);
    return () => window.removeEventListener('postsUpdated', handlePostsUpdate);
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
    const handleClickOutside = (e) => {
      if (
        mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target) &&
        textareaRef.current && !textareaRef.current.contains(e.target)
      ) {
        setShowMentionDropdown(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertMention = useCallback((username) => {
    if (!username) return;
    const before = content.slice(0, mentionStartIndex);
    const after = content.slice(cursorPosition);
    const newContent = (before + `@${username} ` + after).slice(0, maxLength);
    setContent(newContent);
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
  }, [content, cursorPosition, maxLength, mentionStartIndex]);

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if ((!content.trim() && !image) || posting) return;
    try {
      setPosting(true);
      await api.post('/api/posts', { content: content.trim(), image, visibility: 'public' });
      setContent('');
      setImage(null);
      setImagePreview(null);
      fetchTweets(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create post.');
    } finally {
      setPosting(false);
    }
  };

  const displayInitial = (profile?.name || 'A').charAt(0).toUpperCase();

  return (
    <main className="flex-1 min-w-0 w-full max-w-[760px]">
      <section className="bg-white rounded-2xl border border-[#dfe2eb] p-4">
        <div className="flex gap-3">
          {profile?.profilePhoto ? (
            <img src={profile.profilePhoto} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#8b5cf6] text-white font-semibold flex items-center justify-center">
              {displayInitial}
            </div>
          )}

          <div className="flex-1 min-w-0 relative">
            <textarea
              ref={textareaRef}
              value={content}
              placeholder="What's buzzing on campus?"
              onChange={(e) => {
                const val = e.target.value;
                if (val.length <= maxLength) setContent(val);
                const start = e.target.selectionStart || 0;
                setCursorPosition(start);
                const ctx = getMentionContext(val, start);
                if (ctx) {
                  setShowMentionDropdown(true);
                  setMentionQuery(ctx.query);
                  setMentionStartIndex(ctx.startIndex);
                } else {
                  setShowMentionDropdown(false);
                }
              }}
              onKeyDown={(e) => {
                if (!showMentionDropdown || mentionSuggestions.length === 0) return;
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
              }}
              rows={3}
              className="w-full resize-none border-none outline-none text-[22px] leading-8 text-[#34394f] placeholder:text-[#9ca2b7]"
            />

            {showMentionDropdown && (
              <div
                ref={mentionDropdownRef}
                className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
              >
                {mentionLoading ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
                ) : !mentionQuery.trim() ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Type a username to search</div>
                ) : mentionSuggestions.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No users found</div>
                ) : (
                  mentionSuggestions.map((u, i) => (
                    <button
                      key={u._id || u.id || u.username}
                      type="button"
                      onClick={() => insertMention(u.username)}
                      onMouseEnter={() => setHighlightedIndex(i)}
                      className={`w-full px-4 py-2.5 text-left text-sm ${i === highlightedIndex ? 'bg-[#f0f4ff]' : 'hover:bg-gray-50'}`}
                    >
                      {u.name || u.username} @{u.username}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {imagePreview && (
          <div className="mt-3 relative rounded-xl overflow-hidden border border-gray-200">
            <img src={imagePreview} alt="Preview" className="w-full max-h-80 object-contain" />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="absolute top-2 right-2 bg-black/55 text-white rounded-full w-8 h-8"
            >
              ×
            </button>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#eceef5] flex items-center justify-between">
          <div className="flex items-center gap-4 text-[#7c66ff]">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Add image">
              <PhotoIcon className="w-5 h-5" />
            </button>
            <div className="relative" ref={emojiPickerRef}>
              <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} title="Add emoji">
                <FaceSmileIcon className="w-5 h-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-xl shadow p-2 z-30">
                  <div className="flex gap-1">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setContent((prev) => (prev + emoji).slice(0, maxLength));
                          setShowEmojiPicker(false);
                        }}
                        className="hover:bg-gray-100 rounded px-1.5 py-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <HashtagIcon className="w-5 h-5" />
            <AtSymbolIcon className="w-5 h-5" />
            <MapPinIcon className="w-5 h-5" />
          </div>

          <button
            type="button"
            onClick={handlePost}
            disabled={(!content.trim() && !image) || posting}
            className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-[18px] font-semibold rounded-full px-6 py-2.5 disabled:opacity-50"
          >
            {posting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-4">
        {loading ? (
          <div className="p-4 text-sm text-[#7f859a]">Loading posts...</div>
        ) : tweets.length === 0 ? (
          <div className="bg-white border border-[#dfe2eb] rounded-2xl p-6 text-center text-[#7f859a]">
            No posts yet. Be the first to post.
          </div>
        ) : (
          tweets.map((tweet) => {
            const isShared = tweet.isShared || false;
            const displayAvatar = isShared
              ? (profile?.profilePhoto || null)
              : (tweet?.author?.profilePhoto || tweet?.author?.photo || null);
            const displayName = isShared ? (profile?.name || 'You') : (tweet?.author?.name || 'Unknown');
            const displayHandle = isShared ? `@${(profile?.username || 'user').replace(/^@+/, '')}` : `@${(tweet?.author?.username || 'user').replace(/^@+/, '')}`;

            return (
              <TweetCard
                key={tweet._id}
                postId={tweet._id}
                avatar={displayAvatar}
                name={displayName}
                handle={displayHandle}
                time={formatDateTime(tweet.createdAt || tweet.created_at)}
                text={tweet.content}
                image={tweet.image}
                hashtags={tweet.hashtags}
                mentions={tweet.mentions}
                visibility={tweet.visibility || 'public'}
                stats={{
                  comments: tweet.commentsCount || 0,
                  likes: tweet.likesCount || tweet.likes?.length || 0,
                  liked: tweet.isLiked || tweet.likes?.some((like) => {
                    if (typeof like === 'object' && like._id) return like._id === firebaseUser?.uid;
                    return like === firebaseUser?.uid;
                  }) || false,
                }}
                postAuthor={tweet?.author}
                onUpdate={() => fetchTweets(false)}
                isShared={isShared}
                sharedByUsername={tweet.sharedByUsername}
                sharedByName={tweet.sharedByName}
              />
            );
          })
        )}
      </section>
    </main>
  );
};

export default MainContent;
