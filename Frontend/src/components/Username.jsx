import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { validateUsername } from '../lib/utils';
import { isAdminEmail } from '../utils/adminUtils';
import FormInput from './FormInput';
import { AtSign } from 'lucide-react';

const AUTH_CHANNEL = 'campusbuzz-auth';

export default function Username() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingUser, setPendingUser] = useState(null);
  const [adminBlocked, setAdminBlocked] = useState(null);

  // When another tab sets username, redirect this tab to home so only one tab can complete signup
  useEffect(() => {
    let channel;
    try {
      channel = new BroadcastChannel(AUTH_CHANNEL);
      channel.onmessage = (e) => {
        if (e.data?.type === 'username-set') {
          console.log('Received username-set from another tab, redirecting to home');
          navigate('/home', { replace: true });
        }
      };
    } catch (_) {}
    return () => { channel?.close(); };
  }, [navigate]);

  // Poll in case another tab set username (backup if BroadcastChannel missed)
  const isValidFirebaseId = (uid) => typeof uid === 'string' && uid.trim().length >= 10 && !uid.includes('@') && !uid.includes(' ');

  useEffect(() => {
    if (!auth.currentUser || !isValidFirebaseId(auth.currentUser.uid)) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/api/users/${auth.currentUser.uid}`);
        if (res.data?.user?.username) {
          console.log('Polling found username, redirecting to home');
          clearInterval(interval); // Stop polling once we find username
          navigate('/home', { replace: true }); // Use navigate instead of window.location.replace
        }
      } catch (err) {
        console.log('Polling error:', err.message);
      }
    }, 5000); // Increase interval to 5 seconds
    return () => clearInterval(interval);
  }, [navigate]); // Add navigate dependency

  useEffect(() => {
    const checkUserAndVerification = async () => {
      // Check if user is logged in and email is verified
      const currentUser = auth.currentUser;
      const storedPendingUser = localStorage.getItem('pendingUser');

      if (!currentUser) {
        if (storedPendingUser) {
          navigate('/login', { state: { redirectTo: '/username' } });
          return;
        }
        navigate('/signup');
        return;
      }

      if (!currentUser.emailVerified) {
        navigate('/login', { state: { redirectTo: '/username' } });
        return;
      }

      if (isAdminEmail(currentUser.email)) {
        setAdminBlocked({
          email: currentUser.email,
          reason:
            'You reached the student “Choose username” step while signed in with an administrator email. That usually means the browser filled student login with admin credentials, or an old admin session was still active.',
        });
        setLoading(false);
        return;
      }

      // Already registered — skip this page
      try {
        const me = await api.get('/api/profile/me');
        if (me.data?.success && me.data?.user?.username) {
          navigate('/home', { replace: true });
          return;
        }
      } catch {
        // fall through to firebaseId lookup
      }

      // Get pending user data from localStorage
      if (storedPendingUser) {
        try {
          const userData = JSON.parse(storedPendingUser);
          setPendingUser(userData);
          
          // Fetch username suggestions
          if (userData.name) {
            try {
              const res = await api.post('/api/auth/username-suggestions', { 
                name: userData.name 
              });
              setSuggestions(res.data.suggestions || []);
            } catch (err) {
              console.error('Failed to fetch username suggestions', err);
            }
          }
        } catch (err) {
          console.error('Error parsing pending user data:', err);
        }
      } else {
        // Check if user already has username in MongoDB
        if (isValidFirebaseId(currentUser.uid)) {
          try {
            const response = await api.get(`/api/users/${currentUser.uid}`);
            if (response.data.user && response.data.user.username) {
              // User already has username, redirect to home
              console.log('User has username, redirecting to home');
              navigate('/home', { replace: true });
              return;
            } else {
              console.log('User exists but no username, staying on username page');
            }
          } catch (err) {
            console.log('User not found in MongoDB or API error:', err.message);
            // User doesn't exist in MongoDB yet, that's okay - stay on page
          }
        } else {
          console.log('Skipping /api/users call because currentUser.uid is not a valid Firebase ID');
        }
      }

      setLoading(false);
    };

    checkUserAndVerification();
  }, [navigate, user]);

  const handleNext = async (e) => {
    e.preventDefault();
    setError('');

    const uCheck = validateUsername(username);
    if (!uCheck.valid) {
      setError(uCheck.error);
      return;
    }
    const trimmedUsername = uCheck.value;

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.emailVerified) {
      setError('Please verify your email first.');
      return;
    }

    if (isAdminEmail(currentUser.email)) {
      setError('Admin accounts cannot complete student signup. Log out and use your university email.');
      return;
    }

    if (!String(currentUser.email || '').toLowerCase().endsWith('@gift.edu.pk')) {
      setError('Only @gift.edu.pk university email addresses can create an account.');
      return;
    }

    try {
      await currentUser.reload();
      const refreshedUser = auth.currentUser;
      const displayName = (refreshedUser?.displayName || '').trim();
      const nameToSend = (pendingUser?.name || pendingUser?.fullName || displayName || '').trim() || 'User';

      const userData = {
        firebaseId: currentUser.uid,
        name: nameToSend,
        email: currentUser.email,
        username: trimmedUsername,
        currentStatus: pendingUser?.currentStatus || 'student',
      };

      const response = await api.post('/api/users', userData);
      
      if (response.status === 201 || response.status === 200) {
        localStorage.removeItem('pendingUser');
        localStorage.setItem('user', JSON.stringify({ 
          email: currentUser.email,
          uid: currentUser.uid 
        }));
        window.dispatchEvent(new Event('profileUpdated'));
        try {
          new BroadcastChannel(AUTH_CHANNEL).postMessage({ type: 'username-set' });
        } catch (_) {}
        navigate('/home', { replace: true }); // Use navigate instead of window.location.replace
      }
    } catch (err) {
      console.error('Username submission error:', err);
      if (err.response?.data?.error?.includes('username') || err.response?.data?.error?.includes('duplicate') || err.response?.data?.error?.includes('taken')) {
        setError('Username already taken. Please choose another.');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    }
  };

  const handleAdminLogout = async () => {
    try {
      await signOut(auth);
    } catch (_) {}
    localStorage.removeItem('admin');
    localStorage.removeItem('pendingUser');
    navigate('/login', { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#7C3AED] border-t-transparent" />
      </div>
    );
  }

  if (adminBlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F3F4F6] px-4 py-6 sm:py-8">
        <div className="w-full max-w-lg rounded-3xl border border-amber-200/80 bg-white px-5 py-6 sm:px-6 sm:py-7 shadow-xl shadow-gray-200/50">
          <div className="flex items-center justify-center gap-2.5 mb-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] shadow-md shadow-[#7C3AED]/25">
              <span className="text-lg font-bold text-white">C</span>
            </div>
            <span className="text-lg font-bold text-[#111827] tracking-tight">CampusBuzz</span>
          </div>

          <h1 className="text-xl font-bold text-[#111827] mb-2">Wrong account for this step</h1>
          <p className="text-sm text-[#6B7280] leading-relaxed mb-4">
            This screen is only for <strong>new students</strong> who verified a{' '}
            <strong>@gift.edu.pk</strong> email and still need a username. It is not part of admin login.
          </p>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2 mb-4">
            <p>
              <strong>Signed in as:</strong> {adminBlocked.email}
            </p>
            <p>{adminBlocked.reason}</p>
            <p>
              <strong>Why the admin dashboard appeared:</strong> the student login page had an active
              administrator Firebase session, so the app treated you as admin. That path is now blocked
              on <code className="text-xs bg-amber-100 px-1 rounded">/login</code>.
            </p>
          </div>

          <ul className="text-sm text-[#374151] list-disc pl-5 space-y-1 mb-6">
            <li>Use <strong>Admin Portal</strong> (<code className="text-xs">/admin/login</code>) for dashboard access.</li>
            <li>Use <strong>student login</strong> with your university email only.</li>
            <li>Clear saved passwords for localhost if the browser keeps filling admin email here.</li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => navigate('/admin/login', { replace: true })}
              className="flex-1 rounded-xl bg-[#193965] py-2.5 text-sm font-semibold text-white hover:bg-[#0f2a52]"
            >
              Go to Admin Portal
            </button>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="flex-1 rounded-xl border border-[#7C3AED] py-2.5 text-sm font-semibold text-[#7C3AED] hover:bg-[#F5F3FF]"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F3F4F6] px-4 py-6 sm:py-8">
      <div className="w-full max-w-md rounded-3xl border border-gray-200/80 bg-white px-5 py-6 sm:px-6 sm:py-7 shadow-xl shadow-gray-200/50">
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] shadow-md shadow-[#7C3AED]/25">
            <span className="text-lg font-bold text-white">C</span>
          </div>
          <span className="text-lg font-bold text-[#111827] tracking-tight">CampusBuzz</span>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-xl font-bold text-[#111827] mb-0.5">Choose your username</h1>
            <p className="text-sm text-[#6B7280] leading-snug">
              Your email is verified. Pick a username to finish setting up your account.
            </p>
          </div>

          {suggestions.length > 0 && (
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
              <p className="text-sm font-medium text-[#111827] mb-2">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((sugg, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setUsername(sugg)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium transition-all border ${
                      username === sugg
                        ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white border-transparent shadow-sm'
                        : 'bg-white text-[#374151] border-[#E5E7EB] hover:border-[#7C3AED]/40 hover:text-[#7C3AED]'
                    }`}
                  >
                    {sugg}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleNext} className="space-y-3">
            <FormInput
              label="Username"
              type="text"
              placeholder="e.g. alex_campus"
              value={username}
              onChange={setUsername}
              icon={<AtSign size={16} />}
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-md shadow-[#7C3AED]/20"
            >
              Complete signup
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100">
            <p className="text-center text-sm text-[#6B7280]">
              Wrong account?{' '}
              <Link to="/login" className="text-[#7C3AED] font-medium hover:underline">
                Log in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
