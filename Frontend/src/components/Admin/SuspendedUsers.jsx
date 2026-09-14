import React, { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import AdminPinModal from './AdminPinModal';
import AdminActionReasonModal from './AdminActionReasonModal';
import {
  getAdminSuspendedUsers,
  unsuspendAdminUser,
  deleteAdminUser,
} from '../../services/api';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

const SuspendedUsers = () => {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminSuspendedUsers(debouncedSearch);
      if (data?.success) {
        setUsers(data.users || []);
        setTotal(data.total ?? data.users?.length ?? 0);
      } else {
        setError(data?.error || 'Failed to load suspended users');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load suspended users');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleUnsuspend = async (userId) => {
    setActionId(userId);
    try {
      const data = await unsuspendAdminUser(userId);
      if (data?.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unsuspend user');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (userId, username) => {
    setPendingAction({ type: 'delete', userId, username });
    setPinModalOpen(true);
  };

  const executeDelete = async (userId, pin, reason) => {
    setActionId(userId);
    try {
      const data = await deleteAdminUser(userId, pin, reason);
      if (data?.success) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setTotal((t) => Math.max(0, t - 1));
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionId(null);
    }
  };

  const handlePinVerified = async (pin) => {
    if (!pendingAction) return;
    setPendingAction((prev) => (prev ? { ...prev, pin } : prev));
    setPinModalOpen(false);
    setReasonModalOpen(true);
  };

  const handleReasonSubmit = async (reason) => {
    if (!pendingAction) return;

    const { userId, pin } = pendingAction;
    setReasonModalOpen(false);
    await executeDelete(userId, pin, reason);
    setPendingAction(null);
  };

  const closePinModal = () => {
    setPinModalOpen(false);
    setPendingAction(null);
  };

  const closeReasonModal = () => {
    setReasonModalOpen(false);
    setPendingAction(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 p-8 bg-gray-50">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#212529] mb-2">Suspended Users</h1>
            <p className="text-gray-600 text-sm">
              Accounts blocked from signing in. Search by username, email, or name.
            </p>
          </div>
          <button
            type="button"
            onClick={loadUsers}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#193965] border border-[#193965] rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="mb-4 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-xl">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suspended users…"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm text-[#212529] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#193965]/30 focus:border-[#193965]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 shrink-0">
            {loading
              ? 'Searching…'
              : debouncedSearch
                ? `${total} match${total === 1 ? '' : 'es'}`
                : `${total} suspended`}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-16">
              {debouncedSearch
                ? `No suspended users match "${debouncedSearch}".`
                : 'No suspended users right now.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#212529] uppercase tracking-wider">
                      USERNAME
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#212529] uppercase tracking-wider">
                      EMAIL
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#212529] uppercase tracking-wider">
                      SUSPENDED
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#212529] uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const busy = actionId === user.id;
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-[#212529]">
                            {user.username !== '—' ? `@${user.username}` : '—'}
                          </div>
                          {user.name && (
                            <div className="text-xs text-gray-500">{user.name}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-[#212529]">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                            {formatDate(user.suspendedAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleUnsuspend(user.id)}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
                            >
                              {busy ? '…' : 'Unsuspend'}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleDelete(user.id, user.username)}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 hover:bg-red-200 transition-colors disabled:opacity-50"
                            >
                              {busy ? '…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {pinModalOpen && (
          <AdminPinModal
            isOpen={pinModalOpen}
            onClose={closePinModal}
            onVerify={handlePinVerified}
            actionName="delete this account"
          />
        )}

        {reasonModalOpen && (
          <AdminActionReasonModal
            isOpen={reasonModalOpen}
            onClose={closeReasonModal}
            onSubmit={handleReasonSubmit}
            actionName="deleting this account"
          />
        )}
      </main>
    </div>
  );
};

export default SuspendedUsers;
