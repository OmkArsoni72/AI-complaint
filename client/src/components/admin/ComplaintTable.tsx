'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Clock, ArrowUpDown, Filter, User, Settings, X, Save, Search, UploadCloud } from 'lucide-react';
import { PRIORITY_COLORS, STATUS_COLORS, CATEGORY_ICONS } from '@/lib/constants';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Complaint {
  complaintId: string;
  description: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'REJECTED';
  department: string;
  assignedOfficerName: string | null;
  assignedOfficer?: string;
  assignedTo?: string;
  slaDeadline: string;
  location: { area: string; district: string };
  createdAt: string;
  userName: string;
  _id?: string;
  lastRemark?: string;
  proofFileName?: string;
}

interface OfficerOption {
  id: string;
  name: string;
  department?: string;
}

interface SubDepartmentOption {
  _id: string;
  name: string;
}

function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function SLABadge({ deadline, now }: { deadline: string; now: number }) {
  const remaining = new Date(deadline).getTime() - now;
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));
  const isOverdue = remaining < 0;
  const isUrgent = remaining > 0 && remaining < 2 * 60 * 60 * 1000;

  return (
    <span
      className={`text-[11px] font-mono ${
        isOverdue
          ? 'text-danger-400'
          : isUrgent
          ? 'text-warning-400'
          : 'text-white/50'
      }`}
    >
      {isOverdue ? 'OVERDUE' : `${hours}h ${mins}m`}
    </span>
  );
}

