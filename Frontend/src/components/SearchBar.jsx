import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { searchUsersForMention } from '../services/api';

const DEBOUNCE_MS = 300;

export default function SearchBar({ className = '', placeholder = 'Search CampusBuzz...' }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  const fetchResults = useCallback(async (q) => {
    const trimmed = (q || '').trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchUsersForMention(trimmed);
      const users = data?.users || [];
      setResults(Array.isArray(users) ? users : []);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => {
      fetchResults(query);
      setShowDropdown(true);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, fetchResults]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) && inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const trimmed = query.trim();
      if (trimmed.startsWith('#')) {
        const tag = trimmed.slice(1).replace(/\s/g, '');
        if (tag) navigate(`/hashtag/${encodeURIComponent(tag)}`);
        setShowDropdown(false);
      } else if (results.length > 0) {
        navigate(`/user/${results[0].username}`);
        setShowDropdown(false);
        setQuery('');
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const handleUserClick = (username) => {
    navigate(`/user/${username}`);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="h-10 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] pl-10 pr-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30"
        />
      </div>

      {showDropdown && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[#E5E7EB] bg-white shadow-lg z-50 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-[#6B7280]">Searching...</div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((user) => (
                <button
                  key={user._id || user.firebaseId || user.username}
                  type="button"
                  onClick={() => handleUserClick(user.username)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5F3FF] text-left transition-colors"
                >
                  {user.profilePhoto ? (
                    <img src={user.profilePhoto} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center text-sm font-bold text-[#7C3AED] shrink-0">
                      {(user.name || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111827] truncate">{user.name}</p>
                    <p className="text-xs text-[#6B7280] truncate">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-[#6B7280]">No users found</div>
          )}
          {query.trim().startsWith('#') && (
            <button
              type="button"
              onClick={() => {
                const tag = query.trim().slice(1).replace(/\s/g, '');
                if (tag) navigate(`/hashtag/${encodeURIComponent(tag)}`);
                setShowDropdown(false);
                setQuery('');
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F5F3FF] text-left border-t border-[#E5E7EB] transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-[#EDE9FE] flex items-center justify-center shrink-0">
                <span className="text-[#7C3AED] font-bold">#</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111827]">Search for #{query.trim().slice(1)}</p>
                <p className="text-xs text-[#6B7280]">View hashtag posts</p>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
