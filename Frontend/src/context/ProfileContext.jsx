import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { isAdminEmail } from '../utils/adminUtils';
import {
  readProfileCache,
  writeProfileCache,
  clearProfileCache,
  mapDbUserToProfile,
} from '../utils/profileCache';

const ProfileContext = createContext();

function isValidFirebaseId(firebaseUid) {
  return typeof firebaseUid === 'string' && firebaseUid.trim().length >= 10 && !firebaseUid.includes('@') && !firebaseUid.includes(' ');
}

async function fetchUserByFirebaseId(firebaseUid) {
  if (!isValidFirebaseId(firebaseUid)) {
    return null;
  }
  const res = await api.get(`/api/users/${firebaseUid}`);
  return res.data?.user || null;
}

export function ProfileProvider({ children }) {
  const { user: firebaseUser, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const applyProfile = useCallback((next, firebaseUid) => {
    if (next?.username && firebaseUid) {
      writeProfileCache(firebaseUid, next);
    }
    setProfile(next);
  }, []);

  const loadFromDbOrCache = useCallback(async (uid) => {
    try {
      const dbUser = await fetchUserByFirebaseId(uid);
      const mapped = mapDbUserToProfile(dbUser);
      if (mapped?.username) {
        applyProfile(mapped, uid);
        return true;
      }
    } catch {
      // ignore
    }

    const cached = readProfileCache(uid);
    if (cached?.username) {
      setProfile(cached);
      return true;
    }

    if (profileRef.current?.username && profileRef.current?.firebaseId === uid) {
      return true;
    }

    return false;
  }, [applyProfile]);

  const isAdminFirebaseUser = useCallback(
    (user) =>
      !!user &&
      (isAdminEmail(user.email) || !isValidFirebaseId(user.uid)),
    []
  );

  const fetchProfile = useCallback(async (showLoading = true) => {
    if (!firebaseUser) {
      setProfile(null);
      clearProfileCache();
      return;
    }

    if (isAdminFirebaseUser(firebaseUser)) {
      setProfile(null);
      if (showLoading) setLoading(false);
      return;
    }

    const uid = firebaseUser.uid;
    if (showLoading) setLoading(true);

    try {
      const response = await api.get('/api/profile/me');
      if (response.data?.success && response.data?.user?.username) {
        applyProfile(response.data.user, uid);
        return;
      }

      if (response.data?.needsUsername) {
        const ok = await loadFromDbOrCache(uid);
        if (!ok) {
          setProfile(null);
          clearProfileCache();
        }
        return;
      }

      const ok = await loadFromDbOrCache(uid);
      if (!ok && !profileRef.current?.username) {
        setProfile(null);
      }
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.suspended) {
        alert(err.response?.data?.error || 'Your account has been suspended.');
        await logout();
        setProfile(null);
        clearProfileCache();
        return;
      }

      if (err.response?.status === 401) {
        setProfile(null);
        return;
      }

      const ok = await loadFromDbOrCache(uid);
      if (!ok && !profileRef.current?.username) {
        setProfile(null);
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [firebaseUser, logout, applyProfile, loadFromDbOrCache]);

  useEffect(() => {
    if (!firebaseUser) {
      setProfile(null);
      return;
    }
    const cached = readProfileCache(firebaseUser.uid);
    if (cached?.username) {
      setProfile(cached);
    }
    fetchProfile(true);
  }, [firebaseUser, fetchProfile]);

  useEffect(() => {
    const handleProfileUpdate = () => fetchProfile(false);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate);
  }, [fetchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, loading, refetchProfile: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfile = () => useContext(ProfileContext);
