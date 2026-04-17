'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, IdCard, Mail, MapPin, Save, Shield, UploadCloud, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export default function AdminProfilePage() {
  const { user, refreshUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [me, setMe] = useState<any>(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    stateName: '',
    zipCode: '',
    gender: '',
    dob: '',
    bio: '',
    avatar: '',
  });

  const backendOrigin = useMemo(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    return apiBase.replace(/\/api\/?$/, '');
  }, []);

  const avatarSrc = useMemo(() => {
    const v = form.avatar || me?.avatar || user?.avatar || '';
    if (!v) return '';
    // Stored as /uploads/... on server
    if (v.startsWith('http')) return v;
    return `${backendOrigin}${v}`;
  }, [backendOrigin, form.avatar, me?.avatar, user?.avatar]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        const res = await api.getMe();
        if (!mounted) return;

        if (res.success) {
          setMe(res.data);
          setForm({
            name: res.data?.name || '',
            phone: res.data?.phone || '',
            address: res.data?.address || '',
            city: res.data?.city || '',
            stateName: res.data?.state || '',
            zipCode: res.data?.zipCode || '',
            gender: res.data?.gender || '',
            dob: res.data?.dob || '',
            bio: res.data?.bio || '',
            avatar: res.data?.avatar || '',
          });
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        avatar: form.avatar,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.stateName.trim(),
        zipCode: form.zipCode.trim(),
        gender: form.gender.trim(),
        dob: form.dob.trim(),
        bio: form.bio.trim(),
      };

      const res = await api.updateProfile(payload);
      if (res.success) {
        toast.success('Profile updated');
        setMe(res.data);
        await refreshUser();
      } else {
        toast.error(res.message || res.error || 'Update failed');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    try {
      const res = await api.uploadAvatar(file);
      if (!res?.success || !res?.avatarUrl) {
        toast.error(res?.error || 'Avatar upload failed');
        return;
      }
      setForm((p) => ({ ...p, avatar: res.avatarUrl }));
      const res2 = await api.updateProfile({ avatar: res.avatarUrl });
      if (res2.success) {
        toast.success('Avatar updated');
        setMe(res2.data);
        await refreshUser();
      }
    } catch {
      toast.error('Avatar upload failed');
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-white/5 rounded" />
          <div className="h-24 bg-white/5 rounded" />
          <div className="h-32 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary-400" />
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">My Profile</h1>
          </div>
          <p className="text-sm text-white/40">Your official account details</p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary py-2.5 px-5 flex items-center gap-2 disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-4">
        {/* Left: identity */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-7 h-7 text-white/40" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white truncate">{me?.name || user?.name || 'Official'}</p>
              <p className="text-xs text-white/40 truncate">{me?.email || user?.email || ''}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="badge text-[10px] bg-primary-500/15 text-primary-400 border border-primary-500/20">
                  {(me?.role || user?.role || '').toString().replace('_', ' ') || 'ROLE'}
                </span>
                {me?.department && (
                  <span className="badge text-[10px] bg-white/5 text-white/60 border border-white/10">
                    {me.department}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
              Update avatar
            </label>
            <label className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60 hover:bg-white/[0.06] cursor-pointer transition-colors">
              <UploadCloud className="w-4 h-4" />
              <span>Upload image</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  handleAvatarChange(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
            <p className="text-[10px] text-white/25 mt-2">JPG/PNG/WebP up to 5MB</p>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2 text-white/60">
              <Mail className="w-4 h-4 text-white/30" />
              <span className="text-sm truncate">{me?.email || user?.email || ''}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Building2 className="w-4 h-4 text-white/30" />
              <span className="text-sm truncate">{me?.department || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <MapPin className="w-4 h-4 text-white/30" />
              <span className="text-sm truncate">{me?.region || '—'}</span>
            </div>
          </div>
        </div>

        {/* Right: editable + official */}
        <div className="space-y-4">
          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Editable Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Name</label>
                <input
                  className="input-field text-sm"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Your full name"
                  aria-label="Name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Phone</label>
                <input
                  className="input-field text-sm"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="Phone"
                  aria-label="Phone"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Address</label>
                <input
                  className="input-field text-sm"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Address"
                  aria-label="Address"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">City</label>
                <input
                  className="input-field text-sm"
                  value={form.city}
                  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                  placeholder="City"
                  aria-label="City"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">State</label>
                <input
                  className="input-field text-sm"
                  value={form.stateName}
                  onChange={(e) => setForm((p) => ({ ...p, stateName: e.target.value }))}
                  placeholder="State"
                  aria-label="State"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">ZIP Code</label>
                <input
                  className="input-field text-sm"
                  value={form.zipCode}
                  onChange={(e) => setForm((p) => ({ ...p, zipCode: e.target.value }))}
                  placeholder="ZIP"
                  aria-label="ZIP Code"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">DOB</label>
                <input
                  type="date"
                  className="input-field text-sm"
                  value={form.dob}
                  onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))}
                  aria-label="Date of birth"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Gender</label>
                <input
                  className="input-field text-sm"
                  value={form.gender}
                  onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                  placeholder="Gender"
                  aria-label="Gender"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Bio</label>
                <textarea
                  className="input-field text-sm min-h-[110px]"
                  value={form.bio}
                  onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Short bio"
                  aria-label="Bio"
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4">Official Details (Read-only)</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Role</p>
                <p className="text-sm text-white font-medium">{(me?.role || user?.role || '—').toString().replace('_', ' ')}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Status</p>
                <p className="text-sm text-white font-medium">{me?.isActive === false ? 'Inactive' : 'Active'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Employee ID</p>
                <p className="text-sm text-white font-medium">{me?.employeeId || '—'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Designation</p>
                <p className="text-sm text-white font-medium">{me?.rank || '—'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Level</p>
                <p className="text-sm text-white font-medium">{typeof me?.level === 'number' ? me.level : '—'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Office Address</p>
                <p className="text-sm text-white font-medium">{me?.officeAddress || '—'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">District</p>
                <p className="text-sm text-white font-medium">{me?.district || '—'}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Pincode</p>
                <p className="text-sm text-white font-medium">{me?.pincode || '—'}</p>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-white/25 flex items-center gap-2">
              <IdCard className="w-3.5 h-3.5" />
              These fields are managed by Super Admin.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
