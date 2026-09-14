import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { clearProfileCache } from '../../utils/profileCache';
import { getAdminPinStatus } from '../../services/api';
import {
  Squares2X2Icon,
  UsersIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  FaceSmileIcon,
  NoSymbolIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import {
  Squares2X2Icon as Squares2X2IconSolid,
  UsersIcon as UsersIconSolid,
  ShieldCheckIcon as ShieldCheckIconSolid,
  ChartBarIcon as ChartBarIconSolid,
  FaceSmileIcon as FaceSmileIconSolid,
  NoSymbolIcon as NoSymbolIconSolid,
  Cog6ToothIcon as Cog6ToothIconSolid,
  LockClosedIcon as LockClosedIconSolid,
} from '@heroicons/react/24/solid';
import CampusBuzzIcon from '../CampusBuzzIcon';

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasPin, setHasPin] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadPinStatus = async () => {
      try {
        const { data } = await getAdminPinStatus();
        if (!mounted) return;
        setHasPin(Boolean(data?.hasPin));
      } catch {
        if (!mounted) return;
        setHasPin(false);
      }
    };
    loadPinStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const navItems = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      path: '/admin-dashboard',
      Icon: Squares2X2Icon,
      IconSolid: Squares2X2IconSolid
    },
    { 
      id: 'user-management', 
      label: 'User Management', 
      path: '/user-management',
      Icon: UsersIcon,
      IconSolid: UsersIconSolid
    },
    { 
      id: 'suspended-users', 
      label: 'Suspended Users', 
      path: '/suspended-users',
      Icon: NoSymbolIcon,
      IconSolid: NoSymbolIconSolid
    },
    { 
      id: 'post-moderation', 
      label: 'Post Moderation', 
      path: '/post-moderation',
      Icon: ShieldCheckIcon,
      IconSolid: ShieldCheckIconSolid
    },
    {
      id: 'alumni-signups',
      label: 'Alumni Signups',
      path: '/admin/alumni-signups',
      Icon: DocumentTextIcon,
      IconSolid: DocumentTextIcon,
    },
    { 
      id: 'reports-analytics', 
      label: 'Reports & Analytics', 
      path: '/reports-analytics',
      Icon: ChartBarIcon,
      IconSolid: ChartBarIconSolid
    },
    { 
      id: 'sentiment-analysis', 
      label: 'Sentiment Analysis', 
      path: '/sentiment-analysis',
      Icon: FaceSmileIcon,
      IconSolid: FaceSmileIconSolid
    },
    {
      id: 'profile-settings',
      label: 'Profile Settings',
      path: '/admin/profile-settings',
      Icon: Cog6ToothIcon,
      IconSolid: Cog6ToothIconSolid,
    },
  ];

  const pinItem = {
    id: hasPin ? 'change-pin' : 'setup-pin',
    label: hasPin ? 'Change PIN' : 'Setup PIN',
    path: hasPin ? '/admin/change-pin' : '/admin/setup-pin',
    Icon: LockClosedIcon,
    IconSolid: LockClosedIconSolid,
  };

  const handleNavClick = (item) => {
    navigate(item.path);
  };

  const handleLogout = async () => {
    localStorage.removeItem('admin');
    clearProfileCache();
    await signOut(auth);
    navigate('/admin/login', { replace: true });
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <aside className="min-h-screen sticky top-0 w-full lg:w-64 bg-gradient-to-b from-[#eef5ff] via-[#f8fbff] to-white border-r border-slate-200 shadow-sm flex flex-col">
      <div className="px-6 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-gradient-to-br from-[#193965] to-[#4f6fd8] p-3 shadow-lg shadow-[#193965]/10">
            <CampusBuzzIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#193965]">Admin Portal</p>
            <h1 className="text-xl font-bold text-[#0f172a]">CampusBuzz</h1>
          </div>
        </div>
      </div>

      <nav className="px-4 py-6 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {[...navItems, pinItem].map(item => {
            const active = isActive(item.path);
            const IconComponent = active ? item.IconSolid : item.Icon;

            return (
              <li key={item.id}>
                <button
                  onClick={() => handleNavClick(item)}
                  className={`w-full text-left py-3 px-4 rounded-2xl transition-all duration-200 flex items-center gap-3 ${
                    active
                      ? 'font-semibold text-[#0f172a] bg-[#e7f0ff] shadow-sm ring-1 ring-[#193965]/10'
                      : 'text-[#334155] hover:text-[#0f172a] hover:bg-gray-50'
                  }`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f8fafc] text-[#193965]">
                    <IconComponent className="w-5 h-5" />
                  </span>
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-gray-100 bg-slate-50">
        <div className="mb-3 rounded-2xl bg-[#f0f9ff] p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Secure Admin Access</p>
          <p className="mt-1 text-xs text-slate-600">Manage users, review reports, and keep the campus feed clean.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-white border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 transition"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Logout
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
