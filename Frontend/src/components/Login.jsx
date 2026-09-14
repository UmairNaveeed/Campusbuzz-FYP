import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, setPersistence, signOut } from 'firebase/auth';
import { auth, browserLocalPersistence, browserSessionPersistence } from '../firebase';
import FormInput from './FormInput';
import AuthLeftPanel from './AuthLeftPanel';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resolveUsernameToEmail, checkAccountStatus } from '../services/api';
import { isAdminEmail } from '../utils/adminUtils';
import { mapLoginAuthError, isCredentialFailure } from '../utils/authErrors';

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Student login must never keep an admin Firebase session (prevents dashboard leak via autofill / remember me)
  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdminEmail(user.email)) return;

    let cancelled = false;
    (async () => {
      try {
        await signOut(auth);
      } catch (_) {}
      if (!cancelled) {
        localStorage.removeItem('admin');
        setEmailOrUsername('');
        setPassword('');
        setErrors({
          emailOrUsername:
            'An administrator session was cleared. Use Admin Portal (/admin/login) for admin access, or sign in here with your @gift.edu.pk student account.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || isAdminEmail(user.email)) return;

    if (!user.emailVerified) {
      let cancelled = false;
      (async () => {
        try {
          await signOut(auth);
        } catch (_) {}
        if (!cancelled) {
          localStorage.removeItem('admin');
        }
      })();
      return;
    }

    const fromPath = location.state?.from?.pathname;
    const redirectTo =
      fromPath && fromPath.startsWith('/') && fromPath !== '/login' && !fromPath.startsWith('/admin')
        ? fromPath
        : location.state?.redirectTo &&
            location.state.redirectTo.startsWith('/') &&
            location.state.redirectTo !== '/login' &&
            !location.state.redirectTo.startsWith('/admin')
          ? location.state.redirectTo
          : '/home';
    navigate(redirectTo, { replace: true });
  }, [user, authLoading, navigate, location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    const trimmed = emailOrUsername.trim();
    const trimmedPassword = password.trim();
    if (!trimmed) errs.emailOrUsername = 'Enter your email or username';
    if (!trimmedPassword) errs.password = 'Enter your password';
    else if (trimmedPassword.length < 6) errs.password = 'Password must be at least 6 characters';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setErrors({});

    let loginEmail = trimmed;
    let loginUsername = null;
    const looksLikeEmail = trimmed.includes('@') && trimmed.includes('.');

    try {
      if (looksLikeEmail && isAdminEmail(trimmed.toLowerCase())) {
        setErrors({
          emailOrUsername:
            'Administrator email cannot be used on the student login page. Use /admin/login instead.',
        });
        return;
      }

      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      localStorage.removeItem('admin');

      if (!looksLikeEmail) {
        loginUsername = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        const { email } = await resolveUsernameToEmail(loginUsername);
        if (!email) throw new Error('Username not found');
        loginEmail = email;
      } else {
        loginEmail = trimmed.toLowerCase();
      }

      if (isAdminEmail(loginEmail)) {
        setErrors({
          emailOrUsername:
            'Administrator email cannot be used on the student login page. Use /admin/login instead.',
        });
        return;
      }

      const ensureNotSuspended = async () => {
        await checkAccountStatus({ email: loginEmail, username: loginUsername });
      };

      if (!isAdminEmail(loginEmail)) {
        try {
          await signOut(auth);
        } catch (_) {}
        await ensureNotSuspended();
      }

      const credential = await signInWithEmailAndPassword(auth, loginEmail, trimmedPassword);
      const signedInEmail = credential.user?.email || loginEmail;

      if (isAdminEmail(signedInEmail)) {
        await signOut(auth);
        localStorage.removeItem('admin');
        setEmailOrUsername('');
        setPassword('');
        setErrors({
          emailOrUsername:
            'This email is for administrators only. Open Admin Portal at /admin/login — do not use the student login page.',
        });
        return;
      }

      window.dispatchEvent(new Event('profileUpdated'));

      const fromPath = location.state?.from?.pathname;
      const redirectTo = (fromPath && fromPath.startsWith('/') && fromPath !== '/login' && !fromPath.startsWith('/admin'))
        ? fromPath
        : (location.state?.redirectTo && location.state.redirectTo.startsWith('/') && location.state.redirectTo !== '/login' && !location.state.redirectTo.startsWith('/admin'))
          ? location.state.redirectTo
          : '/home';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (!isAdminEmail(loginEmail) && isCredentialFailure(err)) {
        try {
          await checkAccountStatus({ email: loginEmail, username: loginUsername });
        } catch (statusErr) {
          setErrors(mapLoginAuthError(statusErr));
          return;
        }
      }
      setErrors(mapLoginAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#7C3AED] border-t-transparent" />
      </div>
    );
  }

  if (user && !isAdminEmail(user.email)) return null;

  return (
    <div className="min-h-screen h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left: Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] min-h-screen lg:min-h-0 lg:h-full flex items-center justify-center p-6 sm:p-8 overflow-y-auto flex-1">
        <div className="w-full max-w-md my-auto py-8">
          {/* Logo on mobile */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] mb-3">
              <span className="text-xl font-bold text-white">C</span>
            </div>
            <span className="text-xl font-bold text-[#111827]">CampusBuzz</span>
          </div>

          <h1 className="text-2xl font-bold text-[#111827] mb-1">Log into CampusBuzz</h1>
          <p className="text-sm text-[#6B7280] mb-6">Welcome back. Sign in to continue.</p>

          {location.state?.resetLinkSent && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {location.state.resetLinkSent}
            </div>
          )}
          {location.state?.passwordResetSuccess && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              {location.state.passwordResetSuccess}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="relative space-y-4"
            autoComplete="off"
            data-form-type="other"
          >
            <input
              type="text"
              name="fake-student-username"
              autoComplete="username"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 h-0 w-0 pointer-events-none"
              readOnly
            />
            <input
              type="password"
              name="fake-student-password"
              autoComplete="current-password"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 h-0 w-0 pointer-events-none"
              readOnly
            />
            <FormInput
              id="student-login-identifier"
              name="student-login-identifier"
              label="Email or Username"
              type="text"
              placeholder="Enter username or @gift.edu.pk email"
              value={emailOrUsername}
              onChange={setEmailOrUsername}
              error={errors.emailOrUsername}
              icon={<Mail size={16} />}
              autoComplete="off"
              inputProps={{
                autoCorrect: 'off',
                autoCapitalize: 'none',
                spellCheck: false,
                'data-lpignore': 'true',
                'data-1p-ignore': 'true',
              }}
            />

            <div className="relative">
              <FormInput
                id="student-login-password"
                name="student-login-password"
                label="Password"
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={setPassword}
                error={errors.password}
                icon={<Lock size={16} />}
                autoComplete="new-password"
                inputProps={{
                  'data-lpignore': 'true',
                  'data-1p-ignore': 'true',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-9 text-[#6B7280] hover:text-[#111827]"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-[#D1D5DB] accent-[#7C3AED]"
                />
                <span className="text-[#6B7280]">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-[#7C3AED] hover:underline font-medium">Forgot password?</Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Log in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6B7280]">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-[#7C3AED] font-medium hover:underline">Create new account</Link>
          </p>
        </div>
      </div>

      {/* Right: Design / branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen lg:min-h-0 lg:h-full flex-shrink-0">
        <AuthLeftPanel />
      </div>
    </div>
  );
}
