'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Users, PlusCircle, PencilLine, Trash2, MapPin, Tag, AlertCircle, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { onEvent } from '@/lib/socket';
import ComplaintTable from '@/components/admin/ComplaintTable';
import AdminAdvancedSections, { type AdvancedSectionKey } from '@/components/admin/AdminAdvancedSections';
import { api } from '@/lib/api';

export default function AdminPage() {
  const { user, isLoading, token } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/admin/login');
      else if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') router.push('/admin/login');
    }
  }, [user, isLoading, router]);

  const [complaints, setComplaints] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [subDepartments, setSubDepartments] = useState<any[]>([]);
  const [departmentInfo, setDepartmentInfo] = useState<any>(null);
  const [departmentCategories, setDepartmentCategories] = useState<string[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [newMember, setNewMember] = useState<any>({
    name: '',
    email: '',
    password: '',
    address: '',
    pincode: '',
    state: '',
    governmentId: '',
  });
  const hasShownInitialPopup = useRef(false);

  const showComplaintPopup = (data: any, title = 'New Complaint') => {
    toast.custom((t) => (
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className="glass-card p-4 border border-primary-500/30 bg-primary-500/10 flex items-start gap-3 max-w-md"
      >
        <Bell className="w-5 h-5 text-primary-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <p className="font-semibold text-primary-300 mb-1">{title}</p>
          <p className="text-sm text-white/70 mb-2">
            <span className="font-mono text-primary-400">#{(data?.complaintId || '').toString().slice(-6)}</span>
            {data?.category ? ` - ${data.category}` : ''}
          </p>
          <p className="text-xs text-white/60">
            📍 {data?.location?.area || data?.location || 'Unknown area'}
            {data?.userName ? ` | 👤 ${data.userName}` : ''}
          </p>
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="text-white/40 hover:text-white/60"
          aria-label="Close notification"
        >
          ✕
        </button>
      </motion.div>
    ), { duration: 6000, position: 'top-right' });
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMember.name?.trim()) return toast.error('Sub-department name is required');
    if (!newMember.email?.trim()) return toast.error('Email is required');
    if (!newMember.password || newMember.password.length < 6) return toast.error('Password must be 6+ characters');

    const res = await api.createSubDepartment({
      name: newMember.name.trim(),
      email: newMember.email.trim(),
      password: newMember.password,
      address: newMember.address || '',
      pincode: newMember.pincode || '',
      state: newMember.state || '',
      governmentId: newMember.governmentId || '',
    });

    if (!res.success) {
      toast.error(res.message || res.error || 'Failed to create sub-department');
      return;
    }

    setSubDepartments((prev) => [res.data, ...prev]);
    toast.success('Sub-department created');
    setShowAddMember(false);
    setNewMember({ name: '', email: '', password: '', address: '', pincode: '', state: '', governmentId: '' });
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember?._id) return;

    const res = await api.updateSubDepartment(editingMember._id, {
      name: editingMember.name,
      contactEmail: editingMember.contactEmail,
      address: editingMember.address,
      pincode: editingMember.pincode,
      state: editingMember.state,
      governmentId: editingMember.governmentId,
    });

    if (!res.success) {
      toast.error(res.message || res.error || 'Failed to update sub-department');
      return;
    }

    setSubDepartments((prev) => prev.map((d) => (d._id === editingMember._id ? res.data : d)));
    toast.success('Sub-department updated');
    setShowEditMember(false);
    setEditingMember(null);
  };

  const handleDeleteMember = async (id: string) => {
    const confirmed = window.confirm('Deactivate this sub-department?');
    if (!confirmed) return;

    const res = await api.deleteSubDepartment(id);
    if (!res.success) {
      toast.error(res.message || res.error || 'Failed to deactivate sub-department');
      return;
    }

    setSubDepartments((prev) => prev.filter((d) => d._id !== id));
    toast.success('Sub-department deactivated');
  };

  const handleInlineStatusChange = async (complaintId: string, status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED') => {
    const res = await api.updateAdminComplaintStatus(complaintId, status, `Status updated from Work Status panel: ${status}`);
    if (!res.success) {
      toast.error(res.message || res.error || 'Failed to update status');
      return;
    }

    setComplaints((prev) =>
      prev.map((c) => {
        const cid = c?.complaintId || c?._id;
        if (cid !== complaintId) return c;
        return {
          ...c,
          status,
          resolvedAt: status === 'RESOLVED' ? new Date().toISOString() : c.resolvedAt,
        };
      })
    );

    toast.success(`Complaint moved to ${status.replace('_', ' ')}`);
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [compRes, subRes, deptRes, officersRes] = await Promise.all([
        api.getAdminComplaints(),
        api.getSubDepartments(),
        api.fetchApi<any>('/admin/department'),
        api.getAdminOfficers(),
      ]);

      if (compRes.success) {
        const complaintList = compRes.data as any[];
        setComplaints(complaintList);

        // Show popup as soon as admin panel opens (latest complaint alert).
        if (!hasShownInitialPopup.current && complaintList.length > 0) {
          showComplaintPopup(complaintList[0], 'Latest Complaint Alert');
          hasShownInitialPopup.current = true;
        }
      }
      if (subRes.success) setSubDepartments(subRes.data as any[]);
      if (officersRes.success) {
        const normalizedOfficers = (officersRes.data as any[]).map((o: any) => ({
          id: o._id || o.id,
          name: o.name,
          department: o.department,
        }));
        setOfficers(normalizedOfficers);
      }
      
      // Fetch full department info from API
      if (deptRes.success && deptRes.data) {
        setDepartmentInfo(deptRes.data);
        if (deptRes.data.categories) {
          setDepartmentCategories(Array.isArray(deptRes.data.categories) ? deptRes.data.categories : []);
        }
      } else {
        // Fallback to user data
        setDepartmentInfo({
          name: user.department,
          departmentId: user.departmentId,
        });
      }
    };
    fetchData();
  }, [user]);

  // Listen for real-time complaint notifications
  useEffect(() => {
    if (!token || !user) return;

    const departmentMatches = (incomingDept?: string) => {
      const currentDept = (departmentInfo?.name || user.department || '').toString().trim().toLowerCase();
      return incomingDept?.toString().trim().toLowerCase() === currentDept;
    };

    const onIncomingComplaint = (data: any) => {
      // Only show notification if complaint is for this department
      if (departmentMatches(data.department)) {
        showComplaintPopup(data, '🔔 New Complaint');

        // Refresh complaints list
        api.getAdminComplaints().then(res => {
          if (res.success) setComplaints(res.data as any[]);
        });
      }
    };

    const unsubscribeNew = onEvent('new_complaint', onIncomingComplaint, token);
    const unsubscribeCreated = onEvent('complaint_created', onIncomingComplaint, token);

    return () => {
      unsubscribeNew?.();
      unsubscribeCreated?.();
    };
  }, [token, user, departmentInfo]);

  const complaintStats = complaints.reduce(
    (acc: any, c: any) => {
      const s = (c?.status || 'PENDING').toString().toUpperCase();
      acc.total += 1;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { total: 0, PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, ESCALATED: 0 }
  );

  const outOfScopeCount = complaints.filter(
    (c) => c.category && departmentCategories.length > 0 && !departmentCategories.includes(c.category)
  ).length;

  const validSections = [
    'dashboard',
    'complaints',
    'subdepartments',
    'work-status',
    'performance',
    'alerts',
    'ai',
    'location',
    'communication',
    'controls',
  ] as const;

  const sectionParam = (searchParams.get('section') || 'dashboard') as (typeof validSections)[number];
  const activeSection: 'dashboard' | 'complaints' | 'subdepartments' | AdvancedSectionKey =
    validSections.includes(sectionParam) ? (sectionParam as any) : 'dashboard';

  if (isLoading || !user || user.role === 'PUBLIC') return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary-400" />
            <h1 className="text-3xl font-bold text-white uppercase tracking-tight">Admin Control Room</h1>
          </div>
          <p className="text-sm text-white/60 mb-4">Management Panel</p>
          
        </div>
      </div>

      <div className="min-h-[60vh]">
          {activeSection === 'dashboard' && (
            <div className="space-y-4">
              <div className="glass-card p-4 border border-primary-500/20 bg-primary-500/5">
                <h2 className="text-lg font-bold text-white">Dashboard Summary</h2>
                <p className="text-xs text-white/60 mt-1">Department overview, out-of-scope warnings, and complaint status totals.</p>
              </div>

              <div className="glass-card p-4 border border-primary-500/20 bg-primary-500/5 max-w-xl">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-400" />
                    <span className="text-xs uppercase tracking-widest text-white/60">Department</span>
                  </div>
                  <p className="text-lg font-bold text-white">{user?.department || 'Loading...'}</p>
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-primary-400" />
                      <span className="text-xs uppercase tracking-widest text-white/60">Assigned Categories</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {departmentCategories.length > 0 ? (
                        departmentCategories.slice(0, 8).map((cat) => (
                          <span key={cat} className="text-xs bg-primary-500/20 text-primary-300 px-2.5 py-1 rounded-lg border border-primary-500/30">
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-white/40 italic">No categories assigned</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {outOfScopeCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 border border-warning-500/20 bg-warning-500/5 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-warning-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning-300">Out-of-Scope Complaints Detected</p>
                    <p className="text-xs text-white/60 mt-1">
                      {outOfScopeCount} complaints received with categories not assigned to your department. These should be escalated to the appropriate department.
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Pending', value: complaintStats.PENDING, cls: 'border-warning-500/30 bg-warning-500/5 text-warning-400' },
                  { label: 'In Progress', value: complaintStats.IN_PROGRESS, cls: 'border-primary-500/30 bg-primary-500/5 text-primary-400' },
                  { label: 'Resolved', value: complaintStats.RESOLVED, cls: 'border-success-500/30 bg-success-500/5 text-success-400' },
                  { label: 'Escalated', value: complaintStats.ESCALATED, cls: 'border-danger-500/30 bg-danger-500/5 text-danger-400' },
                ].map((s) => (
                  <div key={s.label} className={`glass-card p-3 border ${s.cls}`}>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{s.label}</p>
                    <p className="text-2xl font-black mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'complaints' && <ComplaintTable complaints={complaints} officers={officers} />}

          {activeSection === 'subdepartments' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
              <h2 className="text-xl font-bold text-white">Sub-Departments</h2>
              <button onClick={() => setShowAddMember(true)} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
                <PlusCircle className="w-4 h-4" /> Add Sub-Department
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {subDepartments.map((d: any, i: number) => (
                <motion.div key={d._id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="glass-card p-4 hover:border-primary-500/30 transition-colors group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 group-hover:bg-primary-500/20 flex items-center justify-center transition-colors">
                      <Users className="w-5 h-5 text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{d.name}</p>
                      <p className="text-[10px] text-white/40 truncate max-w-[150px]">{d.contactEmail || '—'}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingMember({
                            _id: d._id,
                            name: d.name || '',
                            contactEmail: d.contactEmail || '',
                            address: d.address || '',
                            pincode: d.pincode || '',
                            state: d.state || '',
                            governmentId: d.governmentId || '',
                          });
                          setShowEditMember(true);
                        }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
                        title="Edit"
                      >
                        <PencilLine className="w-4 h-4 text-white/60" />
                      </button>
                      <button
                        onClick={() => handleDeleteMember(d._id)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-danger-500/10 border border-white/10"
                        title="Deactivate"
                      >
                        <Trash2 className="w-4 h-4 text-danger-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider bg-primary-500/5 px-2 py-0.5 rounded-lg border border-primary-500/10">SUB-DEPARTMENT</span>
                    <div className="flex items-center gap-2">
                       <span className="text-white/30 text-[10px] uppercase font-medium">{d.state || 'STATE'}</span>
                       <span className={`w-1.5 h-1.5 rounded-full ${d.isActive !== false ? 'bg-success-400' : 'bg-danger-400'} shadow-[0_0_8px_rgba(34,197,94,0.3)]`} />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                      <p className="text-white/40 uppercase tracking-widest">Total</p>
                      <p className="text-white font-semibold">{d.stats?.total ?? 0}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                      <p className="text-white/40 uppercase tracking-widest">Resolved</p>
                      <p className="text-success-400 font-semibold">{d.stats?.resolved ?? 0}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                      <p className="text-white/40 uppercase tracking-widest">Pending</p>
                      <p className="text-warning-400 font-semibold">{d.stats?.pending ?? 0}</p>
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-2">
                      <p className="text-white/40 uppercase tracking-widest">Avg Days</p>
                      <p className="text-white font-semibold">
                        {d.stats?.avgResolutionMs
                          ? (d.stats.avgResolutionMs / (1000 * 60 * 60 * 24)).toFixed(1)
                          : '—'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          )}

          {['work-status', 'performance', 'alerts', 'ai', 'location', 'communication', 'controls'].includes(activeSection) && (
            <AdminAdvancedSections
              complaints={complaints}
              focusSection={activeSection as AdvancedSectionKey}
              onInlineStatusChange={handleInlineStatusChange}
            />
          )}
      </div>

      {showAddMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-lg p-5 sm:p-6 my-auto shadow-2xl border-white/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary-400" />
              Add Sub-Department
            </h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Sub-Department Name</label>
                  <input
                    type="text"
                    value={newMember.name || ''}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Cyber Cell - Zone 2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Email (Official)</label>
                  <input
                    type="email"
                    value={newMember.email || ''}
                    onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    className="input-field text-sm"
                    placeholder="dept.zone2@govt.in"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Set Password</label>
                <input
                  type="password"
                  value={newMember.password || ''}
                  onChange={(e) => setNewMember({ ...newMember, password: e.target.value })}
                  className="input-field text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Department Address</label>
                  <input
                    type="text"
                    value={newMember.address || ''}
                    onChange={(e) => setNewMember({ ...newMember, address: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Sector 6 Police Station"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    value={newMember.pincode || ''}
                    onChange={(e) => setNewMember({ ...newMember, pincode: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. 490001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={newMember.state || ''}
                    onChange={(e) => setNewMember({ ...newMember, state: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Chhattisgarh"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Government ID</label>
                  <input
                    type="text"
                    value={newMember.governmentId || ''}
                    onChange={(e) => setNewMember({ ...newMember, governmentId: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. GOV-CCG-2026-12"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5">
                <button type="button" onClick={() => setShowAddMember(false)}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm">Cancel</button>
                <button type="submit" className="w-full sm:flex-1 btn-primary text-sm shadow-xl shadow-primary-500/20">Create Sub-Department</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showEditMember && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-lg p-5 sm:p-6 my-auto shadow-2xl border-white/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PencilLine className="w-5 h-5 text-primary-400" />
              Edit Sub-Department
            </h2>
            <form onSubmit={handleEditMember} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Sub-Department Name</label>
                  <input
                    type="text"
                    value={editingMember.name || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                    aria-label="Sub-department name"
                    className="input-field text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Email (Official)</label>
                  <input
                    type="email"
                    value={editingMember.contactEmail || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, contactEmail: e.target.value })}
                    aria-label="Official email"
                    className="input-field text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Department Address</label>
                  <input
                    type="text"
                    value={editingMember.address || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, address: e.target.value })}
                    aria-label="Department address"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Pincode</label>
                  <input
                    type="text"
                    value={editingMember.pincode || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, pincode: e.target.value })}
                    aria-label="Pincode"
                    className="input-field text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">State</label>
                  <input
                    type="text"
                    value={editingMember.state || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, state: e.target.value })}
                    aria-label="State"
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Government ID</label>
                  <input
                    type="text"
                    value={editingMember.governmentId || ''}
                    onChange={(e) => setEditingMember({ ...editingMember, governmentId: e.target.value })}
                    aria-label="Government ID"
                    className="input-field text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5">
                <button type="button" onClick={() => { setShowEditMember(false); setEditingMember(null); }}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm">Cancel</button>
                <button type="submit" className="w-full sm:flex-1 btn-primary text-sm shadow-xl shadow-primary-500/20">Save Changes</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