export default function ComplaintTable({
  complaints,
  officers = [],
  subDepartments = [],
}: {
  complaints: Complaint[];
  officers?: OfficerOption[];
  subDepartments?: SubDepartmentOption[];
}) {
  const [filter, setFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'createdAt' | 'priority'>('createdAt');
  const [localComplaints, setLocalComplaints] = useState<Complaint[]>([]);
  const [viewingComplaint, setViewingComplaint] = useState<Complaint | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [subDepartmentId, setSubDepartmentId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const now = useNow(60000);

  const getDisplayStatus = (c: Complaint) => {
    const isOverdue = new Date(c.slaDeadline).getTime() < now && c.status !== 'RESOLVED' && c.status !== 'REJECTED';
    return isOverdue ? 'ESCALATED' : c.status;
  };

  useEffect(() => {
    if (!viewingComplaint) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [viewingComplaint]);

  // Sync parent props
  useEffect(() => {
    setLocalComplaints(complaints || []);
  }, [complaints]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const nowDate = new Date();
    const startsAt = (() => {
      if (dateFilter === 'TODAY') {
        const d = new Date(nowDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }
      if (dateFilter === 'LAST_7_DAYS') {
        return nowDate.getTime() - 7 * 24 * 60 * 60 * 1000;
      }
      if (dateFilter === 'LAST_30_DAYS') {
        return nowDate.getTime() - 30 * 24 * 60 * 60 * 1000;
      }
      return null;
    })();

    return localComplaints
      .filter((c) => filter === 'ALL' || getDisplayStatus(c) === filter)
      .filter((c) => priorityFilter === 'ALL' || c.priority === priorityFilter)
      .filter((c) => (startsAt === null ? true : new Date(c.createdAt).getTime() >= startsAt))
      .filter((c) => {
        if (!term) return true;
        const hay = [
          c.complaintId,
          c.description,
          c.category,
          c.location?.area,
          c.location?.district,
          c.assignedOfficerName,
          c.userName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      })
      .sort((a, b) => {
        if (sortBy === 'priority') {
          const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
          return order[a.priority] - order[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [dateFilter, filter, now, priorityFilter, localComplaints, searchTerm, sortBy]);

  const getAssignedLabel = (c: Complaint) => {
    if (c.assignedOfficerName) return c.assignedOfficerName;
    if (c.assignedOfficer && c.assignedOfficer !== 'Unassigned') return 'Assigned';
    if (c.assignedTo) return 'Assigned';
    return '—';
  };

  const filters = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'REJECTED'];
  const priorityOptions = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
  const dateOptions = [
    { value: 'ALL', label: 'All Dates' },
    { value: 'TODAY', label: 'Today' },
    { value: 'LAST_7_DAYS', label: 'Last 7 Days' },
    { value: 'LAST_30_DAYS', label: 'Last 30 Days' },
  ];
  const officerOptions = officers.map((o) => ({ id: o.id, name: o.name }));
  const subDepartmentOptions = subDepartments.map((s) => ({ id: s._id, name: s.name }));

  const handleAccept = async (target: Complaint) => {
    const id = target._id || target.complaintId;
    const res = await api.acceptAdminComplaint(id.toString());
    if (!res.success) {
      toast.error(res.message || 'Failed to accept complaint');
      return;
    }
    setLocalComplaints((prev) =>
      prev.map((c) =>
        (c._id || c.complaintId) === id
          ? { ...c, status: 'IN_PROGRESS' }
          : c
      )
    );
    setViewingComplaint((prev) =>
      prev && (prev._id || prev.complaintId) === id ? { ...prev, status: 'IN_PROGRESS' } : prev
    );
    setUpdateStatus('IN_PROGRESS');
    toast.success('Complaint accepted');
  };

  const handleUpdate = async () => {
    if (!viewingComplaint) return;
    setIsUpdating(true);
    try {
      const id = viewingComplaint._id || viewingComplaint.complaintId;
      let updatedComplaint: Complaint | null = null;
      let currentStatus = viewingComplaint.status;

      if (subDepartmentId) {
        const subRes = await api.assignSubDepartment(id.toString(), subDepartmentId);
        if (!subRes.success) throw new Error(subRes.message || 'Sub-department assign failed');
        updatedComplaint = subRes.data as Complaint;
        currentStatus = updatedComplaint.status;
      }

      if (!subDepartmentId && assigneeId && assigneeId !== viewingComplaint.assignedOfficer) {
        const assignRes = await api.assignAdminComplaint(id.toString(), assigneeId);
        if (!assignRes.success) throw new Error(assignRes.message || 'Assign failed');
        updatedComplaint = assignRes.data as Complaint;
      }

      if (updateStatus && updateStatus !== currentStatus) {
        const statusRes = await api.updateAdminComplaintStatus(id.toString(), updateStatus, remarks || undefined);
        if (!statusRes.success) throw new Error(statusRes.message || 'Status update failed');
        updatedComplaint = statusRes.data as Complaint;
      } else if (remarks) {
        const remarkRes = await api.addAdminComplaintRemark(id.toString(), remarks);
        if (!remarkRes.success) throw new Error(remarkRes.message || 'Remark failed');
        updatedComplaint = remarkRes.data as Complaint;
      }

      if (updatedComplaint) {
        setLocalComplaints((prev) =>
          prev.map((c) =>
            (c._id || c.complaintId) === id
              ? {
                  ...c,
                  ...updatedComplaint,
                  proofFileName: proofFileName || c.proofFileName,
                }
              : c
          )
        );
      }

      toast.success('Action saved');
      setViewingComplaint(null);
    } catch (err) {
      toast.error('Failed to update system.');
    }
    setIsUpdating(false);
  };

  const handleReject = async (target: Complaint) => {
    const reason = rejectReason.trim();
    if (!reason) {
      toast.error('Rejection reason is required');
      return;
    }
    const id = target._id || target.complaintId;
    const res = await api.rejectAdminComplaint(id.toString(), reason);
    if (!res.success) {
      toast.error(res.message || 'Failed to reject complaint');
      return;
    }
    setLocalComplaints((prev) =>
      prev.map((c) => ((c._id || c.complaintId) === id ? { ...c, ...(res.data as any), status: 'REJECTED' } : c))
    );
    setViewingComplaint(null);
    setRejectReason('');
    toast.success('Complaint rejected with reason');
  };

  return (
    <div className="glass-card overflow-hidden relative">
      {/* Toolbar */}
      <div className="p-4 border-b border-white/5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-white/40" />
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                  filter === f
                    ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                    : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                }`}
              >
                {f === 'ALL' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Priority</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter complaints by priority"
              className="input-field py-1 text-xs h-8"
            >
              {priorityOptions.map((p) => (
                <option key={p} value={p}>
                  {p === 'ALL' ? 'All' : p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-white/30">Date</span>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter complaints by date"
              className="input-field py-1 text-xs h-8"
            >
              {dateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full lg:w-[260px]">
            <Search className="w-4 h-4 text-white/30 absolute left-3 top-2.5" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search complaints"
              className="input-field pl-9 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setSortBy(sortBy === 'createdAt' ? 'priority' : 'createdAt')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort by {sortBy === 'createdAt' ? 'Date' : 'Priority'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['ID', 'Category', 'User', 'Location', 'Priority', 'Status', 'Officer', 'Date/Time', 'SLA', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/30 font-semibold"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const priority = PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW;
              const displayStatus = getDisplayStatus(c);
              const isOverdue = displayStatus === 'ESCALATED';
              const status = STATUS_COLORS[displayStatus] || STATUS_COLORS.PENDING;
              return (
                <motion.tr
                  key={c.complaintId || (c as any)._id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    setViewingComplaint(c);
                    setUpdateStatus(c.status);
                    setAssigneeId(c.assignedOfficer && c.assignedOfficer !== 'Unassigned' ? c.assignedOfficer.toString() : '');
                    setRemarks(c.lastRemark || '');
                    setProofFileName(c.proofFileName || '');
                  }}
                  className={`border-b border-white/[0.03] cursor-pointer transition-colors ${
                    viewingComplaint && (viewingComplaint._id === c._id || viewingComplaint.complaintId === c.complaintId)
                      ? 'bg-primary-500/10'
                      : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-primary-400">
                      {(c.complaintId || (c as any)._id || 'N/A').toString().slice(0, 12)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{CATEGORY_ICONS[c.category] || '📋'}</span>
                      <span className="text-xs text-white/70 truncate max-w-[120px]">
                        {c.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/60 flex items-center gap-1">
                      <User className="w-3 h-3 text-white/40" />
                      {c.userName || 'Anonymous'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/50">{c.location.area}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`badge text-[10px] ${priority.bg} ${priority.text} border ${priority.border}`}
                    >
                      {c.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge text-[10px] ${status.bg} ${status.text}`}>
                      {status.label || displayStatus}
                    </span>
                    {isOverdue && (
                      <span className="ml-2 text-[10px] text-danger-400 font-semibold uppercase tracking-wide">
                        Escalated
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-white/50">
                      <span>{getAssignedLabel(c)}</span>
                      {c.assignedOfficerName && (
                        <span className="ml-2 text-[10px] text-primary-300 bg-primary-500/10 border border-primary-500/20 px-1.5 py-0.5 rounded">
                          Sub-Dept
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-white/40 font-mono">
                      {new Date(c.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-white/20" />
                      <SLABadge deadline={c.slaDeadline} now={now} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {c.status === 'PENDING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAccept(c);
                          }}
                          className="px-2 py-1 text-[10px] rounded-md bg-primary-500/20 text-primary-300 border border-primary-500/30"
                        >
                          Accept
                        </button>
                      )}
                      {c.status === 'PENDING' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingComplaint(c);
                            setRejectReason('Wrong department or duplicate complaint');
                          }}
                          className="px-2 py-1 text-[10px] rounded-md bg-slate-500/20 text-slate-200 border border-slate-400/30"
                        >
                          Reject
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingComplaint(c);
                          setUpdateStatus(c.status);
                          setAssigneeId(c.assignedOfficer && c.assignedOfficer !== 'Unassigned' ? c.assignedOfficer.toString() : '');
                          setSubDepartmentId('');
                          setRemarks(c.lastRemark || '');
                          setProofFileName(c.proofFileName || '');
                        }}
                        className="px-2 py-1 text-[10px] rounded-md bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-white/20 text-sm">
            No complaints found
          </div>
        )}
      </div>

      {viewingComplaint && createPortal(
        <div className="fixed inset-0 z-[220] overflow-y-auto">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setViewingComplaint(null)}
          />
          <div className="relative min-h-full flex items-start justify-center pt-2 sm:pt-4 pb-4 px-2 sm:px-4">
          <motion.div
            initial={{ y: -50, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="relative w-full max-w-2xl bg-slate-950/95 border border-white/10 shadow-2xl rounded-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-mono text-primary-400 bg-primary-500/10 px-2 py-0.5 rounded">
                      #{(viewingComplaint.complaintId || viewingComplaint._id || '').slice(-6)}
                    </span>
                    <span className={`badge text-[10px] ${(PRIORITY_COLORS[viewingComplaint.priority] || PRIORITY_COLORS.LOW).bg} ${(PRIORITY_COLORS[viewingComplaint.priority] || PRIORITY_COLORS.LOW).text}`}>
                      {viewingComplaint.priority} PRIORITY
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {viewingComplaint.description}
                  </h2>
                </div>
                <button aria-label="Close complaint details" onClick={() => setViewingComplaint(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors flex-shrink-0">
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Reported By</p>
                  <p className="text-sm text-white font-medium flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-primary-400" />
                    {viewingComplaint.userName || 'Anonymous'}
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Reported At</p>
                  <p className="text-sm text-white font-medium flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary-400" />
                    {new Date(viewingComplaint.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    })} {new Date(viewingComplaint.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Department</p>
                  <p className="text-sm text-white font-medium">{viewingComplaint.department}</p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Location</p>
                  <p className="text-sm text-white font-medium">{viewingComplaint.location.area}, {viewingComplaint.location.district}</p>
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10 mb-6">
                <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Assigned To</p>
                <p className="text-sm text-white font-medium">
                  {getAssignedLabel(viewingComplaint)}
                </p>
              </div>

              {/* Action Panel */}
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wide">
                  <Settings className="w-4 h-4 text-accent-400" /> Assignment & Status Panel
                </h3>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Assign Sub-Department</label>
                  <select
                    value={subDepartmentId}
                    onChange={(e) => {
                      setSubDepartmentId(e.target.value);
                      if (updateStatus === 'PENDING') {
                        setUpdateStatus('IN_PROGRESS');
                      }
                    }}
                    aria-label="Assign complaint to sub-department"
                    className="input-field py-2 text-sm"
                  >
                    <option value="">Select sub-department</option>
                    {subDepartmentOptions.map((sub) => (
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Update Status</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    aria-label="Update complaint status"
                    className="input-field py-2 text-sm"
                  >
                    <option value="PENDING">Pending (Unassigned)</option>
                    <option value="IN_PROGRESS">In Progress (Worker Dispatched)</option>
                    <option value="RESOLVED">Resolved (Issue Fixed)</option>
                    <option value="ESCALATED">Escalated (Requires higher authority)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Resolution Remarks / Notes to Citizen</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="e.g. Pipeline repaired, water connection restored."
                    className="input-field text-sm min-h-[80px]"
                  />
                </div>

                {viewingComplaint.status === 'PENDING' && (
                  <div>
                    <label className="block text-xs text-white/60 mb-1">Reject Reason (mandatory for reject)</label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. wrong department, duplicate complaint"
                      className="input-field text-sm min-h-[68px]"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-white/60 mb-1">Upload Proof</label>
                  <label className="flex items-center gap-3 px-3 py-2 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 text-xs text-white/60">
                    <UploadCloud className="w-4 h-4 text-primary-300" />
                    <span>{proofFileName || 'Upload image or file'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setProofFileName(e.target.files?.[0]?.name || '')}
                    />
                  </label>
                </div>

                <div className="pt-2">
                  {viewingComplaint.status === 'PENDING' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                      <button
                        onClick={() => handleAccept(viewingComplaint)}
                        className="w-full px-4 py-2.5 rounded-xl border border-primary-500/40 text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 transition-colors"
                      >
                        Accept Complaint
                      </button>
                      <button
                        onClick={() => handleReject(viewingComplaint)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-400/40 text-slate-200 bg-slate-500/10 hover:bg-slate-500/20 transition-colors"
                      >
                        Reject with Reason
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateStatus === 'RESOLVED' ? 'Mark as Resolved & Notify Citizen' : 'Update & Assign'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
