'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, Building2, User, AlertTriangle, Shield, Gauge,
  MessageSquare, ThumbsUp, ThumbsDown, ArrowLeft, FileText, Send,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PRIORITY_COLORS, CATEGORY_ICONS, STATUS_COLORS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [complaint, setComplaint] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    const fetchComplaint = async () => {
      const id = params.id as string;
      const res: any = await api.getComplaint(id);
      if (res.success) setComplaint(res.data);
      setLoading(false);
    };
    fetchComplaint();
  }, [params.id]);

  const handleFeedback = async (satisfied: boolean) => {
    setSubmittingFeedback(true);
    const res = await api.addFeedback(complaint.complaintId, satisfied, feedbackComment);
    if (res.success) {
      setComplaint(res.data);
      toast.success(satisfied ? 'Thank you for your feedback!' : 'Complaint re-escalated to higher authority');
    }
    setSubmittingFeedback(false);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    const res = await api.updateStatus(complaint.complaintId, newStatus);
    if (res.success) {
      setComplaint(res.data);
      toast.success(`Status updated to ${newStatus}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-white/40">
        <p className="text-lg mb-2">Complaint not found</p>
        <button onClick={() => router.back()} className="btn-primary mt-4">Go Back</button>
      </div>
    );
  }

  const priorityColor = PRIORITY_COLORS[complaint.priority as keyof typeof PRIORITY_COLORS];
  const statusColor = STATUS_COLORS[complaint.status as keyof typeof STATUS_COLORS];
  const icon = CATEGORY_ICONS[complaint.category as string] || 'GEN';
  const remaining = new Date(complaint.slaDeadline).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));

  const timeline = [
    { icon: 'SUB', label: 'Complaint Submitted', time: new Date(complaint.createdAt).toLocaleString(), done: true },
    { icon: 'CLS', label: `AI classified as ${complaint.category}`, time: 'Auto', done: true },
    { icon: 'RTE', label: `Routed to ${complaint.department}`, time: 'Auto', done: true },
    { icon: 'ASG', label: `Assigned to ${complaint.assignedOfficerName || 'Pending'}`, time: 'Auto', done: !!complaint.assignedOfficerName },
    { icon: 'IP', label: 'In Progress', time: complaint.status === 'IN_PROGRESS' || complaint.status === 'RESOLVED' ? 'Active' : 'Pending', done: ['IN_PROGRESS', 'RESOLVED'].includes(complaint.status) },
    { icon: 'RES', label: 'Resolved', time: complaint.resolvedAt ? new Date(complaint.resolvedAt).toLocaleString() : 'Pending', done: complaint.status === 'RESOLVED' },
  ];

  if (complaint.status === 'ESCALATED') {
    timeline.push({ icon: 'ESC', label: 'Escalated to Higher Authority', time: 'Active', done: true });
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isOwner = !user || user.role === 'PUBLIC';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-4">
      {/* Back Button */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-white/40 hover:text-white/60 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header Card */}
      <div className="glass-card p-6">
        <div className="flex items-start gap-4 mb-4">
          <span className="text-3xl">{icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-primary-400">{complaint.complaintId}</span>
              <span className={`badge text-[10px] ${priorityColor.bg} ${priorityColor.text} border ${priorityColor.border}`}>
                {complaint.priority}
              </span>
              <span className={`badge text-[10px] ${statusColor.bg} ${statusColor.text}`}>
                {statusColor.label}
              </span>
            </div>
            <p className="text-white/80">{complaint.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-white/30 uppercase mb-1">Category</p>
            <p className="text-sm text-white font-medium">{complaint.category}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase mb-1">Department</p>
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary-400" />
              <p className="text-sm text-white">{complaint.department}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase mb-1">Officer</p>
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-accent-400" />
              <p className="text-sm text-white">{complaint.assignedOfficerName || 'Pending'}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase mb-1">SLA Remaining</p>
            <div className={`flex items-center gap-1.5 ${remaining < 2 * 60 * 60 * 1000 ? 'text-danger-400' : 'text-warning-400'}`}>
              <Clock className="w-3.5 h-3.5" />
              <p className="text-sm font-mono font-bold">{remaining > 0 ? `${hours}h ${mins}m` : 'OVERDUE'}</p>
            </div>
          </div>
        </div>

        {/* Confidence */}
        {complaint.confidence && (
          <div className="mt-4 flex items-center gap-3">
            <Gauge className="w-4 h-4 text-primary-400" />
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${complaint.confidence * 100}%` }}
                transition={{ duration: 1 }}
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
              />
            </div>
            <span className="text-xs font-mono text-primary-400">{(complaint.confidence * 100).toFixed(0)}% confidence</span>
          </div>
        )}
      </div>

      {/* Admin Action Panel */}
      {isAdmin && complaint.status !== 'RESOLVED' && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary-400" /> Officer Actions
          </h3>
          <div className="flex gap-2 flex-wrap">
            {complaint.status === 'PENDING' && (
              <button onClick={() => handleStatusUpdate('IN_PROGRESS')} className="btn-primary text-sm py-2">
                Accept & Start Working
              </button>
            )}
            {complaint.status === 'IN_PROGRESS' && (
              <button onClick={() => handleStatusUpdate('RESOLVED')} className="px-4 py-2 bg-success-500/20 text-success-400 border border-success-500/30 rounded-xl text-sm font-medium hover:bg-success-500/30 transition-all">
                Mark as Resolved
              </button>
            )}
            {complaint.status !== 'ESCALATED' && (
              <button onClick={() => handleStatusUpdate('ESCALATED')} className="px-4 py-2 bg-danger-500/10 text-danger-400 border border-danger-500/20 rounded-xl text-sm font-medium hover:bg-danger-500/20 transition-all">
                Escalate
              </button>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-400" /> Complaint Timeline
        </h3>
        <div className="space-y-0">
          {timeline.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="flex items-center gap-4 relative"
            >
              {i < timeline.length - 1 && (
                <div className={`absolute left-[15px] top-8 w-[2px] h-6 ${step.done ? 'bg-success-500/30' : 'bg-white/5'}`} />
              )}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${step.done ? 'bg-success-500/20' : 'bg-white/5'}`}>
                <span className="text-sm">{step.icon}</span>
              </div>
              <div className="flex-1 py-3">
                <p className={`text-sm ${step.done ? 'text-white' : 'text-white/40'}`}>{step.label}</p>
                <p className="text-[10px] text-white/30">{step.time}</p>
              </div>
              {step.done && <CheckCircle2 className="w-4 h-4 text-success-400 flex-shrink-0" />}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {complaint.notes && complaint.notes.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-400" /> Officer Notes
          </h3>
          <div className="space-y-3">
            {complaint.notes.map((note: any, i: number) => (
              <div key={i} className="flex gap-3 p-3 bg-white/[0.02] rounded-lg">
                <User className="w-4 h-4 text-white/30 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-white/60">{note.text}</p>
                  <p className="text-[10px] text-white/20 mt-1">{note.addedBy} • {new Date(note.addedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Section (for resolved complaints owned by PUBLIC user) */}
      {complaint.status === 'RESOLVED' && isOwner && !complaint.feedback && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-success-400" /> How was the resolution?
          </h3>
          <textarea
            value={feedbackComment}
            onChange={(e) => setFeedbackComment(e.target.value)}
            className="input-field mb-4 h-20 resize-none"
            placeholder="Add your feedback (optional)..."
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleFeedback(true)}
              disabled={submittingFeedback}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-success-500/10 border border-success-500/20 text-success-400 rounded-xl text-sm font-medium hover:bg-success-500/20 transition-all disabled:opacity-50"
            >
              <ThumbsUp className="w-4 h-4" /> Satisfied
            </button>
            <button
              onClick={() => handleFeedback(false)}
              disabled={submittingFeedback}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-danger-500/10 border border-danger-500/20 text-danger-400 rounded-xl text-sm font-medium hover:bg-danger-500/20 transition-all disabled:opacity-50"
            >
              <ThumbsDown className="w-4 h-4" /> Not Satisfied
            </button>
          </div>
        </div>
      )}

      {/* Existing Feedback */}
      {complaint.feedback && (
        <div className={`glass-card p-5 border ${complaint.feedback.satisfied ? 'border-success-500/20' : 'border-danger-500/20'}`}>
          <div className="flex items-center gap-2 mb-2">
            {complaint.feedback.satisfied ? (
              <><ThumbsUp className="w-4 h-4 text-success-400" /><span className="text-sm font-medium text-success-400">Citizen Satisfied</span></>
            ) : (
              <><ThumbsDown className="w-4 h-4 text-danger-400" /><span className="text-sm font-medium text-danger-400">Citizen Not Satisfied — Re-escalated</span></>
            )}
          </div>
          {complaint.feedback.comment && (
            <p className="text-xs text-white/50 ml-6">"{complaint.feedback.comment}"</p>
          )}
        </div>
      )}
    </div>
  );
}
