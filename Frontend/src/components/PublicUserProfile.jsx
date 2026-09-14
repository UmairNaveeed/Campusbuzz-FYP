import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function PublicUserProfile() {
  const navigate = useNavigate();
  const { username } = useParams();
  const { user: firebaseUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getJoinedLabel = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError('Username is required.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/api/profile/public/${username}`);
        if (response.data?.success) {
          setProfile(response.data.user);
        } else {
          setError(response.data?.error || 'User not found.');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError('User not found.');
        } else {
          setError('Failed to load profile.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <div className="w-full max-w-[1200px] mx-auto min-h-screen flex flex-col lg:flex-row">
        <div className="hidden lg:flex lg:w-[280px] border-r border-gray-200 items-start justify-center pt-3">
          <button
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-full hover:bg-gray-200/70 text-2xl leading-none text-[#0a1d37]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 w-full lg:max-w-[640px] bg-white border-gray-200 min-h-screen lg:border-l lg:border-r">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Loading profile...</div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-[#0a1d37] text-white rounded-full"
              >
                Login
              </button>
            </div>
          ) : (
            <>
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
                <div className="h-[53px] flex items-center px-3">
                  <button
                    onClick={() => navigate('/')}
                    className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center mr-4"
                    aria-label="Back"
                  >
                    <span className="text-lg">←</span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[20px] font-bold leading-6 text-[#0a1d37] truncate">{profile?.name || 'User'}</p>
                    <p className="text-[13px] text-[#536471]">0 posts</p>
                  </div>
                </div>
              </div>

              <div className="h-[200px] bg-[#cfd9de]">
                {profile?.coverPhoto ? (
                  <img src={profile.coverPhoto} alt="Cover" className="w-full h-full object-cover" />
                ) : null}
              </div>

              <div className="px-4 pb-3">
                <div className="flex justify-between items-start -mt-16">
                  {profile?.profilePhoto ? (
                    <img
                      src={profile.profilePhoto}
                      alt="Profile"
                      className="w-28 h-28 sm:w-[134px] sm:h-[134px] rounded-full border-4 border-white bg-white object-cover"
                    />
                  ) : (
                    <div className="w-28 h-28 sm:w-[134px] sm:h-[134px] rounded-full border-4 border-white bg-[#d9d9d9]" />
                  )}

                  <button className="mt-[72px] bg-[#0a1d37] text-white text-[15px] font-semibold rounded-full px-5 h-9">
                    Follow
                  </button>
                </div>

                <div className="mt-3">
                  <h1 className="text-[31px] leading-9 font-extrabold text-[#0a1d37]">{profile?.name || 'User'}</h1>
                  <p className="text-[15px] text-[#536471]">@{profile?.username}</p>
                </div>

                {getJoinedLabel(profile?.createdAt) ? (
                  <div className="mt-3 text-[15px] text-[#536471] flex items-center gap-2">
                    <span>📅</span>
                    <span>Joined {getJoinedLabel(profile?.createdAt)}</span>
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-5 text-[15px]">
                  <span className="text-[#0a1d37]">
                    <span className="font-bold">{profile?.followingCount ?? 0}</span>{' '}
                    <span className="text-[#536471]">Following</span>
                  </span>
                  <span className="text-[#0a1d37]">
                    <span className="font-bold">{profile?.followersCount ?? 0}</span>{' '}
                    <span className="text-[#536471]">Followers</span>
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 text-center text-[15px] font-semibold text-[#536471]">
                  <div className="py-4 relative text-[#0a1d37]">
                    Posts
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[56px] h-1 rounded-full bg-[#1d9bf0]" />
                  </div>
                  <div className="py-4">Replies</div>
                  <div className="py-4">Media</div>
                </div>
              </div>

              <div className="border-t border-gray-200 px-6 py-8">
                <h2 className="text-[34px] leading-[38px] font-extrabold text-[#0a1d37]">
                  @{profile?.username}
                  <br />
                  hasn&apos;t posted
                </h2>
                <p className="mt-2 text-[15px] text-[#536471]">
                  To view full account details and posts, please log in.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {firebaseUser ? (
                    <button
                      onClick={() => navigate(`/user/${profile?.username}`)}
                      className="h-10 px-5 rounded-full bg-[#0a1d37] text-white text-[15px] font-semibold"
                    >
                      View Full Profile
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/login')}
                        className="h-10 px-5 rounded-full bg-[#0a1d37] text-white text-[15px] font-semibold"
                      >
                        Sign in
                      </button>
                      <button
                        onClick={() => navigate('/signup')}
                        className="h-10 px-5 rounded-full border border-[#cfd9de] text-[#0a1d37] text-[15px] font-semibold bg-white"
                      >
                        Create account
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hidden xl:block w-[350px] p-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-[21px] font-extrabold text-[#0a1d37]">New to CampusBuzz?</h3>
            <p className="text-[14px] text-[#536471] mt-1 mb-4">
              Sign up now to get your own personalized timeline!
            </p>

            <button
              onClick={() => navigate('/login')}
              className="w-full h-10 rounded-full border border-[#cfd9de] text-[#0a1d37] font-semibold text-[15px] mb-2 hover:bg-gray-50"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full h-10 rounded-full bg-[#0a1d37] text-white font-semibold text-[15px] mb-2 hover:opacity-95"
            >
              Create account
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="w-full h-10 rounded-full border border-[#cfd9de] text-[#0a1d37] font-semibold text-[15px] hover:bg-gray-50"
            >
              Sign up with email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
