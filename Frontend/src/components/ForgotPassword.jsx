import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import FormInput from './FormInput';
import AuthLeftPanel from './AuthLeftPanel';
import { Mail, ArrowLeft, X } from 'lucide-react';

export default function ForgotPassword({ asModal, onClose }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setErrors({ email: 'Please enter your email.' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok || !data.exists) {
        setErrors({ email: 'This email is not registered.' });
        return;
      }

      const actionCodeSettings = {
        url: `${window.location.origin}/auth/action`,
        handleCodeInApp: true,
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);

      navigate('/login', { state: { resetLinkSent: 'Reset link has been sent to your email. Check your inbox.' } });
    } catch (err) {
      console.error('Forgot password error:', err);

      if (err.code === 'auth/user-not-found') {
        setErrors({ email: 'This email is not registered.' });
      } else if (err.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address.' });
      } else {
        setErrors({ email: 'Server error. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className={asModal ? 'bg-white rounded-2xl shadow-xl p-8' : 'w-full max-w-md my-auto py-8'}>
      {asModal && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#6B7280] hover:text-[#111827] p-1 rounded-lg hover:bg-[#F3F4F6] transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      )}
      {!asModal && (
        <>
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] mb-3">
              <span className="text-xl font-bold text-white">C</span>
            </div>
            <span className="text-xl font-bold text-[#111827]">CampusBuzz</span>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#7C3AED] mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </>
      )}
      <h1 className="text-2xl font-bold text-[#111827] mb-1">Forgot Password</h1>
      <p className="text-sm text-[#6B7280] mb-6">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <FormInput
          label="Email"
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(v) => { setEmail(v); setErrors({}); }}
          error={errors.email}
          icon={<Mail size={16} />}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6B7280]">
        Remember your password?{' '}
        <Link to="/login" className="text-[#7C3AED] font-medium hover:underline">
        Log in
      </Link>
      </p>
    </div>
  );

  if (asModal) {
    return <div className="relative">{content}</div>;
  }

  return (
    <div className="min-h-screen h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      <div className="w-full lg:w-1/2 xl:w-[45%] min-h-screen lg:min-h-0 lg:h-full flex items-center justify-center p-6 sm:p-8 overflow-y-auto flex-1">
        {content}
      </div>
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen lg:min-h-0 lg:h-full flex-shrink-0">
        <AuthLeftPanel />
      </div>
    </div>
  );
}
