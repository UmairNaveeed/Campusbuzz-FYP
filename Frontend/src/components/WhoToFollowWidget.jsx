import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFollowSuggestions } from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';

const INITIAL_SIZE = 5;
const LOAD_MORE_SIZE = 20;

function mergeSuggestions(prev, next) {
  const seen = new Set(prev.map((u) => u.username || u.firebaseId));
  const added = next.filter((u) => {
    const key = u.username || u.firebaseId;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...prev, ...added];
}

export default function WhoToFollowWidget({ className = '' }) {
  const { user: authUser } = useAuth();
  const { profile } = useProfile();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [followingUsers, setFollowingUsers] = useState(new Set());
  const profileKeyRef = useRef('');

  useEffect(() => {
    if (!profile?.following || !Array.isArray(profile.following)) return;
    const usernames = profile.following
      .map((u) => (typeof u === 'object' ? u.username : null))
      .filter(Boolean);
    setFollowingUsers(new Set(usernames));
  }, [profile?.following]);

  const loadPage = useCallback(async (nextSkip, append, pageSize) => {
    if (!authUser) {
      setSuggestions([]);
      setHasMore(false);
      setLoading(false);
      return;
    }

    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setLoadError('');
    }

    try {
      const data = await getFollowSuggestions({ limit: pageSize, skip: nextSkip });
      if (data?.success && Array.isArray(data.suggestions)) {
        if (!append) {
          setExpanded(false);
          setSuggestions(data.suggestions);
        } else {
          setSuggestions((prev) => mergeSuggestions(prev, data.suggestions));
        }
        setHasMore(Boolean(data.hasMore));
        setSkip(nextSkip + data.suggestions.length);
        setLoadError('');
      } else if (!append) {
        setSuggestions([]);
        setHasMore(false);
        setSkip(0);
        setExpanded(false);
        setLoadError(data?.error || 'Could not load suggestions');
      }
    } catch (err) {
      if (!append) {
        setSuggestions([]);
        setHasMore(false);
        setSkip(0);
        setExpanded(false);
        const msg = err.response?.data?.error || err.message || 'Could not load suggestions';
        setLoadError(msg.includes('Network') || err.code === 'ERR_NETWORK'
          ? 'Server unavailable. Start the backend on port 5000.'
          : msg);
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.uid) {
      profileKeyRef.current = '';
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const key = `${authUser.uid}|${profile?.department || ''}`;
    if (profileKeyRef.current === key) return;
    profileKeyRef.current = key;
    loadPage(0, false, INITIAL_SIZE);
  }, [authUser?.uid, profile?.department, loadPage]);

  const handleToggleExpand = async () => {
    if (loadingMore) return;

    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);
    const alreadyLoadedMore = suggestions.length > INITIAL_SIZE;
    if (!alreadyLoadedMore && hasMore) {
      await loadPage(skip, true, LOAD_MORE_SIZE);
    }
  };

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, INITIAL_SIZE);
  const canToggle = hasMore || suggestions.length > INITIAL_SIZE;
  const showFooter = !loading && suggestions.length > 0 && canToggle;

  const handleFollow = async (username, e) => {
    e?.stopPropagation();
    if (!username) return;
    try {
      const isFollowing = followingUsers.has(username);
      if (isFollowing) {
        await api.post(`/api/profile/${username}/unfollow`);
        setFollowingUsers((prev) => {
          const next = new Set(prev);
          next.delete(username);
          return next;
        });
      } else {
        await api.post(`/api/profile/${username}/follow`);
        setFollowingUsers((prev) => new Set(prev).add(username));
        setSuggestions((prev) => prev.filter((u) => u.username !== username));
        setSkip((s) => Math.max(0, s - 1));
      }
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update follow status');
    }
  };

  return (
    <div className={`bg-white border border-[#dfe2eb] rounded-2xl overflow-hidden ${className}`}>
      <div className="px-4 pt-4 pb-2">
        <h3 className="text-lg font-bold text-[#2f3348]">Who to Follow</h3>
      </div>
      <div className="px-4 pb-2 min-h-[80px]">
        {loading ? (
          <div className="py-2 space-y-3 animate-pulse">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-gray-200 rounded" />
                  <div className="h-3 w-1/2 bg-gray-200 rounded" />
                </div>
                <div className="w-16 h-8 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-6 px-2">
            <p className="text-sm text-[#8a90a5]">{loadError}</p>
            <button
              type="button"
              onClick={() => loadPage(0, false, INITIAL_SIZE)}
              className="mt-3 text-sm font-semibold text-[#6b5afc] hover:underline"
            >
              Retry
            </button>
          </div>
        ) : visibleSuggestions.length === 0 ? (
          <p className="text-sm text-[#8a90a5] text-center py-6">
            No suggestions right now. Try following fewer accounts or update your department in profile.
          </p>
        ) : (
          <div className="space-y-3 py-1 max-h-[min(70vh,520px)] overflow-y-auto">
            {visibleSuggestions.map((suggestion) => {
              const isFollowing = followingUsers.has(suggestion.username);
              return (
                <div key={suggestion.firebaseId || suggestion.username} className="flex items-center gap-3">
                  <Link to={`/user/${suggestion.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                    {suggestion.profilePhoto ? (
                      <img
                        src={suggestion.profilePhoto}
                        alt={suggestion.name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-[#e9e9f8] text-[#6a62b9] flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                        {(suggestion.name || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-[#2f3348] truncate">{suggestion.name}</span>
                      <span className="block text-xs text-[#8a90a5] truncate">@{suggestion.username}</span>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleFollow(suggestion.username, e)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                      isFollowing
                        ? 'bg-[#f4f3ff] border-[#cfcaff] text-[#6b5afc]'
                        : 'bg-white border-[#8b7dff] text-[#6b5afc] hover:bg-[#f4f3ff]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              );
            })}
            {loadingMore && (
              <p className="text-center text-xs text-[#8a90a5] py-2">Loading more accounts…</p>
            )}
          </div>
        )}
      </div>
      {showFooter && (
        <button
          type="button"
          onClick={handleToggleExpand}
          disabled={loadingMore}
          className="flex w-full items-center justify-center gap-1 py-3 text-sm font-medium text-[#6b5afc] hover:bg-[#faf9ff] border-t border-[#f0f1f5] transition-colors disabled:opacity-60"
        >
          {loadingMore ? 'Loading…' : expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}