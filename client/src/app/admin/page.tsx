'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Users, PlusCircle, PencilLine, Trash2, MapPin, Tag, AlertCircle, Bell, Eye, X, ChevronRight, Clock, Send, ArrowRight, CheckCircle2, Activity, MessageSquare } from 'lucide-react';
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
  const [isCreatingSubDepartment, setIsCreatingSubDepartment] = useState(false);
  const [viewingSubDept, setViewingSubDept] = useState<any>(null);
  const [subDeptComplaints, setSubDeptComplaints] = useState<any[]>([]);
  const [subDeptStats, setSubDeptStats] = useState<any>(null);
  const [loadingSubDeptView, setLoadingSubDeptView] = useState(false);
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
  // Track sub-department selection per complaint in assign-work section
  const [assignSelections, setAssignSelections] = useState<Record<string, string>>({});

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
    if (isCreatingSubDepartment) return;
    if (!newMember.name?.trim()) return toast.error('Sub-department name is required');
    if (!newMember.email?.trim()) return toast.error('Email is required');
    if (!newMember.password || newMember.password.length < 6) return toast.error('Password must be 6+ characters');

    setIsCreatingSubDepartment(true);
    try {
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
        const errMsg = res.message || res.error || 'Failed to create sub-department';
        console.error('[createSubDept] Error:', errMsg);
        toast.error(`❌ ${errMsg}`, { duration: 5000 });
        return;
      }

      const fresh = await api.getSubDepartments();
      if (fresh.success) setSubDepartments(fresh.data as any[]);
      else setSubDepartments((prev) => [res.data, ...prev]);

      toast.success('Sub-department created');
      setShowAddMember(false);
      setNewMember({ name: '', email: '', password: '', address: '', pincode: '', state: '', governmentId: '' });
    } finally {
      setIsCreatingSubDepartment(false);
    }
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
      // Use Promise.allSettled so one failing request doesn't block the rest
      const results = await Promise.allSettled([
        api.getAdminComplaints(),
        api.getSubDepartments(),
        api.fetchApi<any>('/admin/department'),
        api.getAdminOfficers(),
      ]);

      const compRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const subRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const deptRes = results[2].status === 'fulfilled' ? results[2].value : null;
      const officersRes = results[3].status === 'fulfilled' ? results[3].value : null;

      if (compRes?.success) {
        const complaintList = compRes.data as any[];
        setComplaints(complaintList);

        // Show popup as soon as admin panel opens (latest complaint alert).
        if (!hasShownInitialPopup.current && complaintList.length > 0) {
          showComplaintPopup(complaintList[0], 'Latest Complaint Alert');
          hasShownInitialPopup.current = true;
        }
      }
      if (subRes?.success) setSubDepartments(subRes.data as any[]);
      if (officersRes?.success) {
        const normalizedOfficers = (officersRes.data as any[]).map((o: any) => ({
          id: o._id || o.id,
          name: o.name,
          department: o.department,
        }));
        setOfficers(normalizedOfficers);
      }
      
      // Fetch full department info from API
      if (deptRes?.success && deptRes.data) {
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

  // Auto-refresh every 30s when on assign-work section
  // Use searchParams directly (activeSection is derived later in render)
  useEffect(() => {
    if (searchParams.get('section') !== 'assign-work') return;
    if (!token || !user) return; // Only run when authenticated
    const interval = setInterval(async () => {
      try {
        const res = await api.getAdminComplaints();
        if (res.success) setComplaints(res.data as any[]);
      } catch {
        // Silently ignore network errors in background refresh
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [searchParams, token, user]);

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
    'assign-work',
    'work-status',
    'performance',
    'alerts',
    'ai',
    'location',
    'communication',
    'controls',
  ] as const;

  const sectionParam = (searchParams.get('section') || 'dashboard') as (typeof validSections)[number];
  const activeSection: 'dashboard' | 'complaints' | 'subdepartments' | 'assign-work' | AdvancedSectionKey =
    validSections.includes(sectionParam) ? (sectionParam as any) : 'dashboard';

  if (isLoading || !user || user.role === 'PUBLIC') return null;
  if (user.isSubDepartment) {
    return null;
  }

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

          {activeSection === 'complaints' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-white">Complaint Control</h2>
              </div>
              <ComplaintTable complaints={complaints} officers={officers} subDepartments={subDepartments} />
            </div>
          )}

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
                          onClick={async () => {
                            setLoadingSubDeptView(true);
                            setViewingSubDept(d);
                            const res = await api.getSubDepartmentComplaints(d._id);
                            if (res.success && res.data) {
                              setSubDeptComplaints(res.data.complaints || []);
                              setSubDeptStats(res.data.stats || null);
                            }
                            setLoadingSubDeptView(false);
                          }}
                          className="p-2 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 border border-accent-500/20 transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4 text-accent-400" />
                        </button>
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

          {activeSection === 'assign-work' && (() => {
            const assignedComplaints = complaints.filter((c: any) => c.assignedSubDepartment);
            const unassignedComplaints = complaints.filter((c: any) => !c.assignedSubDepartment && c.status !== 'RESOLVED' && c.status !== 'REJECTED');

            const getStatusProgress = (status: string) => {
              if (status === 'PENDING') return { pct: 10, color: 'bg-warning-400', label: 'Awaiting Start', icon: '⏳' };
              if (status === 'IN_PROGRESS') return { pct: 55, color: 'bg-primary-400', label: 'Work In Progress', icon: '🔧' };
              if (status === 'UNDER_REVIEW') return { pct: 80, color: 'bg-violet-400', label: 'Under Review', icon: '🔍' };
              if (status === 'ESCALATED') return { pct: 75, color: 'bg-danger-400', label: 'Escalated', icon: '🚨' };
              if (status === 'RESOLVED') return { pct: 100, color: 'bg-success-400', label: 'Resolved', icon: '✅' };
              return { pct: 0, color: 'bg-white/20', label: status, icon: '•' };
            };

            return (
            <div>
              {/* Header */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
                    <Send className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-tight">Work Assignment & Status Tracker</h2>
                    <p className="text-xs text-white/40">{assignedComplaints.length} assigned • {unassignedComplaints.length} pending assignment • auto-refreshes every 30s</p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const res = await api.getAdminComplaints();
                    if (res.success) { setComplaints(res.data as any[]); toast.success('Refreshed!'); }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                >
                  <Clock className="w-3.5 h-3.5" /> Refresh Now
                </button>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Assigned', value: assignedComplaints.length, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                  { label: 'In Progress', value: assignedComplaints.filter((c: any) => c.status === 'IN_PROGRESS').length, color: 'text-primary-400', bg: 'bg-primary-500/10 border-primary-500/20' },
                  { label: 'Resolved', value: assignedComplaints.filter((c: any) => c.status === 'RESOLVED').length, color: 'text-success-400', bg: 'bg-success-500/10 border-success-500/20' },
                  { label: 'Awaiting Start', value: assignedComplaints.filter((c: any) => c.status === 'PENDING').length, color: 'text-warning-400', bg: 'bg-warning-500/10 border-warning-500/20' },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 border ${s.bg}`}>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* ── Status Tracker (Assigned Complaints) ── */}
              {assignedComplaints.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-400" /> Live Status Tracker
                  </h3>
                  <div className="space-y-3">
                    {assignedComplaints.map((c: any, i: number) => {
                      const prog = getStatusProgress(c.status);
                      const subDept = subDepartments.find((s: any) => s._id === c.assignedSubDepartment);
                      return (
                        <motion.div
                          key={c._id || c.complaintId || i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`glass-card p-4 border transition-all ${
                            c.status === 'RESOLVED' ? 'border-success-500/20' :
                            c.status === 'ESCALATED' ? 'border-danger-500/20' :
                            c.status === 'IN_PROGRESS' ? 'border-primary-500/20' :
                            'border-indigo-500/15'
                          }`}
                        >
                          {/* Top row */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">
                                #{(c.complaintId || c._id || '').toString().slice(-6)}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                                c.priority === 'HIGH' ? 'bg-danger-500/10 text-danger-400' :
                                c.priority === 'MEDIUM' ? 'bg-warning-500/10 text-warning-400' :
                                'bg-white/5 text-white/40'
                              }`}>{c.priority}</span>
                              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">{c.category}</span>
                            </div>
                            {/* Status badge */}
                            <span className={`text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 ${
                              c.status === 'RESOLVED' ? 'bg-success-500/15 text-success-300 border border-success-500/25' :
                              c.status === 'ESCALATED' ? 'bg-danger-500/15 text-danger-300 border border-danger-500/25' :
                              c.status === 'IN_PROGRESS' ? 'bg-primary-500/15 text-primary-300 border border-primary-500/25' :
                              c.status === 'UNDER_REVIEW' ? 'bg-violet-500/15 text-violet-300 border border-violet-500/25' :
                              'bg-warning-500/15 text-warning-300 border border-warning-500/25'
                            }`}>
                              <span>{prog.icon}</span> {prog.label}
                            </span>
                          </div>

                          <p className="text-sm text-white/70 mb-3 truncate">{c.description}</p>

                          {/* Progress Bar */}
                          <div className="mb-3">
                            <div className="flex justify-between text-[9px] text-white/30 mb-1">
                              <span>Progress</span>
                              <span>{prog.pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-white/5 border border-white/5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${prog.pct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                className={`h-full rounded-full ${prog.color}`}
                              />
                            </div>
                          </div>

                          {/* Sub-department + location + last remark */}
                          <div className="flex flex-wrap items-center gap-3 text-[10px]">
                            <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2.5 py-1.5">
                              <Users className="w-3 h-3 text-indigo-400" />
                              <span className="text-indigo-300 font-semibold">{subDept?.name || 'Sub-Dept'}</span>
                            </div>
                            <span className="flex items-center gap-1 text-white/25">
                              <MapPin className="w-3 h-3" />{c.location?.area || 'Unknown'}
                            </span>
                            {c.lastRemark && (
                              <span className="flex items-center gap-1 text-white/30 bg-white/5 px-2 py-1 rounded-lg border border-white/5 max-w-xs truncate" title={c.lastRemark}>
                                <MessageSquare className="w-3 h-3 flex-shrink-0" />
                                {c.lastRemark}
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Unassigned Complaints ── */}
              {subDepartments.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Tag className="w-10 h-10 text-white/10 mx-auto mb-3" />
                  <p className="text-sm text-white/30">No sub-departments created yet.</p>
                  <p className="text-xs text-white/20 mt-1">Go to Sub-Departments section to create one first.</p>
                </div>
              ) : unassignedComplaints.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-warning-400" /> Pending Assignment ({unassignedComplaints.length})
                  </h3>
                  <div className="space-y-3">
                    {unassignedComplaints.map((c: any, i: number) => (
                      <motion.div
                        key={c._id || c.complaintId || i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="glass-card p-4 border border-white/[0.06] hover:border-warning-500/20 transition-all"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-[10px] font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">
                                #{(c.complaintId || c._id || '').toString().slice(-6)}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded font-bold ${
                                c.priority === 'HIGH' ? 'bg-danger-500/10 text-danger-400 border border-danger-500/20' :
                                c.priority === 'MEDIUM' ? 'bg-warning-500/10 text-warning-400 border border-warning-500/20' :
                                'bg-white/5 text-white/50 border border-white/10'
                              }`}>{c.priority}</span>
                              <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded">{c.category}</span>
                              <span className="text-[10px] text-warning-400 bg-warning-500/10 px-2 py-0.5 rounded">{c.status}</span>
                            </div>
                            <p className="text-sm text-white/70 truncate">{c.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-white/30">
                              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{c.location?.area || 'Unknown'}</span>
                              <span>{c.userName || 'Anonymous'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <select
                              value={assignSelections[c._id || c.complaintId] || ''}
                              onChange={(e) => {
                                const id = c._id || c.complaintId;
                                setAssignSelections(prev => ({ ...prev, [id]: e.target.value }));
                              }}
                              className="input-field text-xs py-2 w-[180px]"
                              aria-label="Select sub-department"
                            >
                              <option value="" disabled>Select Sub-Dept</option>
                              {subDepartments.map((s: any) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                              ))}
                            </select>
                            <button
                              onClick={async () => {
                                const id = (c._id || c.complaintId).toString();
                                const subDeptId = assignSelections[id];
                                if (!subDeptId) { toast.error('Sub-department select karein'); return; }
                                const res = await api.assignSubDepartment(id, subDeptId);
                                if (!res.success) { toast.error(res.message || 'Failed to assign'); return; }
                                toast.success('✅ Work assigned!');
                                // Clear selection for this complaint
                                setAssignSelections(prev => { const n = {...prev}; delete n[id]; return n; });
                                const compRes = await api.getAdminComplaints();
                                if (compRes.success) setComplaints(compRes.data as any[]);
                              }}
                              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-indigo-300 border border-indigo-500/30 hover:from-indigo-500/30 hover:to-cyan-500/30 transition-all"
                            >
                              <ArrowRight className="w-3.5 h-3.5" /> Assign
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );})()}


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
                <button
                  type="submit"
                  disabled={isCreatingSubDepartment}
                  className="w-full sm:flex-1 btn-primary text-sm shadow-xl shadow-primary-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingSubDepartment ? 'Creating...' : 'Create Sub-Department'}
                </button>
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

      {/* Sub-Department Monitoring Modal */}
      {viewingSubDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-4xl p-5 sm:p-6 my-auto shadow-2xl border-white/10 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">
                  {viewingSubDept.name?.charAt(0)?.toUpperCase() || 'S'}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{viewingSubDept.name}</h2>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider">Sub-Department Monitoring • {viewingSubDept.state || 'N/A'}</p>
                </div>
              </div>
              <button onClick={() => { setViewingSubDept(null); setSubDeptComplaints([]); setSubDeptStats(null); }}
                className="p-2 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingSubDeptView ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Stats Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Total', value: subDeptStats?.total || 0, cls: 'border-white/10 bg-white/5 text-white' },
                    { label: 'Pending', value: subDeptStats?.pending || 0, cls: 'border-warning-500/30 bg-warning-500/5 text-warning-400' },
                    { label: 'In Progress', value: subDeptStats?.inProgress || 0, cls: 'border-primary-500/30 bg-primary-500/5 text-primary-400' },
                    { label: 'Resolved', value: subDeptStats?.resolved || 0, cls: 'border-success-500/30 bg-success-500/5 text-success-400' },
                    { label: 'Escalated', value: subDeptStats?.escalated || 0, cls: 'border-danger-500/30 bg-danger-500/5 text-danger-400' },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl p-3 border ${s.cls}`}>
                      <p className="text-[9px] uppercase tracking-widest font-bold opacity-60">{s.label}</p>
                      <p className="text-xl font-black mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Performance Bar */}
                {(subDeptStats?.total || 0) > 0 && (
                  <div className="mb-6 glass-card p-4 border border-white/5">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-3">Resolution Rate</p>
                    <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-success-500 to-success-400 transition-all duration-500"
                        style={{ width: `${Math.round(((subDeptStats?.resolved || 0) / (subDeptStats?.total || 1)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-white/50 mt-2">
                      {Math.round(((subDeptStats?.resolved || 0) / (subDeptStats?.total || 1)) * 100)}% resolved
                      <span className="text-white/30"> • {subDeptStats?.resolved || 0} of {subDeptStats?.total || 0} complaints</span>
                    </p>
                  </div>
                )}

                {/* Complaints Table */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-3">Assigned Complaints</p>
                  {subDeptComplaints.length === 0 ? (
                    <div className="text-center py-8 text-white/30 text-sm">No complaints assigned to this sub-department</div>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-white/5">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/5 bg-white/[0.02]">
                            {['ID', 'Description', 'Status', 'Priority', 'Date', 'Last Update'].map((h) => (
                              <th key={h} className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-white/30 font-semibold">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {subDeptComplaints.slice(0, 20).map((c: any, i: number) => (
                            <tr key={c._id || i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                              <td className="px-3 py-2 text-[10px] font-mono text-primary-400">
                                #{(c.complaintId || c._id || '').toString().slice(-6)}
                              </td>
                              <td className="px-3 py-2 text-xs text-white/60 max-w-[200px] truncate">{c.description}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                                  c.status === 'RESOLVED' ? 'bg-success-500/15 text-success-400' :
                                  c.status === 'IN_PROGRESS' ? 'bg-primary-500/15 text-primary-400' :
                                  c.status === 'ESCALATED' ? 'bg-danger-500/15 text-danger-400' :
                                  c.status === 'REJECTED' ? 'bg-danger-500/15 text-danger-400' :
                                  'bg-warning-500/15 text-warning-400'
                                }`}>{c.status}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold ${
                                  c.priority === 'HIGH' || c.priority === 'CRITICAL' ? 'bg-danger-500/15 text-danger-400' :
                                  c.priority === 'MEDIUM' ? 'bg-warning-500/15 text-warning-400' :
                                  'bg-white/10 text-white/50'
                                }`}>{c.priority}</span>
                              </td>
                              <td className="px-3 py-2 text-[10px] text-white/40">
                                {new Date(c.createdAt).toLocaleDateString()}
                              </td>
                              <td className="px-3 py-2 text-[10px] text-white/40 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(c.updatedAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {subDeptComplaints.length > 20 && (
                        <div className="px-3 py-2 text-[10px] text-white/30 text-center border-t border-white/5">
                          Showing 20 of {subDeptComplaints.length} complaints
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Recent Activity / Notes */}
                {subDeptComplaints.some((c: any) => c.notes && c.notes.length > 0) && (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-white/30 mb-3">Recent Activity</p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar">
                      {subDeptComplaints
                        .flatMap((c: any) => (c.notes || []).map((n: any) => ({ ...n, complaintId: c.complaintId || c._id })))
                        .sort((a: any, b: any) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
                        .slice(0, 15)
                        .map((note: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 py-2 px-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <ChevronRight className="w-3 h-3 text-primary-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white/60 truncate">{note.text}</p>
                              <p className="text-[9px] text-white/25 mt-0.5">
                                {note.addedBy} • #{(note.complaintId || '').toString().slice(-6)} • {new Date(note.addedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-6 mt-4 border-t border-white/5">
              <button onClick={() => { setViewingSubDept(null); setSubDeptComplaints([]); setSubDeptStats(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm">Close</button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
