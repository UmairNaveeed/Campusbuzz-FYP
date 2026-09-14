import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useForumMessageCount } from '../hooks/useForumMessageCount';
import { useMessageCount } from '../hooks/useMessageCount';
import { useNotificationCount } from '../hooks/useNotificationCount';
import { useCreatePost } from '../context/CreatePostContext';
import FormInput from './FormInput';
import Modal from './Modal';
import PhotoCropModal from './PhotoCropModal';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { validateUsername } from '../lib/utils';
import { formatDepartmentLabel } from '../utils/departmentLabel';
import {
  ArrowLeft,
  Bell,
  Camera,
  Hash,
  Home,
  List,
  LogOut,
  Mail,
  MessageSquare,
  PlusCircle,
  Save,
  Trash2,
  UserCircle,
} from 'lucide-react';
import SearchBar from './SearchBar';
import CampusBuzzIcon from './CampusBuzzIcon';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from './ui/sidebar';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from './ui/navigation-menu';

/** Large originals allowed before compress (camera rolls). MongoDB caps whole user docs at 16MB — we resize/re-encode client-side. */
const MAX_IMAGE_INPUT_BYTES = 45 * 1024 * 1024;
const MAX_IMAGE_INPUT_MB = Math.round(MAX_IMAGE_INPUT_BYTES / (1024 * 1024));
const MAX_PROCESSED_DATA_URL_CHARS = 14 * 1024 * 1024;
/** Downscale + JPEG encode after crop (MongoDB doc size safe). */
async function compressBitmapToDataUrl(bitmap, kind) {
  const maxW = kind === 'profile' ? 1024 : 2560;
  const maxH = kind === 'profile' ? 1024 : 1440;
  const quality = kind === 'profile' ? 0.93 : 0.88;
  let { width, height } = bitmap;
  const scale = Math.min(1, maxW / width, maxH / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  if (kind === 'profile') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not encode image'));
          return;
        }
        const r = new FileReader();
        r.onloadend = () => resolve(r.result);
        r.onerror = () => reject(new Error('Could not read encoded image'));
        r.readAsDataURL(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

async function compressBlobToDataUrl(blob, kind) {
  const bitmap = await createImageBitmap(blob);
  try {
    return await compressBitmapToDataUrl(bitmap, kind);
  } finally {
    bitmap.close();
  }
}

export default function EditProfile() {
  const { openCreatePost } = useCreatePost();
  const { user: firebaseUser, logout } = useAuth();
  const { profile, refetchProfile } = useProfile();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    username: '',
    bio: '',
    location: '',
    currentStatus: '',
  });
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [photoCrop, setPhotoCrop] = useState(null); // { kind: 'profile'|'cover', src: objectUrl }
  const [cropApplying, setCropApplying] = useState(false);
  const cropSessionRef = useRef(null);
  const profileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (cropSessionRef.current?.src) {
        URL.revokeObjectURL(cropSessionRef.current.src);
        cropSessionRef.current = null;
      }
    };
  }, []);

  const closeCropModal = () => {
    if (cropApplying) return;
    if (cropSessionRef.current?.src) {
      URL.revokeObjectURL(cropSessionRef.current.src);
      cropSessionRef.current = null;
    }
    setPhotoCrop(null);
  };

  const handleCropApplied = async (blob) => {
    if (!photoCrop) return;
    const kind = photoCrop.kind === 'profile' ? 'profile' : 'cover';
    setCropApplying(true);
    setError('');
    try {
      const dataUrl = await compressBlobToDataUrl(blob, kind);
      if (typeof dataUrl === 'string' && dataUrl.length > MAX_PROCESSED_DATA_URL_CHARS) {
        setError(
          'Processed image is still too large. Try a smaller source file or save profile and cover photos separately.'
        );
        return;
      }
      if (kind === 'profile') setProfilePhoto(dataUrl);
      else setCoverPhoto(dataUrl);
      if (cropSessionRef.current?.src) {
        URL.revokeObjectURL(cropSessionRef.current.src);
        cropSessionRef.current = null;
      }
      setPhotoCrop(null);
    } catch (err) {
      setError(err?.message || 'Could not apply your crop. Try another image.');
    } finally {
      setCropApplying(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        username: profile.username || '',
        bio: profile.bio || '',
        location: profile.location || '',
        currentStatus: profile.currentStatus || '',
      });
    } else if (firebaseUser) {
      setForm((f) => ({
        ...f,
        name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || '',
      }));
    }
  }, [profile, firebaseUser]);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const normalized = (s) => (s ?? '').trim().replace(/^@+/, '');
  const hasFormChanges = profile && (
    normalized(form.name) !== normalized(profile.name) ||
    normalized(form.username) !== normalized(profile.username ?? '') ||
    (form.bio ?? '').trim() !== (profile.bio ?? '').trim() ||
    (form.location ?? '').trim() !== (profile.location ?? '').trim()
  );
  const hasPhotoChanges = profilePhoto !== null || coverPhoto !== null;
  const hasChanges = !!(hasFormChanges || hasPhotoChanges);

  const displayName = profile?.name || firebaseUser?.displayName || firebaseUser?.email?.split('@')[0] || 'User';
  const displayUsername = profile?.username ? (profile.username.startsWith('@') ? profile.username : `@${profile.username}`) : '';
  const initial = (displayName || 'U')[0].toUpperCase();
  const { count: forumCount } = useForumMessageCount();
  const { count: messageSidebarCount } = useMessageCount();
  const { count: notificationCount } = useNotificationCount();

  const handlePhotoChange = (type, e) => {
    const file = e?.target?.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      setError(`Image is too large (max ${MAX_IMAGE_INPUT_MB}MB). Try another photo or export at lower resolution.`);
      if (e?.target) e.target.value = '';
      return;
    }

    const mime = file.type.toLowerCase();
    if (mime === 'image/svg+xml') {
      setError('SVG is not supported. Use PNG or JPEG.');
      if (e?.target) e.target.value = '';
      return;
    }

    setError('');
    if (cropSessionRef.current?.src) {
      URL.revokeObjectURL(cropSessionRef.current.src);
      cropSessionRef.current = null;
    }
    const src = URL.createObjectURL(file);
    cropSessionRef.current = { kind: type, src };
    setPhotoCrop({ kind: type, src });
    if (e?.target) e.target.value = '';
  };

  const handleRemovePhoto = (type) => {
    if (type === 'profile') setProfilePhoto('REMOVE');
    else setCoverPhoto('REMOVE');
  };

  const handleSave = async () => {
    setError('');
    setSuccessMessage('');
    const rawUsername = (form.username ?? '').trim().replace(/^@+/, '') || null;
    let finalUsername = null;
    if (rawUsername) {
      const uCheck = validateUsername(rawUsername);
      if (!uCheck.valid) {
        setError(uCheck.error);
        return;
      }
      finalUsername = uCheck.value;
    }
    setSaving(true);
    try {
      await api.put('/api/profile/update', {
        name: form.name?.trim() || '',
        username: finalUsername,
        bio: form.bio?.trim() || null,
        location: form.location?.trim() || null,
        profilePhoto: profilePhoto === 'REMOVE' ? null : (profilePhoto || undefined),
        coverPhoto: coverPhoto === 'REMOVE' ? null : (coverPhoto || undefined),
      });
      setSaving(false);
      setSuccessMessage('Saved successfully');
      setProfilePhoto(null);
      setCoverPhoto(null);
      await refetchProfile(false);
      window.dispatchEvent(new Event('profileUpdated'));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile.');
      setSaving(false);
    }
  };

  const menuItems = [
    { label: 'Home Feed', icon: Home, to: '/home' },
    { label: 'Create Post', icon: PlusCircle, to: '/create-post' },
    { label: 'Profile', icon: UserCircle, to: '/profile' },
    { label: 'Notifications', icon: Bell, to: '/notifications' },
    { label: 'Messages', icon: Mail, to: '/messages' },
    { label: 'Trends', icon: Hash, to: '/explore' },
    { label: 'Lists', icon: List, to: '/lists' },
    { label: 'Forums', icon: MessageSquare, to: '/discussion' },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon">
        <SidebarContent className="bg-sidebar px-2 py-3">
          <Link to="/home" className="flex items-center gap-2 px-2 pb-3 text-white text-xl font-bold rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            <CampusBuzzIcon className="h-6 w-6 shrink-0 text-white" fill="white" />
            CampusBuzz
          </Link>
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase text-[11px] tracking-[0.12em] text-white/60">Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => {
                  if (item.label === 'Create Post') {
                    return (
                      <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton
                          onClick={openCreatePost}
                          className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                        >
                          <div className="flex items-center gap-2">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </div>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton
                        asChild
                        isActive={item.label === 'Profile'}
                        className="text-white hover:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:text-white h-10"
                      >
                        <Link to={item.to} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                          {(item.label === 'Forums' && forumCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {forumCount > 99 ? '99+' : forumCount}
                            </span>
                          )}
                          {(item.label === 'Messages' && messageSidebarCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {messageSidebarCount > 99 ? '99+' : messageSidebarCount}
                            </span>
                          )}
                          {(item.label === 'Notifications' && notificationCount > 0) && (
                            <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
          <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/50 transition-colors cursor-pointer">
            {profile?.profilePhoto ? (
              <img src={profile.profilePhoto} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground shrink-0">
                {initial}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-white">{displayName}</p>
              {displayUsername && <p className="text-[11px] text-white/70">{displayUsername}</p>}
            </div>
          </Link>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#F3F4F8] flex flex-col min-h-0">
        {/* Top bar */}
        <div className="w-full border-b border-[#DCDDDF] bg-white px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="w-full max-w-[400px]">
              <SearchBar placeholder="Search CampusBuzz..." />
            </div>
            <div className="flex items-center gap-1">
              <NavigationMenu className="max-w-none">
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger className="h-9 gap-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-medium text-[#374151]">
                      {profile?.profilePhoto ? (
                        <img src={profile.profilePhoto} alt="" className="h-7 w-7 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6] text-xs font-semibold text-white">
                          {initial}
                        </span>
                      )}
                      <span className="hidden sm:inline">{displayName}</span>
                    </NavigationMenuTrigger>
                    <NavigationMenuContent className="min-w-[180px]">
                      <ul className="grid gap-1 p-2">
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/profile" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Profile</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <NavigationMenuLink asChild>
                            <Link to="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-[#F3F4F6]">Settings</Link>
                          </NavigationMenuLink>
                        </li>
                        <li>
                          <button type="button" onClick={handleLogout} className="block w-full text-left rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            Logout
                          </button>
                        </li>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>
        </div>

        {/* Edit Profile content */}
        <div className="px-6 py-5">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex items-center justify-center rounded-lg p-2 hover:bg-[#F3F4F6] text-[#374151] transition-colors"
                title="Back to profile"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-2xl font-bold text-[#111827]">Edit Profile</h1>
            </div>

            <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
              {/* Hidden file inputs */}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange('cover', e)} />
              <input ref={profileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoChange('profile', e)} />

              {/* Banner */}
              <div className="h-32 bg-gradient-to-r from-[#7C3AED] via-[#A855F7] to-[#EC4899] relative">
                {(coverPhoto && coverPhoto !== 'REMOVE') || (profile?.coverPhoto && coverPhoto !== 'REMOVE') ? (
                  <img src={coverPhoto || profile.coverPhoto} alt="" className="w-full h-full object-cover pointer-events-none" />
                ) : null}
                <div className="absolute bottom-3 right-3 flex gap-2 z-10">
                  {((coverPhoto && coverPhoto !== 'REMOVE') || profile?.coverPhoto) && coverPhoto !== 'REMOVE' ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); handleRemovePhoto('cover'); }} className="rounded-xl bg-red-500/80 backdrop-blur-sm p-2 text-white hover:bg-red-500 transition-colors" title="Remove cover photo">
                      <Trash2 size={16} />
                    </button>
                  ) : null}
                  <button type="button" onClick={(e) => { 
                    e.stopPropagation();
                    if (coverInputRef.current) {
                      coverInputRef.current.click();
                    } else {
                      // Fallback: create a temporary input
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.style.display = 'none';
                      input.onchange = (e) => handlePhotoChange('cover', e);
                      document.body.appendChild(input);
                      input.click();
                      document.body.removeChild(input);
                    }
                  }} disabled={cropApplying} className="rounded-xl bg-black/30 backdrop-blur-sm p-2 text-white hover:bg-black/50 transition-colors disabled:opacity-50" title="Change cover photo">
                    <Camera size={16} />
                  </button>
                </div>
              </div>

              {/* Avatar */}
              <div className="px-6 -mt-10 relative">
                {((profilePhoto && profilePhoto !== 'REMOVE') || profile?.profilePhoto) && profilePhoto !== 'REMOVE' ? (
                  <div className="relative inline-block">
                    <img src={profilePhoto || profile.profilePhoto} alt="" className="h-20 w-20 rounded-full border-4 border-white object-cover shadow-lg" />
                    <div className="absolute -bottom-1 -right-1 flex gap-1">
                      <button type="button" onClick={() => handleRemovePhoto('profile')} className="rounded-full bg-red-500 p-1.5 text-white shadow-md hover:opacity-90" title="Remove profile photo">
                        <Trash2 size={12} />
                      </button>
                      <button type="button" onClick={() => profileInputRef.current?.click()} disabled={cropApplying} className="rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] p-1.5 text-white shadow-md hover:opacity-90 disabled:opacity-50" title="Change profile photo">
                        <Camera size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative inline-block">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-[#EDE9FE] text-2xl font-bold text-[#7C3AED] shadow-lg">
                      {initial}
                    </div>
                    <button type="button" onClick={() => profileInputRef.current?.click()} className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] p-1.5 text-white shadow-md hover:opacity-90">
                      <Camera size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Form */}
              <div className="p-6 space-y-4">
                <FormInput label="Display Name" value={form.name} onChange={(v) => update('name', v)} placeholder="Your name" />
                <FormInput label="Username" value={form.username} onChange={(v) => update('username', v)} placeholder="@username" />
                <FormInput label="Bio" textarea value={form.bio} onChange={(v) => update('bio', v)} placeholder="Tell everyone about yourself" />
                <FormInput label="Location" value={form.location} onChange={(v) => update('location', v)} placeholder="City or campus" />

                <h3 className="text-base font-semibold text-[#111827] pt-2">Education Details</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#111827]">Semester</label>
                    <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 px-4 text-sm text-[#6B7280]">
                      {profile?.startSemester || '—'}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#111827]">Department</label>
                    <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 px-4 text-sm text-[#6B7280]">
                      {formatDepartmentLabel(profile?.department) || '—'}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#111827]">Program</label>
                    <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 px-4 text-sm text-[#6B7280]">
                      {profile?.program || '—'}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-[#111827]">Current status</label>
                    <div className="w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] py-2.5 px-4 text-sm text-[#6B7280]">
                      {profile?.currentStatus ? profile.currentStatus.charAt(0).toUpperCase() + profile.currentStatus.slice(1).toLowerCase() : '—'}
                    </div>
                  </div>
                </div>

                {successMessage && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white text-xs">✓</span>
                    {successMessage}
                  </div>
                )}
                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => hasChanges ? setShowDiscardModal(true) : navigate('/profile')}
                    disabled={saving}
                    className="flex-1 rounded-xl border border-[#D1D5DB] bg-white py-2.5 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges || cropApplying || !!photoCrop}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <Save size={14} /> {saving ? 'Saving...' : cropApplying ? 'Applying crop…' : photoCrop ? 'Finish photo first' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>

      <PhotoCropModal
        open={!!photoCrop}
        kind={photoCrop?.kind === 'cover' ? 'cover' : 'profile'}
        imageSrc={photoCrop?.src || ''}
        applying={cropApplying}
        onClose={closeCropModal}
        onApply={handleCropApplied}
        onCropFail={(msg) => setError(msg)}
      />

      <Modal
        open={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        title="Discard changes?"
        size="sm"
      >
        <p className="text-[#6B7280] mb-6">Any changes you have made will be discarded.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setShowDiscardModal(false)}
            className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            type="button"
          >
            Keep Editing
          </button>
          <button
            onClick={() => {
              setShowDiscardModal(false);
              navigate('/profile');
            }}
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
            type="button"
          >
            Discard
          </button>
        </div>
      </Modal>
    </SidebarProvider>
  );
}
