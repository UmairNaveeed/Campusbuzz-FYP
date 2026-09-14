import React, { useState } from 'react';
import { X } from 'lucide-react';
import { reportPost } from '../services/api';

const REASONS = [
  { value: 'hate_speech', label: 'Hate Speech' },
  { value: 'inappropriate_content', label: 'Inappropriate Content' },
];

export default function ReportPostModal({ postId, onClose, onSuccess }) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Please select a reason.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const data = await reportPost(postId, reason, description.trim());
      if (data?.success) {
        onSuccess?.();
        onClose();
        return;
      } else {
        setError(data?.error || 'Failed to submit report');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-[#111827]">Report post</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Report posts only for hate speech or inappropriate content. Reports are reviewed by administrators.
        </p>

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
              required
            >
              <option value="">Select a reason</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#111827] mb-1">
              Details (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30"
              rows={3}
              placeholder="Add any extra context for moderators…"
              maxLength={500}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-full text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
