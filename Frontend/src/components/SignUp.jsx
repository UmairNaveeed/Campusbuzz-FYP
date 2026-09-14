import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification, onAuthStateChanged, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../firebase';
import FormInput from './FormInput';
import AuthLeftPanel from './AuthLeftPanel';
import { Eye, EyeOff, Mail, Lock, User, MailCheck, FileText, GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validatePasswordStrength } from '../lib/utils';

const GIFT_EMAIL_SUFFIX = '@gift.edu.pk';

/** Student email must be 9 or 11-digit roll number + @gift.edu.pk */
function isValidGiftStudentEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim().toLowerCase();
  return /^\d{9}@gift\.edu\.pk$/.test(trimmed) || /^\d{11}@gift\.edu\.pk$/.test(trimmed);
}

export default function SignUp() {
  const { user, loading: authLoading } = useAuth();
  const [signupMode, setSignupMode] = useState('student'); // 'student' | 'alumni'
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [alumniForm, setAlumniForm] = useState({ name: '', email: '' });
  const [transcriptFile, setTranscriptFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [waitingForVerification, setWaitingForVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [alumniSubmitted, setAlumniSubmitted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (user && user.emailVerified) navigate('/username', { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!waitingForVerification || !user) return;
    if (user.emailVerified) navigate('/username', { replace: true });
  }, [waitingForVerification, user, navigate]);

  const formRef = useRef({ name: '', email: '' });
  formRef.current = { name: form.name, email: form.email };

  useEffect(() => {
    if (!waitingForVerification) return;
    const doVerifyAndNavigate = async (u) => {
      try {
        await u.reload();
        if (!auth.currentUser?.emailVerified) return;
        const { name } = formRef.current;
        const nameToSave = (name || '').trim() || 'User';
        localStorage.setItem('pendingUser', JSON.stringify({
          firebaseId: u.uid,
          name: nameToSave,
          email: u.email,
          currentStatus: 'student',
        }));
        window.location.replace('/username');
      } catch (_) {}
    };
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u?.emailVerified) await doVerifyAndNavigate(u);
    });
    const interval = setInterval(async () => {
      const u = auth.currentUser;
      if (!u) return;
      try {
        await u.reload();
        if (auth.currentUser?.emailVerified) await doVerifyAndNavigate(auth.currentUser);
      } catch (_) {}
    }, 2000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [waitingForVerification, navigate]);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const updateAlumni = (key, val) => setAlumniForm((f) => ({ ...f, [key]: val }));

  const handleAlumniSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!alumniForm.name.trim()) errs.name = 'Name is required';
    if (!alumniForm.email.trim()) errs.email = 'Email is required';
    else if (!alumniForm.email.includes('@')) errs.email = 'Enter a valid email address';
    if (!transcriptFile) errs.transcript = 'Please upload your transcript for verification';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    setErrors({});
    try {
      const fd = new FormData();
      fd.append('name', alumniForm.name.trim());
      fd.append('alumniEmail', alumniForm.email.trim().toLowerCase());
      fd.append('transcript', transcriptFile);

      const res = await fetch('/api/auth/signup/alumni', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors({ form: data.error || 'Alumni signup failed. Please try again.' });
        return;
      }
      setAlumniSubmitted(true);
    } catch (err) {
      setErrors({ form: err?.message || 'Alumni signup failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};

    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!form.email.includes('@')) errs.email = 'Enter a valid university email';
    const emailTrimmed = form.email.trim().toLowerCase();
    if (!emailTrimmed.endsWith(GIFT_EMAIL_SUFFIX)) {
      errs.email = 'Only @gift.edu.pk university email addresses can sign up.';
    } else if (!isValidGiftStudentEmail(form.email.trim())) {
      errs.email = 'Use your 9 or 11-digit roll number, e.g. 251370001@gift.edu.pk or 25101960001@gift.edu.pk';
    }

    const passwordError = validatePasswordStrength(form.password);
    if (passwordError) errs.password = passwordError;
    else if (form.password !== form.confirmPassword) errs.confirmPassword = "Passwords don't match";

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const trimmedEmail = form.email.trim().toLowerCase();
    if (!isValidGiftStudentEmail(trimmedEmail)) {
      setErrors({ email: 'Use your 9 or 11-digit roll number, e.g. 251370001@gift.edu.pk or 25101960001@gift.edu.pk' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      const validateRes = await fetch('/api/auth/validate-roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      let validateData = { valid: false, error: 'Could not verify roll number.' };
      try {
        validateData = await validateRes.json();
      } catch (_) {}
      if (!validateRes.ok || !validateData.valid) {
        setErrors({ email: validateData.error || 'Invalid roll number. Try again.' });
        setLoading(false);
        return;
      }
      const methods = await fetchSignInMethodsForEmail(auth, trimmedEmail);
      if (methods && methods.length > 0) {
        setErrors({ email: 'This email is already registered. Try logging in.' });
        setLoading(false);
        return;
      }
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, form.password);
      if (userCredential?.user && form.name.trim()) {
        await updateProfile(userCredential.user, { displayName: form.name.trim() });
      }
      const trimmedNameForUrl = form.name.trim();
      const nameEnc = encodeURIComponent(trimmedNameForUrl);
      const continueUrl = `${window.location.origin}/verify-email?name=${nameEnc}#name=${nameEnc}`;
      await sendEmailVerification(userCredential.user, {
        url: continueUrl,
        handleCodeInApp: true,
      });
      const trimmedName = form.name.trim();
      localStorage.setItem('pendingUser', JSON.stringify({
        name: trimmedName,
        fullName: trimmedName,
        email: trimmedEmail,
      }));
      try {
        sessionStorage.setItem(`pendingSignupName_${trimmedEmail}`, trimmedName);
      } catch (_) {}
      setVerificationEmail(trimmedEmail);
      setErrors({});
      setWaitingForVerification(true);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered. Try logging in.' });
      } else if (code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address.' });
      } else if (code === 'auth/weak-password') {
        setErrors({ password: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
      } else {
        setErrors({ email: err?.message || 'Registration failed. Please try again.' });
      }
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

  if (user && user.emailVerified) return null;

  if (waitingForVerification) {
    return (
      <div className="min-h-screen h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
        <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] min-h-screen lg:min-h-0 lg:h-full flex-shrink-0">
          <AuthLeftPanel />
        </div>
        <div className="w-full lg:w-1/2 xl:w-[45%] min-h-screen lg:min-h-0 lg:h-full flex items-center justify-center p-6 sm:p-8 overflow-hidden flex-1">
          <div className="w-full max-w-md text-center">
            <div className="lg:hidden text-center mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] mb-3">
                <span className="text-xl font-bold text-white">C</span>
              </div>
              <span className="text-xl font-bold text-[#111827]">CampusBuzz</span>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#7C3AED]/10 flex items-center justify-center mx-auto mb-6">
              <MailCheck className="w-8 h-8 text-[#7C3AED]" />
            </div>
            <h1 className="text-2xl font-bold text-[#111827] mb-2">Verification link sent</h1>
            <p className="text-[#6B7280] mb-4">
              We&apos;ve sent a verification link to <strong className="text-[#111827]">{verificationEmail}</strong>
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-[#6B7280]">
              <span className="inline-block w-2 h-2 rounded-full bg-[#7C3AED] animate-pulse" />
              Waiting for verification…
            </div>
          </div>
        </div>
      </div>
    );
  }

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

          <h1 className="text-2xl font-bold text-[#111827] mb-4">Create account</h1>

          {/* Student / Alumni toggle */}
          <div className="flex rounded-xl bg-[#F3F4F6] p-1 mb-6">
            <button
              type="button"
              onClick={() => { setSignupMode('student'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${signupMode === 'student' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              <User size={18} />
              Student
            </button>
            <button
              type="button"
              onClick={() => { setSignupMode('alumni'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${signupMode === 'alumni' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
            >
              <GraduationCap size={18} />
              Alumni
            </button>
          </div>

          {alumniSubmitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <MailCheck className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-emerald-800 mb-1">Signup submitted</h2>
              <p className="text-sm text-emerald-700 mb-4">
                Your alumni signup is pending approval. We&apos;ll notify you at <strong>{alumniForm.email}</strong> when approved.
              </p>
              <Link to="/login" className="text-[#7C3AED] font-medium hover:underline text-sm">Back to login</Link>
            </div>
          ) : signupMode === 'alumni' ? (
            <form onSubmit={handleAlumniSubmit} className="space-y-4">
              {errors.form && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                  {errors.form}
                </div>
              )}
              <FormInput
                label="Name"
                placeholder="Enter your full name"
                value={alumniForm.name}
                onChange={(v) => updateAlumni('name', v)}
                error={errors.name}
                icon={<User size={16} />}
              />
              <FormInput
                label="Email"
                type="email"
                placeholder="your.email@example.com"
                value={alumniForm.email}
                onChange={(v) => updateAlumni('email', v)}
                error={errors.email}
                icon={<Mail size={16} />}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-[#111827]">Transcript</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                  onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-[#D8D8D8] bg-[#ECECEF] px-4 py-2.5 text-sm text-[#2F3348] file:mr-4 file:rounded-lg file:border-0 file:bg-[#7C3AED] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:cursor-pointer hover:file:bg-[#6D28D9]"
                />
                {transcriptFile && (
                  <p className="text-xs text-[#6B7280] flex items-center gap-1">
                    <FileText size={14} /> {transcriptFile.name}
                  </p>
                )}
                <p className="text-xs text-[#6B7280]">Upload your academic transcript for verification</p>
                {errors.transcript && <p className="text-xs text-red-600">{errors.transcript}</p>}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit for approval'}
              </button>
            </form>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormInput
              label="Name"
              placeholder="Enter Name"
              value={form.name}
              onChange={(v) => update('name', v)}
              error={errors.name}
              icon={<User size={16} />}
            />
            <FormInput
              label="Email"
              type="email"
              placeholder="251370001@gift.edu.pk"
              value={form.email}
              onChange={(v) => update('email', v)}
              error={errors.email}
              icon={<Mail size={16} />}
            />

            <div className="relative">
                  <FormInput
                    label="Password"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Create new password"
                    value={form.password}
                    onChange={(v) => update('password', v)}
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
                    label="Confirm Password"
                    type={showConfirmPass ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChange={(v) => update('confirmPassword', v)}
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
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          )}

          {!alumniSubmitted && (
            <p className="mt-6 text-center text-sm text-[#6B7280]">
              Already have an account? <Link to="/login" className="text-[#7C3AED] font-medium hover:underline">Log in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
