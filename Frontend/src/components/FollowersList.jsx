import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const FollowersList = ({ username, type, onClose, isOwnProfile = false }) => {
  const navigate = useNavigate();
  const { user: firebaseUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      if (!username) {
        console.log('⚠️ No username provided to FollowersList');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const endpoint = type === 'followers' 
          ? `/api/profile/${username}/followers`
          : `/api/profile/${username}/following`;
        
        console.log(`📥 Fetching ${type} for username:`, username, 'Endpoint:', endpoint);
        const response = await api.get(endpoint);
        console.log(`✅ ${type} response:`, response.data);
        
        if (response.data.success) {
          const usersList = type === 'followers' ? response.data.followers : response.data.following;
          console.log(`✅ Loaded ${usersList.length} ${type}`);
          setUsers(usersList);
        } else {
          setError(response.data.error || 'Failed to load users');
        }
      } catch (err) {
        console.error(`❌ Error fetching ${type}:`, err);
        console.error(`❌ Error response:`, err.response?.data);
        setError(err.response?.data?.error || `Failed to load ${type}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [username, type]);

  const handleUserClick = (userUsername, e) => {
    // Don't navigate if clicking on the button
    if (e && (e.target.closest('button') || e.target.closest('svg'))) {
      return;
    }
    onClose();
    navigate(`/user/${userUsername}`);
  };

  // Handle unfollow action (for following list)
  const handleUnfollow = async (userUsername, e) => {
    e.stopPropagation();
    
    setActionLoading(prev => ({ ...prev, [userUsername]: true }));
    try {
      await api.post(`/api/profile/${userUsername}/unfollow`);
      
      // Remove user from the list
      setUsers(prev => prev.filter(user => user.username !== userUsername));
      
      // Dispatch event to update profile counts
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err) {
      console.error('Error unfollowing user:', err);
      alert(err.response?.data?.error || 'Failed to unfollow user');
    } finally {
      setActionLoading(prev => ({ ...prev, [userUsername]: false }));
    }
  };

  // Handle remove follower action (for followers list)
  const handleRemoveFollower = async (userUsername, e) => {
    e.stopPropagation();
    
    setActionLoading(prev => ({ ...prev, [userUsername]: true }));
    try {
      await api.post(`/api/profile/${userUsername}/remove-follower`);
      
      // Remove user from the list
      setUsers(prev => prev.filter(user => user.username !== userUsername));
      
      // Dispatch event to update profile counts
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err) {
      console.error('Error removing follower:', err);
      alert(err.response?.data?.error || 'Failed to remove follower');
    } finally {
      setActionLoading(prev => ({ ...prev, [userUsername]: false }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-2 sm:p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl sm:rounded-2xl w-full max-w-[600px] max-h-[90vh] sm:max-h-[80vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border-medium">
          <h2 className="text-lg sm:text-xl font-bold text-text-primary">
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
                <p className="text-text-secondary">Loading...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-brand-primary text-white rounded-full hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-text-secondary text-lg">No {type} yet</p>
                <p className="text-text-secondary text-sm mt-1">
                  {type === 'followers' 
                    ? 'This user doesn\'t have any followers yet.'
                    : 'This user isn\'t following anyone yet.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border-medium">
              {users.map((user) => (
                <div
                  key={user.firebaseId}
                  onClick={(e) => handleUserClick(user.username, e)}
                  className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  {user.profilePhoto ? (
                    <img
                      src={user.profilePhoto}
                      alt={user.name}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0 border border-gray-200"
                    />
                  ) : (
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 border border-gray-200">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-semibold text-text-primary truncate">
                      {user.name}
                    </div>
                    <div className="text-xs sm:text-sm text-text-secondary truncate">
                      @{user.username}
                    </div>
                  </div>
                  {/* Action Buttons - Only show if viewing own profile */}
                  {isOwnProfile && (
                    <div className="flex-shrink-0">
                      {type === 'followers' ? (
                        <button
                          onClick={(e) => handleRemoveFollower(user.username, e)}
                          disabled={actionLoading[user.username]}
                          className="px-3 lg:px-4 xl:px-[18px] py-1.5 lg:py-2 xl:py-2.5 rounded-full text-xs lg:text-sm xl:text-lg font-bold cursor-pointer h-auto lg:h-[38.63px] min-w-[60px] lg:min-w-[80px] xl:min-w-[92px] hover:opacity-90 transition-opacity flex-shrink-0 flex items-center justify-center text-red-600 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading[user.username] ? '...' : 'Remove'}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => handleUnfollow(user.username, e)}
                          disabled={actionLoading[user.username]}
                          className="px-3 lg:px-4 xl:px-[18px] py-1.5 lg:py-2 xl:py-2.5 rounded-full text-xs lg:text-sm xl:text-lg font-bold cursor-pointer h-auto lg:h-[38.63px] min-w-[60px] lg:min-w-[80px] xl:min-w-[92px] hover:opacity-90 transition-opacity flex-shrink-0 flex items-center justify-center bg-white text-text-primary border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading[user.username] ? '...' : 'Unfollow'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowersList;
