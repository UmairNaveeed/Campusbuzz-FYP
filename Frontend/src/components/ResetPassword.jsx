import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase';
import FormInput from './FormInput';
import AuthLeftPanel from './AuthLeftPanel';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { validatePasswordStrength } from '../lib/utils';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  // Redirect verification email links to the correct page (not password reset)
  useEffect(() => {
    if (mode === 'verifyEmail' && oobCode) {
      const params = new URLSearchParams();
      params.set('mode', 'verifyEmail');
      params.set('oobCode', oobCode);
      navigate(`/verify-email?${params.toString()}`, { replace: true });
    }
  }, [mode, oobCode, navigate]);

  // Landed here with no valid reset code = user already changed password (e.g. in Firebase flow) → go to login
  useEffect(() => {
    if (mode === 'verifyEmail') return;
    if (!oobCode || mode !== 'resetPassword') {
      window.location.replace('/login');
    }
  }, [oobCode, mode]);

  // Don't show reset password page at all when we're redirecting to login (no flash)
  const shouldRedirectToLogin = mode !== 'verifyEmail' && (!oobCode || mode !== 'resetPassword');
  if (shouldRedirectToLogin) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (mode === 'verifyEmail') {
      const params = new URLSearchParams();
      params.set('mode', 'verifyEmail');
      params.set('oobCode', oobCode);
      navigate(`/verify-email?${params.toString()}`, { replace: true });
      return;
    }

    if (!oobCode) {
      setErrors({ form: 'Invalid or expired reset link.' });
      return;
    }

    if (mode && mode !== 'resetPassword') {
      setErrors({ form: 'Invalid link type. This page is for password reset only.' });
      return;
    }

    // Same validation as SignUp
    const policyError = validatePasswordStrength(newPassword);
    if (policyError) {
      setErrors({ password: policyError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    try {
      setLoading(true);
      await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, newPassword);
      navigate('/login', { state: { passwordResetSuccess: 'Your password has been reset successfully. You can now log in with your new password.' }, replace: true });
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/expired-action-code' || code === 'auth/invalid-action-code') {
        setErrors({ form: 'Reset link is invalid or has expired. Taking you to login...' });
        window.location.replace('/login');
        return;
      } else {
        setErrors({ form: err?.message || 'Failed to reset password.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left: Image / branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen lg:min-h-0 lg:h-full flex-shrink-0">
        <AuthLeftPanel />
      </div>

      {/* Right: Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] min-h-screen lg:min-h-0 lg:h-full flex items-center justify-center p-6 sm:p-8 overflow-hidden flex-1">
        <div className="w-full max-w-md">
          {/* Logo on mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] mb-3">
              <span className="text-xl font-bold text-white">C</span>
            </div>
            <span className="text-xl font-bold text-[#111827]">CampusBuzz</span>
          </div>

          <h1 className="text-2xl font-bold text-[#111827] mb-2">Reset Password</h1>
          <p className="text-sm text-[#6B7280] mb-6">
            Enter your new password. Use the same rules as when creating an account.
          </p>

          {errors.form && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-600 text-sm rounded-xl px-4 py-3">
              {errors.form}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <FormInput
                label="New password"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(v) => setNewPassword(v)}
                error={errors.password}
                icon={<Lock size={16} />}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-9 text-[#6B7280] hover:text-[#111827]"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <FormInput
                label="Confirm new password"
                type={showConfirmPass ? 'text' : 'password'}
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(v) => setConfirmPassword(v)}
                error={errors.confirmPassword}
                icon={<Lock size={16} />}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-9 text-[#6B7280] hover:text-[#111827]"
                aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
              >
                {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6B7280]">
            Remember your password? <Link to="/login" className="text-[#7C3AED] font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
