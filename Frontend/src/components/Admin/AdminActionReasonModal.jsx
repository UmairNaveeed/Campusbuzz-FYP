import React, { useState } from 'react';
import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function AdminActionReasonModal({ isOpen, onClose, onSubmit, actionName }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to submit reason.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#193965] rounded-full flex items-center justify-center text-white">
              <PencilSquareIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#0a1d37]">Reason required</h2>
              <p className="text-sm text-gray-500">Please explain why you are {actionName || 'performing this action'}.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              setReason('');
              setError('');
            }}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2" htmlFor="admin-action-reason">
              Reason *
            </label>
            <textarea
              id="admin-action-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#193965] focus:border-transparent text-sm"
              placeholder="Describe why you're suspending or deleting this user."
            />
            <p className="text-xs text-gray-500 mt-2">
              This message will be emailed to the student if their address is @gift.edu.pk.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                setReason('');
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
              {submitting ? 'Sending...' : 'Send reason'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
