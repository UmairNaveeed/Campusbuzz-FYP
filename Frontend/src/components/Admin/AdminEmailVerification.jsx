import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { auth } from '../../firebase';
import api from '../../services/api';

const ADMIN_SESSION_KEY = 'admin';

export default function AdminEmailVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link. No token provided.');
        return;
      }

      try {
        const { data } = await api.post('/api/admin/verify-email-token', { token });
        
        if (data?.success && data?.customToken) {
          setEmail(data.email);
          
          // Sign in with Firebase using custom token
          try {
            await signInWithCustomToken(auth, data.customToken);
            
            const verifyResponse = await api.post('/api/admin/verify-admin');
            if (!verifyResponse?.data?.success) {
              throw new Error('Admin verification failed after sign-in.');
            }

            localStorage.setItem(
              ADMIN_SESSION_KEY,
              JSON.stringify({ email: data.email, verified: true })
            );
            
            setStatus('success');
            setMessage('Email verified successfully! Redirecting to dashboard...');
          } catch (firebaseErr) {
            console.error('Firebase/admin verification error:', firebaseErr);
            setStatus('error');
            setMessage('Email verified but could not sign in. Please try again.');
          }
        } else {
          setStatus('error');
          setMessage(data?.error || 'Verification failed.');
        }
      } catch (err) {
        setStatus('error');
        setMessage(
          err.response?.data?.error || 
          err.message || 
          'Verification failed. The link may be expired or invalid.'
        );
      }
    };

    verifyEmail();
  }, [searchParams, navigate]);

  useEffect(() => {
    if (status === 'success') {
      const redirectPath =
        localStorage.getItem('adminRedirectAfterVerification') || '/admin-dashboard';
      localStorage.removeItem('adminRedirectAfterVerification');

      const timer = setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a2b4d] via-[#12203b] to-[#0d1730] p-6">
      <div className="w-full max-w-md p-1 rounded-[2rem] bg-gradient-to-br from-[#3b6bb1] via-[#2a4b8b] to-[#18305f] shadow-2xl">
        <div className="bg-white rounded-[1.75rem] p-8 shadow-2xl">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="mx-auto w-16 h-16 border-4 border-[#193965] border-t-transparent rounded-full animate-spin mb-4" />
                <h1 className="text-2xl font-bold text-[#0a1d37] mb-2">Verifying Email...</h1>
                <p className="text-gray-600">Please wait while we verify your email.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircleIcon className="w-8 h-8 text-emerald-700" />
                </div>
                <h1 className="text-2xl font-bold text-[#0a1d37] mb-2">Email Verified!</h1>
                <p className="text-gray-600 mb-4">{message}</p>
                {email && (
                  <p className="text-sm text-gray-500">
                    Signed in as: <span className="font-semibold text-[#0f172a]">{email}</span>
                  </p>
                )}
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <XCircleIcon className="w-8 h-8 text-red-600" />
                </div>
                <h1 className="text-2xl font-bold text-[#0a1d37] mb-2">Verification Failed</h1>
                <p className="text-gray-600 mb-6">{message}</p>
                <button
                  onClick={() => navigate('/admin/login')}
                  className="bg-[#193965] text-white font-semibold py-3 px-6 rounded-lg hover:bg-[#0f2a52] transition-colors"
                >
                  Back to Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
