import React, { useState } from 'react';
import { LockClosedIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';

export default function AdminPinModal({ isOpen, onClose, onVerify, actionName }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!pin) {
      setError('PIN is required.');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits.');
      return;
    }

    setSubmitting(true);

    try {
      const { data } = await api.post('/api/admin/pin/verify', { pin });

      if (data?.success) {
        onVerify(pin);
        setPin('');
        setError('');
      } else {
        setError(data?.error || 'PIN verification failed.');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'PIN verification failed.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#193965] rounded-full flex items-center justify-center">
              <LockClosedIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-[#0a1d37]">PIN Required</h2>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setPin('');
              setError('');
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <p className="text-gray-600 mb-6">
          Enter your PIN to {actionName || 'perform this action'}.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="pin" className="block text-sm font-bold text-gray-700 mb-2">
              PIN *
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setPin(value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#193965] focus:border-transparent outline-none text-center text-2xl tracking-widest"
              placeholder="••••••"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                setPin('');
                setError('');
              }}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#193965] text-white font-semibold py-3 rounded-lg hover:bg-[#0f2a52] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {submitting ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
