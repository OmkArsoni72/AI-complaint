'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, AlertCircle, FileText, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface Complaint {
  _id: string;
  complaintId: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  location: { area: string; district: string };
  slaDeadline?: string;
  createdAt: string;
  proofFileName?: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  UNDER_REVIEW: 'Under Review',
  RESOLVED: 'Resolved',
  ESCALATED: 'Escalated',
};

const PRIORITY_BADGE: Record<string, string> = {
  HIGH: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  LOW: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

function SLATimer({ deadline }: { deadline?: string }) {
  if (!deadline) return <span className="text-xs text-white/40">No SLA</span>;
  const remaining = new Date(deadline).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));
  const isOverdue = remaining < 0;
  return (
    <span className={`text-xs ${isOverdue ? 'text-danger-400' : 'text-white/50'}`}>
      {isOverdue ? 'Overdue' : `${hours}h ${mins}m`}
    </span>
  );
}

export default function OfficerComplaintTable({ complaints }: { complaints: Complaint[] }) {
  const [filter, setFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [updateStatus, setUpdateStatus] = useState('IN_PROGRESS');
  const [remarks, setRemarks] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const filtered = useMemo(() => {
    return complaints
      .filter((c) => filter === 'ALL' || (c.status || '').toUpperCase() === filter)
      .filter((c) => priorityFilter === 'ALL' || c.priority === priorityFilter);
  }, [complaints, filter, priorityFilter]);

  const openModal = (c: Complaint) => {
    setSelected(c);
    setUpdateStatus((c.status || 'IN_PROGRESS').toUpperCase());
    setRemarks('');
    setProofFileName(c.proofFileName || '');
  };

  const handleAccept = async (c: Complaint) => {
    const id = c.complaintId || c._id;
    const res = await api.updateOfficerComplaintStatus(id, 'IN_PROGRESS');
    if (!res.success) return toast.error(res.message || 'Failed to accept');
    toast.success('Complaint accepted');
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setIsUpdating(true);
    const id = selected.complaintId || selected._id;
    const res = await api.updateOfficerComplaintStatus(id, updateStatus, remarks || undefined, proofFileName || undefined);
    if (!res.success) {
      toast.error(res.message || 'Failed to update');
      setIsUpdating(false);
      return;
    }
    toast.success('Update sent');
    setSelected(null);
    setIsUpdating(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {['ALL', 'PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs rounded-lg border transition-all ${
              filter === s ? 'bg-primary-500/20 text-primary-300 border-primary-500/30' : 'text-white/40 border-white/10 hover:text-white/70'
            }`}
          >
            {s === 'ALL' ? 'All' : STATUS_LABELS[s] || s}
          </button>
        ))}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="input-field py-1 text-xs h-8"
        >
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((p) => (
            <option key={p} value={p}>{p === 'ALL' ? 'All Priority' : p}</option>
          ))}
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['ID', 'Description', 'Location', 'Priority', 'Status', 'SLA', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <motion.tr
                key={c.complaintId || c._id || i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-white/[0.03]"
              >
                <td className="px-4 py-3 text-xs text-primary-400 font-mono">#{(c.complaintId || c._id).toString().slice(-6)}</td>
                <td className="px-4 py-3 text-xs text-white/70 max-w-[220px] truncate">{c.description}</td>
                <td className="px-4 py-3 text-xs text-white/50">{c.location?.area}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded border ${PRIORITY_BADGE[c.priority] || PRIORITY_BADGE.MEDIUM}`}>
                    {c.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/60">{STATUS_LABELS[(c.status || '').toUpperCase()] || c.status}</td>
                <td className="px-4 py-3"><SLATimer deadline={c.slaDeadline} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {c.status === 'PENDING' && (
                      <button
                        onClick={() => handleAccept(c)}
                        className="px-2 py-1 text-[10px] rounded-md bg-primary-500/20 text-primary-300 border border-primary-500/30"
                      >
                        Accept
                      </button>
                    )}
                    <button
                      onClick={() => openModal(c)}
                      className="px-2 py-1 text-[10px] rounded-md bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                    >
                      Update
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-white/30 text-sm">No assigned complaints</div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[220] overflow-y-auto">
          <div className="absolute inset-0 bg-black/70" onClick={() => setSelected(null)} />
          <div className="relative min-h-full flex items-start justify-center pt-6 px-4">
            <div className="glass-card w-full max-w-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-400" /> Officer Action
                </h3>
                <button onClick={() => setSelected(null)} className="text-white/60">✕</button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Update Status</label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="ESCALATED">Escalated</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Remarks</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="input-field text-sm min-h-[80px]"
                    placeholder="team dispatched, work started..."
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Upload Proof</label>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 cursor-pointer text-xs text-white/60">
                    <UploadCloud className="w-4 h-4 text-primary-300" />
                    <span>{proofFileName || 'Upload image or file'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => setProofFileName(e.target.files?.[0]?.name || '')}
                    />
                  </label>
                </div>
                <button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="w-full btn-primary py-2.5 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isUpdating ? 'Updating...' : 'Submit Update'}
                </button>
                <button
                  onClick={() => {
                    setUpdateStatus('ESCALATED');
                    setRemarks('');
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-danger-500/40 text-danger-300 bg-danger-500/10 hover:bg-danger-500/20"
                >
                  <AlertCircle className="w-4 h-4 inline-block mr-2" />
                  Escalate to Admin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
