import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import api from '../../services/api';

export default function AdminPinSetup() {
  const [mode, setMode] = useState('change'); // 'change' or 'reset'
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetNewPin, setResetNewPin] = useState('');
  const [resetConfirmPin, setResetConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);

  const handleChangeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!oldPin || !newPin || !confirmPin) {
      setError('Old PIN, new PIN, and confirmation are required.');
      return;
    }

    if (!/^\d{4,6}$/.test(newPin)) {
      setError('New PIN must be 4-6 digits.');
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post('/api/admin/pin/change', {
        oldPin,
        newPin,
        confirmPin,
      });

      if (data?.success) {
        setSuccess(data.message || 'PIN changed successfully.');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setError(data?.error || 'Failed to change PIN.');
        if (data?.error?.includes('Old PIN is incorrect')) {
          setError(data.error + ' Forgot your PIN? Request a reset via email.');
        }
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to change PIN.';
      setError(errorMsg);
      // If old PIN is incorrect, offer reset option
      if (errorMsg?.includes('Old PIN is incorrect')) {
        setError(errorMsg + ' Forgot your PIN? Request a reset via email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/api/admin/pin/request-reset');

      if (data?.success) {
        setSuccess(data.message || 'Reset code sent to your email.');
        setResetCodeSent(true);
        // Show dev code in development
        if (data.devResetCode) {
          setSuccess(`${data.message} Dev Code: ${data.devResetCode}`);
        }
      } else {
        setError(data?.error || 'Failed to request PIN reset.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to request PIN reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedResetCode = resetCode.trim().toUpperCase();
    const normalizedNewPin = resetNewPin.trim();
    const normalizedConfirmPin = resetConfirmPin.trim();

    if (!normalizedResetCode || !normalizedNewPin || !normalizedConfirmPin) {
      setError('Reset code, new PIN, and confirmation are required.');
      return;
    }

    if (normalizedResetCode.length !== 6) {
      setError('Reset code must be 6 characters.');
      return;
    }

    if (!/^\d{4,6}$/.test(normalizedNewPin)) {
      setError('New PIN must be 4-6 digits.');
      return;
    }

    if (normalizedNewPin !== normalizedConfirmPin) {
      setError('New PIN and confirmation do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post('/api/admin/pin/reset-with-code', {
        resetCode: normalizedResetCode,
        newPin: normalizedNewPin,
        confirmPin: normalizedConfirmPin,
      });

      if (data?.success) {
        setSuccess(data.message || 'PIN reset successfully.');
        setResetCode('');
        setResetNewPin('');
        setResetConfirmPin('');
        setOldPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        setError(data?.error || 'Failed to reset PIN.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to reset PIN.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {success && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-3xl border border-green-200 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-3xl">
              ✓
            </div>
            <h2 className="text-2xl font-bold text-[#0f172a]">Success</h2>
            <p className="mt-3 text-lg text-gray-600">{success}</p>
            <button
              type="button"
              onClick={() => setSuccess('')}
              className="mt-6 rounded-2xl bg-[#193965] px-6 py-3 font-semibold text-white hover:bg-[#132d4f]"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <AdminSidebar />
      <main className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-[#0f172a]">Manage Admin PIN</h1>
            <p className="text-gray-600 mt-3 text-lg">Secure your admin account with a PIN. Choose an option below:</p>
          </div>

         

          {/* FORM AREA - Only show if option selected */}
          {(mode === 'change' || mode === 'reset') && (
          <div className="bg-white rounded-3xl border-2 border-gray-300 shadow-xl p-10">
            {/* ERROR ALERT */}
            {error && (
              <div className="mb-8 rounded-2xl border-2 border-red-400 bg-red-50 px-6 py-4 text-red-900">
                <p className="font-semibold text-lg">{error}</p>
                {error?.includes('Old PIN is incorrect') && (
                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); }}
                    className="mt-4 block w-full rounded-xl bg-red-600 px-6 py-2 text-white font-bold hover:bg-red-700"
                  >
                    👉 CLICK HERE TO RESET VIA EMAIL
                  </button>
                )}
              </div>
            )}

            {/* CHANGE PIN FORM */}
            {mode === 'change' && (
                <form onSubmit={handleChangeSubmit} className="grid gap-6">
                  <h3 className="text-2xl font-bold text-[#0f172a]">Change Your PIN</h3>
                  <div className="grid gap-2">
                    <label htmlFor="oldPin" className="text-sm font-semibold text-gray-700">
                      Current PIN
                    </label>
                    <input
                      id="oldPin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter current PIN"
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="newPin" className="text-sm font-semibold text-gray-700">
                      New PIN
                    </label>
                    <input
                      id="newPin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter new PIN"
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                    />
                    <p className="text-xs text-gray-500">4-6 digits</p>
                  </div>

                  <div className="grid gap-2">
                    <label htmlFor="confirmPin" className="text-sm font-semibold text-gray-700">
                      Confirm New PIN
                    </label>
                    <input
                      id="confirmPin"
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Confirm new PIN"
                      className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full inline-flex items-center justify-center rounded-2xl bg-[#193965] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2a52] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? 'Saving PIN...' : 'Change PIN'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setMode('reset'); setError(''); setSuccess(''); }}
                    className="mt-4 w-full text-center text-sm font-semibold text-[#193965] hover:underline"
                  >
                    Forgot PIN?
                  </button>
                </form>
            )}

            {/* RESET PIN FORM */}
            {mode === 'reset' && (
                <form onSubmit={handleResetSubmit} className="grid gap-6">
                  <h3 className="text-2xl font-bold text-[#0f172a]">Reset PIN via Email</h3>
                  {!resetCodeSent ? (
                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5">
                      <div className="flex gap-3">
                        <div className="text-2xl">✉️</div>
                        <div>
                          <p className="font-semibold text-amber-900">Verification code will be sent to your email</p>
                          <p className="text-sm text-amber-800 mt-1">A 6-character code will be sent to your registered admin email address. The code expires in 10 minutes.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestReset}
                        disabled={submitting}
                        className="w-full mt-4 inline-flex items-center justify-center rounded-2xl bg-[#193965] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2a52] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? 'Sending...' : 'Send Reset Code'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                        <p className="text-sm text-green-900 font-semibold">✓ Code sent to your email!</p>
                        <p className="text-sm text-green-800 mt-1">Check your inbox for the verification code.</p>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="resetCode" className="text-sm font-semibold text-gray-700">
                          Verification Code
                        </label>
                        <input
                          id="resetCode"
                          type="text"
                          maxLength={6}
                          value={resetCode}
                          onChange={(e) => setResetCode(e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 6))}
                          placeholder="Enter 6-character code"
                          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg font-mono tracking-widest text-center focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                        />
                        {success && success.includes('Dev Code') && (
                          <div className="text-xs font-mono text-gray-500 mt-1 p-2 bg-gray-50 rounded border border-gray-200">
                            {success}
                          </div>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="resetNewPin" className="text-sm font-semibold text-gray-700">
                          New PIN
                        </label>
                        <input
                          id="resetNewPin"
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={resetNewPin}
                          onChange={(e) => setResetNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Enter new PIN"
                          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                        />
                        <p className="text-xs text-gray-500">4-6 digits</p>
                      </div>

                      <div className="grid gap-2">
                        <label htmlFor="resetConfirmPin" className="text-sm font-semibold text-gray-700">
                          Confirm New PIN
                        </label>
                        <input
                          id="resetConfirmPin"
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          value={resetConfirmPin}
                          onChange={(e) => setResetConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="Confirm new PIN"
                          className="w-full rounded-2xl border border-gray-300 px-4 py-3 text-lg focus:border-[#193965] focus:outline-none focus:ring-2 focus:ring-[#c7d8ff]"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full inline-flex items-center justify-center rounded-2xl bg-[#193965] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2a52] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {submitting ? 'Resetting PIN...' : 'Reset PIN'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResetCodeSent(false);
                          setResetCode('');
                          setSuccess('');
                        }}
                        className="text-sm text-gray-600 hover:text-gray-900 underline text-center py-2"
                      >
                        Didn't receive code? Request a new one
                      </button>
                    </>
                  )}
                </form>
            )}
          </div>
          )}

          {/* Show shortcut to change PIN if we're on reset page */}
          {mode === 'reset' && (
            <div className="mt-8 text-center">
              <p className="text-gray-600 mb-3">Or if you remember your PIN:</p>
              <button
                type="button"
                onClick={() => { setMode('change'); setError(''); }}
                className="text-lg font-bold text-[#193965] hover:underline"
              >
                Go back to change PIN
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
