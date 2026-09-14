import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { isAdminEmail } from '../utils/adminUtils';
import api from '../services/api';
import { readProfileCache } from '../utils/profileCache';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const location = useLocation();
  const [fallbackUsername, setFallbackUsername] = useState(null);

  const cachedUsername = user ? readProfileCache(user.uid)?.username : null;

  const isValidFirebaseId = (uid) => typeof uid === 'string' && uid.trim().length >= 10 && !uid.includes('@') && !uid.includes(' ');

  useEffect(() => {
    if (!user || isAdminEmail(user.email) || profile?.username || !isValidFirebaseId(user.uid)) {
      if (profile?.username) setFallbackUsername(profile.username);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/api/users/${user.uid}`);
        if (cancelled) return;
        setFallbackUsername(res.data?.user?.username || '');
      } catch {
        if (!cancelled) setFallbackUsername('');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, profile?.username]);

  const hasUsername = Boolean(profile?.username || fallbackUsername || cachedUsername);
  const checkingProfile =
    profileLoading && !hasUsername && fallbackUsername === null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdminEmail(user.email)) {
    const hasAdminPortalSession = Boolean(localStorage.getItem('admin'));
    if (hasAdminPortalSession) {
      return <Navigate to="/admin-dashboard" replace />;
    }
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{
          notice:
            'Administrator accounts must sign in through the Admin Portal, not the student app.',
        }}
      />
    );
  }

  if (!user.emailVerified) {
    return <Navigate to="/signup" replace />;
  }

  if (checkingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
      </div>
    );
  }

  if (!hasUsername) {
    return <Navigate to="/username" replace />;
  }

  return children;
};

export default PrivateRoute;
