import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../firebase';
import api from '../../services/api';

const ADMIN_SESSION_KEY = 'admin';

/**
 * Protects admin screens: requires Firebase session + backend admin verification.
 */
export default function AdminRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState('loading'); // loading | ok | denied

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      if (!user) {
        localStorage.removeItem(ADMIN_SESSION_KEY);
        setStatus('denied');
        return;
      }

      try {
        const { data } = await api.post('/api/admin/verify-admin');
        if (cancelled) return;
        if (data?.success) {
          localStorage.setItem(
            ADMIN_SESSION_KEY,
            JSON.stringify({ email: data.admin?.email || user.email })
          );
          setStatus('ok');
        } else {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          setStatus('denied');
        }
      } catch {
        if (cancelled) return;
        localStorage.removeItem(ADMIN_SESSION_KEY);
        setStatus('denied');
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location }}
      />
    );
  }

  return children;
}
