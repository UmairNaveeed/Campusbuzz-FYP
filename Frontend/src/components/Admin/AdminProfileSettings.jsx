import React, { useEffect, useState } from 'react';
import { LockClosedIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import AdminSidebar from './AdminSidebar';
import AdminPinModal from './AdminPinModal';
import { getAdminProfile, changeAdminPassword } from '../../services/api';
import { validatePasswordStrength } from '../../utils/passwordPolicy';

const AdminProfileSettings = () => {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pendingPasswordSubmit, setPendingPasswordSubmit] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminProfile();
        if (data?.success) setProfile(data.profile);
      } catch {
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    })();
  }, []);

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg('');
    setPasswordSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('New password and confirmation do not match.');
      return;
    }
    const policyError = validatePasswordStrength(newPassword);
    if (policyError) {
      setPasswordMsg(policyError);
      return;
    }

    try {
      setPendingPasswordSubmit({ currentPassword, newPassword, confirmPassword });
      setPinModalOpen(true);
      return;
    } catch (err) {
      setPasswordMsg(err.response?.data?.error || err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handlePinVerified = async (pin) => {
    if (!pendingPasswordSubmit) return;
    setPinModalOpen(false);
    setPasswordSaving(true);
    setPasswordMsg('');
    setPasswordSuccess(false);

    try {
      const data = await changeAdminPassword({
        ...pendingPasswordSubmit,
        pin,
      });
      if (data?.success) {
        setPasswordSuccess(true);
        setPasswordMsg(data.message || 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      } else {
        setPasswordMsg(data?.error || 'Failed to change password.');
      }
    } catch (err) {
      setPasswordMsg(err.response?.data?.error || err.message || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
      setPendingPasswordSubmit(null);
    }
  };

  const closePinModal = () => {
    setPinModalOpen(false);
    setPendingPasswordSubmit(null);
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold text-[#212529] mb-2">Profile Settings</h1>
        <p className="text-gray-600 text-sm mb-8">Manage your administrator account.</p>

        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-xl mb-6">
          <div className="flex items-center gap-3 mb-4">
            <UserCircleIcon className="w-10 h-10 text-[#193965]" />
            <div>
              <h2 className="text-lg font-semibold text-[#212529]">Account</h2>
              <p className="text-sm text-gray-500">Administrator profile</p>
            </div>
          </div>
          {profileLoading ? (
            <div className="animate-spin h-8 w-8 border-2 border-[#193965] border-t-transparent rounded-full" />
          ) : (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-[#212529]">{profile?.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Display name</dt>
                <dd className="font-medium text-[#212529]">{profile?.name || 'Administrator'}</dd>
              </div>
              {profile?.username && (
                <div>
                  <dt className="text-gray-500">Username</dt>
                  <dd className="font-medium text-[#212529]">@{profile.username}</dd>
                </div>
              )}
            </dl>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-xl">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <LockClosedIcon className="w-8 h-8 text-[#193965]" />
              <div>
                <h2 className="text-lg font-semibold text-[#212529]">Change Password</h2>
                <p className="text-sm text-gray-500">Update your admin sign-in password</p>
              </div>
            </div>
            {!showPasswordForm && (
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(true);
                  setPasswordMsg('');
                  setPasswordSuccess(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-[#193965] rounded-lg hover:bg-[#0f2a52]"
              >
                Change Password
              </button>
            )}
          </div>

          {passwordSuccess && !showPasswordForm && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">
              {passwordMsg}
            </p>
          )}

          {showPasswordForm && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoComplete="new-password"
                />
                <p className="text-xs text-gray-500 mt-1">
                  At least 8 characters, upper & lower case, number, and special character.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  autoComplete="new-password"
                />
              </div>
              {passwordMsg && (
                <p
                  className={`text-sm rounded-lg px-3 py-2 border ${
                    passwordSuccess
                      ? 'text-green-700 bg-green-50 border-green-200'
                      : 'text-red-600 bg-red-50 border-red-200'
                  }`}
                >
                  {passwordMsg}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#193965] rounded-lg hover:bg-[#0f2a52] disabled:opacity-50"
                >
                  {passwordSaving ? 'Saving…' : 'Update password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordMsg('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        {pinModalOpen && (
          <AdminPinModal
            isOpen={pinModalOpen}
            onClose={closePinModal}
            onVerify={handlePinVerified}
            actionName="change your password"
          />
        )}
      </main>
    </div>
  );
};

export default AdminProfileSettings;
