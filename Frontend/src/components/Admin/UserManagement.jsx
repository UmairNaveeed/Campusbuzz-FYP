import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import AdminPinModal from './AdminPinModal';
import AdminActionReasonModal from './AdminActionReasonModal';
import {
  getAdminUsers,
  getAdminUserDetail,
  suspendAdminUser,
  unsuspendAdminUser,
  deleteAdminUser,
} from '../../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailUserId, setDetailUserId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailError, setDetailError] = useState('');

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      const username = String(user.username || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const name = String(user.name || '').toLowerCase();
      const status = String(user.status || '').toLowerCase();
      return (
        username.includes(q) ||
        email.includes(q) ||
        name.includes(q) ||
        status.includes(q) ||
        (username !== '—' && `@${username}`.includes(q))
      );
    });
  }, [users, searchQuery]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminUsers();
      if (data?.success) {
        setUsers(data.users || []);
      } else {
        setError(data?.error || 'Failed to load users');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSuspend = async (userId) => {
    setPendingAction({ type: 'suspend', userId });
    setPinModalOpen(true);
  };

  const executeSuspend = async (userId, pin, reason) => {
    setActionId(userId);
    try {
      const data = await suspendAdminUser(userId, pin, reason);
      if (data?.success && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: 'Suspended', accountStatus: 'suspended' } : u))
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to suspend user');
    } finally {
      setActionId(null);
    }
  };

  const handleUnsuspend = async (userId) => {
    setActionId(userId);
    try {
      const data = await unsuspendAdminUser(userId);
      if (data?.success && data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: 'Active', accountStatus: 'active' } : u))
        );
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to unsuspend user');
    } finally {
      setActionId(null);
    }
  };

  const openUserDetail = async (userId) => {
    setDetailUserId(userId);
    setDetailLoading(true);
    setDetailError('');
    setDetailData(null);
    try {
      const data = await getAdminUserDetail(userId);
      if (data?.success) {
        setDetailData(data);
      } else {
        setDetailError(data?.error || 'Failed to load user');
      }
    } catch (err) {
      setDetailError(err.response?.data?.error || err.message || 'Failed to load user');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeUserDetail = () => {
    setDetailUserId(null);
    setDetailData(null);
    setDetailError('');
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
        if (detailUserId === userId) closeUserDetail();
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

    const { type, userId, pin } = pendingAction;
    setReasonModalOpen(false);

    if (type === 'suspend') {
      await executeSuspend(userId, pin, reason);
    } else if (type === 'delete') {
      await executeDelete(userId, pin, reason);
    }

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

  const formatDate = (value) => {
    if (!value) return '—';
    return new Date(value).toLocaleString();
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 p-8 bg-gray-50">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#212529] mb-2">User Management</h1>
            <h2 className="text-xl font-semibold text-[#212529]">User Accounts</h2>
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

        {!loading && users.length > 0 && (
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-xl">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username, email, or name…"
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
              {searchQuery.trim()
                ? `Showing ${filteredUsers.length} of ${users.length} users`
                : `${users.length} users`}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-[#193965] border-t-transparent" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-gray-500 py-16">No users found in the database.</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-16">
              No users match &quot;{searchQuery.trim()}&quot;. Try a different search.
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
                      STATUS
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[#212529] uppercase tracking-wider">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => {
                    const busy = actionId === user.id;
                    const isActive = user.status === 'Active';
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
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openUserDetail(user.id)}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#193965]/10 text-[#193965] hover:bg-[#193965]/20 transition-colors disabled:opacity-50"
                            >
                              View
                            </button>
                            {isActive ? (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleSuspend(user.id)}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors disabled:opacity-50"
                              >
                                {busy ? '…' : 'Suspend'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => handleUnsuspend(user.id)}
                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors disabled:opacity-50"
                              >
                                {busy ? '…' : 'Unsuspend'}
                              </button>
                            )}
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

        {detailUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-[#212529]">User details</h3>
                <button
                  type="button"
                  onClick={closeUserDetail}
                  className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4">
                {detailLoading && (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin h-10 w-10 border-2 border-[#193965] border-t-transparent rounded-full" />
                  </div>
                )}
                {detailError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{detailError}</p>
                )}
                {!detailLoading && detailData?.user && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-6">
                      <div><span className="text-gray-500">Name</span><p className="font-medium">{detailData.user.name || '—'}</p></div>
                      <div><span className="text-gray-500">Username</span><p className="font-medium">{detailData.user.username !== '—' ? `@${detailData.user.username}` : '—'}</p></div>
                      <div><span className="text-gray-500">Email</span><p className="font-medium break-all">{detailData.user.email}</p></div>
                      <div><span className="text-gray-500">Status</span><p className="font-medium">{detailData.user.status}</p></div>
                      <div><span className="text-gray-500">Department</span><p className="font-medium">{detailData.user.department || '—'}</p></div>
                      <div><span className="text-gray-500">Program</span><p className="font-medium">{detailData.user.program || '—'}</p></div>
                      <div><span className="text-gray-500">Roll number</span><p className="font-medium">{detailData.user.rollNumber || '—'}</p></div>
                      <div><span className="text-gray-500">Joined</span><p className="font-medium">{formatDate(detailData.user.createdAt)}</p></div>
                      {detailData.user.bio && (
                        <div className="sm:col-span-2"><span className="text-gray-500">Bio</span><p className="font-medium">{detailData.user.bio}</p></div>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-[#212529] mb-2">
                      Posts ({detailData.postsCount ?? detailData.posts?.length ?? 0})
                    </h4>
                    {detailData.posts?.length === 0 ? (
                      <p className="text-sm text-gray-500">No posts yet.</p>
                    ) : (
                      <ul className="space-y-2 max-h-64 overflow-y-auto">
                        {detailData.posts.map((post) => (
                          <li key={post.id} className="border border-gray-100 rounded-lg px-3 py-2 text-sm">
                            <p className="text-[#212529]">{post.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(post.createdAt)} · {post.likesCount} likes · {post.commentsCount} comments
                              {post.sentiment ? ` · ${post.sentiment}` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {pinModalOpen && (
          <AdminPinModal
            isOpen={pinModalOpen}
            onClose={closePinModal}
            onVerify={handlePinVerified}
            actionName={pendingAction?.type === 'delete' ? 'delete this user' : 'suspend this user'}
          />
        )}

        {reasonModalOpen && (
          <AdminActionReasonModal
            isOpen={reasonModalOpen}
            onClose={closeReasonModal}
            onSubmit={handleReasonSubmit}
            actionName={pendingAction?.type === 'delete' ? 'deleting this user' : 'suspending this user'}
          />
        )}
      </main>
    </div>
  );
};

export default UserManagement;
