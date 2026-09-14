import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

const ADMIN_SESSION_KEY = 'admin';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [verificationLink, setVerificationLink] = useState('');

  const redirectTo =
    location.state?.from?.pathname && location.state.from.pathname !== '/admin/login'
      ? location.state.from.pathname
      : '/admin-dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess(false);
    setVerificationLink('');

    try {
      const { data } = await api.post('/api/admin/login-request', {
        email: trimmedEmail,
        password,
      });

      if (data?.success) {
        setSuccess(true);
        localStorage.setItem('adminRedirectAfterVerification', redirectTo);
        if (data.verificationLink) {
          setVerificationLink(data.verificationLink);
        }
      } else {
        throw new Error(data?.error || 'Login request failed');
      }
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Invalid admin email or password.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row bg-slate-50">
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-center bg-gradient-to-br from-[#1a2b4d] via-[#12203b] to-[#0d1730] text-white p-8">
        <div className="space-y-6">
          <h1 className=" text-5xl font-extrabold">Admin Portal</h1>
        </div>
      </div>

      <div className="w-full lg:w-3/5 flex items-center justify-center px-6 py-10 lg:px-12 lg:py-12">
        <div className="w-full max-w-lg bg-white rounded-[2rem] border border-slate-200 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.2)] p-8 sm:p-10 mx-auto max-h-[calc(100vh-4rem)] overflow-hidden">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#193965] font-semibold">Admin sign in</p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold text-[#0f172a]">Welcome back.</h2>
            <p className="mt-3 text-sm text-slate-500">Authenticate with your admin email and receive a secure verification link.</p>
          </div>

          {success ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 p-6 shadow-sm">
                <p className="text-lg font-semibold text-emerald-800">
                  {verificationLink ? 'Verification link ready' : 'Verification email sent!'}
                </p>
                <p className="mt-2 text-sm text-emerald-700">
                  {verificationLink
                    ? 'Email delivery is not configured on this server, so the verification link was generated locally. Use the link below to continue.'
                    : `Check your inbox at ${email}, then click the link to access the dashboard.`}
                </p>
              </div>

              {verificationLink && (
                <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
                  <p className="font-semibold">Development link</p>
                  <a href={verificationLink} className="mt-2 block break-all text-blue-700 hover:underline">
                    {verificationLink}
                  </a>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                  setPassword('');
                }}
                className="w-full rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <>
              {location.state?.notice && (
                <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {location.state.notice}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off" data-form-type="other">
                <input
                  type="text"
                  name="fake-username"
                  autoComplete="username"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute opacity-0 h-0 w-0 pointer-events-none"
                  readOnly
                />
                <input
                  type="password"
                  name="fake-password"
                  autoComplete="current-password"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="absolute opacity-0 h-0 w-0 pointer-events-none"
                  readOnly
                />

                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="admin-login-email">
                    Admin email
                  </label>
                  <div className={`flex items-center gap-3 rounded-3xl border px-4 py-3 transition ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <UserIcon className="w-5 h-5 text-slate-400" />
                    <input
                      id="admin-login-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      placeholder="admin@gift.edu.pk"
                      className="w-full bg-transparent outline-none text-sm text-slate-900"
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="admin-login-password">
                    Password
                  </label>
                  <div className={`flex items-center gap-3 rounded-3xl border px-4 py-3 transition ${error ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <LockClosedIcon className="w-5 h-5 text-slate-400" />
                    <input
                      id="admin-login-password"
                      type="password"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      placeholder="Enter secure password"
                      className="w-full bg-transparent outline-none text-sm text-slate-900"
                      autoComplete="new-password"
                    />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center rounded-full bg-[#193965] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#13294d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Sending verification email...' : 'Send verification email'}
                </button>

                <div className="text-center text-sm text-slate-500">
                  <p>
                    After signing in, check your email for the verification link to continue to the dashboard.
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
