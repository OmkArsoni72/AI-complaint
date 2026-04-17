'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Clock, CheckCircle2, AlertTriangle, FileText,
  MapPin, User, UploadCloud, Send, ArrowUpRight, Activity,
  TrendingUp, Calendar, MessageSquare, X, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  PENDING: { label: 'Awaiting Action', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: Clock },
  IN_PROGRESS: { label: 'Work In Progress', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', icon: Activity },
  UNDER_REVIEW: { label: 'Under Review', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', icon: FileText },
  RESOLVED: { label: 'Resolved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
  ESCALATED: { label: 'Escalated', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  HIGH: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  CRITICAL: { color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  MEDIUM: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  LOW: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

export default function SubDepartmentDashboard() {
  const { user, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  
  const [complaints, setComplaints] = useState<any[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState('IN_PROGRESS');
  const [remarks, setRemarks] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const res = await api.getOfficerComplaints();
      if (res.success) setComplaints(res.data as any[]);
    };
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, refreshKey]);

  const stats = useMemo(() => {
    return complaints.reduce(
      (acc: any, c: any) => {
        const s = (c?.status || 'PENDING').toString().toUpperCase();
        acc.total += 1;
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      },
      { total: 0, PENDING: 0, IN_PROGRESS: 0, UNDER_REVIEW: 0, RESOLVED: 0, ESCALATED: 0 }
    );
  }, [complaints]);

  const filteredList = useMemo(() => {
    switch (activeTab) {
      case 'pending': return complaints.filter(c => c.status === 'PENDING');
      case 'active': return complaints.filter(c => ['IN_PROGRESS', 'UNDER_REVIEW'].includes(c.status));
      case 'resolved': return complaints.filter(c => c.status === 'RESOLVED');
      default: return []; // We don't render lists in overview generally
    }
  }, [complaints, activeTab]);

  const handleAccept = async (c: any) => {
    const id = c.complaintId || c._id;
    const res = await api.updateOfficerComplaintStatus(id, 'IN_PROGRESS', 'Complaint accepted, work initiated');
    if (!res.success) return toast.error(res.message || 'Failed');
    toast.success('✅ Complaint accepted! Work started.');
    setRefreshKey(k => k + 1);
  };

  const handleStatusUpdate = async () => {
    if (!selectedComplaint) return;
    setIsUpdating(true);
    const id = selectedComplaint.complaintId || selectedComplaint._id;
    const res = await api.updateOfficerComplaintStatus(id, updateStatus, remarks || undefined, proofFileName || undefined);
    if (!res.success) {
      toast.error(res.message || 'Failed to update');
      setIsUpdating(false);
      return;
    }
    toast.success(updateStatus === 'RESOLVED' ? '🎉 Complaint resolved!' : '📋 Status updated!');
    setSelectedComplaint(null);
    setRemarks('');
    setProofFileName('');
    setIsUpdating(false);
    setRefreshKey(k => k + 1);
  };

  const handleEscalate = async () => {
    if (!selectedComplaint) return;
    setIsUpdating(true);
    const id = selectedComplaint.complaintId || selectedComplaint._id;
    const res = await api.updateOfficerComplaintStatus(id, 'ESCALATED', remarks || 'Escalated to admin for higher authority intervention');
    if (!res.success) {
      toast.error(res.message || 'Failed to escalate');
      setIsUpdating(false);
      return;
    }
    toast.success('⚠️ Escalated to Admin successfully');
    setSelectedComplaint(null);
    setRemarks('');
    setIsUpdating(false);
    setRefreshKey(k => k + 1);
  };

  const resolvedPercent = stats.total > 0 ? Math.round((stats.RESOLVED / stats.total) * 100) : 0;

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── SCENARIO 1: OVERVIEW TAB ─── */}
      {activeTab === 'overview' && (
        <>
          <div className="relative rounded-2xl overflow-hidden p-6 lg:p-8 border border-white/[0.06] bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-950/90 shadow-xl">
            <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/8 rounded-full blur-3xl -mr-24 -mt-24"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/6 rounded-full blur-3xl -ml-16 -mb-16"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-white uppercase tracking-tight">
                      Field Operations Desk
                    </h1>
                    <p className="text-xs text-white/40 font-medium mt-0.5">
                      {user?.department || 'Sub-Department'} • Assigned Grievance Work
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Performance</p>
                  <p className="text-2xl font-black text-white">{resolvedPercent}%</p>
                </div>
                <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <TrendingUp className={`w-5 h-5 ${resolvedPercent >= 50 ? 'text-emerald-400' : 'text-amber-400'}`} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total Assigned', value: stats.total, icon: FileText, gradient: 'from-slate-500/20 to-slate-600/10', text: 'text-white', border: 'border-white/10' },
              { label: 'Awaiting Action', value: stats.PENDING, icon: Clock, gradient: 'from-amber-500/20 to-amber-600/10', text: 'text-amber-400', border: 'border-amber-500/20' },
              { label: 'In Progress', value: stats.IN_PROGRESS + (stats.UNDER_REVIEW || 0), icon: Activity, gradient: 'from-sky-500/20 to-sky-600/10', text: 'text-sky-400', border: 'border-sky-500/20' },
              { label: 'Completed', value: stats.RESOLVED, icon: CheckCircle2, gradient: 'from-emerald-500/20 to-emerald-600/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
              { label: 'Escalated', value: stats.ESCALATED, icon: AlertTriangle, gradient: 'from-rose-500/20 to-rose-600/10', text: 'text-rose-400', border: 'border-rose-500/20' },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`rounded-xl p-4 border ${s.border} bg-gradient-to-br ${s.gradient} backdrop-blur-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className={`w-4 h-4 ${s.text} opacity-60`} />
                    <span className={`text-2xl font-black ${s.text}`}>{s.value}</span>
                  </div>
                  <p className="text-[9px] uppercase tracking-[0.15em] font-bold text-white/30">{s.label}</p>
                </motion.div>
              );
            })}
          </div>

          {complaints.filter(c => c.status === 'PENDING').length > 0 && (
            <div className="relative rounded-xl overflow-hidden p-4 border border-amber-500/20 bg-gradient-to-r from-amber-950/40 via-slate-900/60 to-slate-950/80">
              <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -ml-10 -mt-10"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-300 uppercase tracking-tight">New Work Assigned by Admin</h3>
                    <p className="text-[10px] text-amber-400/50">{complaints.filter(c => c.status === 'PENDING').length} task(s) awaiting your action in the pending tab.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── SCENARIO 2: ALL OTHER LIST TABS ─── */}
      {activeTab !== 'overview' && (
        <div className="space-y-3">
          <div className="mb-4">
            <h2 className="text-xl font-extrabold text-white capitalize">{activeTab === 'pending' ? 'Tasks Awaiting Action' : activeTab === 'active' ? 'Work In Progress' : 'Completed Work'}</h2>
            <p className="text-xs text-white/40 mt-1">Select a task to review details or update its status.</p>
          </div>

          {filteredList.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-white/5 bg-white/[0.01]">
              <Briefcase className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/25">No complaints in this category</p>
            </div>
          ) : (
            filteredList.map((c: any, i: number) => {
            const statusConf = STATUS_CONFIG[c.status] || STATUS_CONFIG.PENDING;
            const priorityConf = PRIORITY_CONFIG[c.priority] || PRIORITY_CONFIG.MEDIUM;
            const StatusIcon = statusConf.icon;
            const slaRemaining = c.slaDeadline ? new Date(c.slaDeadline).getTime() - Date.now() : null;
            const isOverdue = slaRemaining !== null && slaRemaining < 0;
            const slaHours = slaRemaining ? Math.max(0, Math.floor(slaRemaining / (1000 * 60 * 60))) : null;

            return (
              <motion.div
                key={c._id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`rounded-xl border bg-white/[0.015] hover:bg-white/[0.03] transition-all cursor-pointer group ${
                  c.status === 'PENDING' ? 'border-amber-500/20' :
                  c.status === 'RESOLVED' ? 'border-emerald-500/10' :
                  c.status === 'ESCALATED' ? 'border-rose-500/20' :
                  'border-white/[0.06]'
                }`}
                onClick={() => {
                  setSelectedComplaint(c);
                  setUpdateStatus(c.status === 'PENDING' ? 'IN_PROGRESS' : c.status);
                  setRemarks('');
                  setProofFileName(c.proofFileName || '');
                }}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Complaint ID */}
                      <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/15 flex-shrink-0">
                        #{(c.complaintId || c._id || '').toString().slice(-6)}
                      </span>
                      {/* Description */}
                      <p className="text-sm text-white/80 font-medium truncate">{c.description}</p>
                    </div>
                    {/* Priority */}
                    <span className={`text-[9px] px-2 py-1 rounded-lg border font-bold flex-shrink-0 ${priorityConf.bg} ${priorityConf.color}`}>
                      {c.priority}
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-4 mt-2">
                    {/* Simplified Status */}
                    <span className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold ${statusConf.bg} ${statusConf.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConf.label}
                    </span>
                    {/* Clean Location */}
                    <span className="text-[12px] text-white/50 font-medium">
                      📍 {c.location?.area || 'Unknown Location'}
                    </span>
                    {/* Clean Category */}
                    <span className="text-[12px] text-white/40">
                      📂 {c.category}
                    </span>
                    
                    {/* SLA (Only show if not resolved) */}
                    {c.status !== 'RESOLVED' && slaRemaining !== null && (
                      <span className={`ml-auto text-[11px] font-black uppercase px-2 py-1 rounded ${isOverdue ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-500/20 text-slate-300'}`}>
                        {isOverdue ? '⚠️ Overdue' : `⏱️ ${slaHours} Hrs Left`}
                      </span>
                    )}

                    {c.status === 'RESOLVED' && (
                       <span className="ml-auto text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded">
                         ✅ Completed on {new Date(c.resolvedAt || c.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                       </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
      )}

      {/* ─── Action Modal ─── */}
      <AnimatePresence>
        {selectedComplaint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-xl my-auto rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="p-6">
                {/* Modal Header */}
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                        #{(selectedComplaint.complaintId || selectedComplaint._id || '').toString().slice(-6)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold ${(PRIORITY_CONFIG[selectedComplaint.priority] || PRIORITY_CONFIG.MEDIUM).bg} ${(PRIORITY_CONFIG[selectedComplaint.priority] || PRIORITY_CONFIG.MEDIUM).color}`}>
                        {selectedComplaint.priority}
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white leading-tight">{selectedComplaint.description}</h2>
                  </div>
                  <button onClick={() => setSelectedComplaint(null)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors flex-shrink-0">
                    <X className="w-4 h-4 text-white/60" />
                  </button>
                </div>

                {/* Complaint Info */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Citizen', value: selectedComplaint.userName || 'Anonymous', icon: User },
                    { label: 'Location', value: `${selectedComplaint.location?.area || '—'}, ${selectedComplaint.location?.district || ''}`, icon: MapPin },
                    { label: 'Category', value: selectedComplaint.category, icon: FileText },
                    { label: 'Filed On', value: new Date(selectedComplaint.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), icon: Calendar },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3 h-3 text-indigo-400/60" />
                          <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">{item.label}</p>
                        </div>
                        <p className="text-xs text-white/70 font-medium truncate">{item.value}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Notes from Admin */}
                {selectedComplaint.notes && selectedComplaint.notes.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[10px] uppercase tracking-widest text-white/25 font-bold mb-2 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> Admin Notes & Updates
                    </p>
                    <div className="space-y-1.5 max-h-[140px] overflow-y-auto custom-scrollbar">
                      {selectedComplaint.notes.slice(-5).reverse().map((n: any, i: number) => (
                        <div key={i} className="bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2">
                          <p className="text-xs text-white/55">{n.text}</p>
                          <p className="text-[9px] text-white/20 mt-0.5">{n.addedBy} • {new Date(n.addedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Panel */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 space-y-4">
                  <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-indigo-400" /> Update Work Status
                  </h3>

                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase mb-1.5">Set Status</label>
                    <select
                      value={updateStatus}
                      onChange={(e) => setUpdateStatus(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="IN_PROGRESS">🔧 In Progress — Work initiated</option>
                      <option value="UNDER_REVIEW">🔍 Under Review — Awaiting verification</option>
                      <option value="RESOLVED">✅ Resolved — Issue fixed</option>
                      <option value="ESCALATED">🚨 Escalated — Needs higher authority</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase mb-1.5">Work Remarks / Update</label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Team dispatched, pothole filled, road repaired..."
                      className="input-field text-sm min-h-[80px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-white/30 uppercase mb-1.5">Attach Proof</label>
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] text-xs text-white/50 transition-colors">
                      <UploadCloud className="w-4 h-4 text-indigo-400" />
                      <span>{proofFileName || 'Upload photo or document'}</span>
                      <input type="file" className="hidden" onChange={(e) => setProofFileName(e.target.files?.[0]?.name || '')} />
                    </label>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={handleStatusUpdate}
                      disabled={isUpdating}
                      className="flex-1 px-4 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {isUpdating ? 'Updating...' : updateStatus === 'RESOLVED' ? 'Mark Resolved' : 'Submit Update'}
                    </button>
                    {selectedComplaint.status !== 'ESCALATED' && (
                      <button
                        onClick={handleEscalate}
                        disabled={isUpdating}
                        className="px-4 py-2.5 rounded-xl font-bold text-sm border border-rose-500/30 text-rose-400 bg-rose-500/5 hover:bg-rose-500/15 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                        Escalate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
