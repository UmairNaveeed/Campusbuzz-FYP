import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth } from '../firebase';
import { applyActionCode, onAuthStateChanged } from 'firebase/auth';

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, pending
  const [message, setMessage] = useState('Verifying your email...');
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const verifyEmail = async () => {
      try {
        const oobCode = searchParams.get('oobCode');
        const mode = searchParams.get('mode');

        if (!oobCode || mode !== 'verifyEmail') {
          navigate('/username', { replace: true });
          return;
        }

        // Apply the email verification code (marks email as verified on Firebase)
        await applyActionCode(auth, oobCode);

        // Wait for Firebase to restore auth state so currentUser is set (same browser)
        const user = await new Promise((resolve) => {
          let resolved = false;
          const unsub = onAuthStateChanged(auth, (u) => {
            if (resolved) return;
            resolved = true;
            unsub();
            resolve(u || null);
          });
          setTimeout(() => {
            if (resolved) return;
            resolved = true;
            unsub();
            resolve(auth.currentUser || null);
          }, 5000);
        });

        if (!user) {
          navigate('/username', { replace: true });
          return;
        }

        await user.reload();
        if (!user.emailVerified) {
          setStatus('error');
          setMessage('Verification failed. Please try again.');
          return;
        }

        const nameFromUrl = searchParams.get('name');
        let nameFromHash = '';
        try {
          const hash = (window.location.hash || '').slice(1);
          if (hash) nameFromHash = (new URLSearchParams(hash).get('name') || '').trim();
          if (nameFromHash) nameFromHash = decodeURIComponent(nameFromHash).trim();
        } catch (_) {}
        const decodedName = (nameFromUrl ? decodeURIComponent(nameFromUrl).trim() : '') || nameFromHash;
        let nameFromSession = '';
        try {
          if (user.email) nameFromSession = sessionStorage.getItem(`pendingSignupName_${user.email}`) || '';
        } catch (_) {}
        const pendingUser = localStorage.getItem('pendingUser');
        let pendingData = { firebaseId: user.uid, email: user.email };
        if (pendingUser) {
          try {
            pendingData = { ...JSON.parse(pendingUser), firebaseId: user.uid, email: user.email };
          } catch (_) {}
        }
        const fullName = [nameFromSession, decodedName, pendingData.name, pendingData.fullName, (user.displayName || '').trim()].find(
          (v) => typeof v === 'string' && v.trim()
        );
        const nameToSave = (fullName && fullName.trim()) ? fullName.trim() : 'User';

        localStorage.setItem('pendingUser', JSON.stringify({
          ...pendingData,
          firebaseId: user.uid,
          name: nameToSave,
          email: user.email,
        }));
        try {
          if (user.email) sessionStorage.removeItem(`pendingSignupName_${user.email}`);
        } catch (_) {}
        // Navigate to login since this is the verification tab
        window.location.replace('/login');
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage(error.message || 'Verification failed. Please try again.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md p-10 bg-white rounded-3xl shadow-2xl border border-gray-100 text-center">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#0a1d37] mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-[#0a1d37] mb-2">Verifying email…</h2>
            <p className="text-gray-600 mb-4">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-600 mb-2">Verification issue</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <button
              onClick={() => navigate('/username', { replace: true })}
              className="w-full mb-3 py-3 px-4 rounded-xl bg-[#0a1d37] text-white font-semibold hover:bg-[#07132a] transition"
            >
              Go to username page
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-[#6B7280] text-sm hover:underline"
            >
              Go to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
