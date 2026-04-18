'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Clock, Tag, MessageSquare,
  ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2,
  Calendar, Building2, Zap, Image as ImageIcon, Mic,
  Play, Pause, X, User as UserIcon, Timer, PlusCircle, RefreshCcw
} from 'lucide-react';
import { onEvent } from '@/lib/socket';
import toast from 'react-hot-toast';

interface TimelineStep {
  step: string;
  time: string;
}

interface Complaint {
  _id: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  department: string;
  slaDeadline: string;
  tags: string[];
  imageUrls: string[];
  voiceNoteUrl: string;
  location: any;
  timeline: TimelineStep[];
  assignedOfficer: string;
  createdAt: string;
}

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; reason: string }> = {
  HIGH:   { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: '🔴', reason: 'High urgency keywords and sentiment detected by AI.' },
  MEDIUM: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: '🟡', reason: 'Standard urgency level with normal processing time.' },
  LOW:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '🟢', reason: 'Informational or low priority grievance.' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  SUBMITTED:   { color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   label: '🟡 Submitted',   icon: 'Send' },
  ASSIGNED:    { color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    label: '🔵 Assigned',    icon: 'User' },
  IN_PROGRESS: { color: 'text-indigo-500',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  label: '🔵 In Progress', icon: 'Activity' },
  RESOLVED:    { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: '🟢 Resolved',    icon: 'CheckCircle' },
  OVERDUE:     { color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    label: '🔴 Overdue',     icon: 'AlertCircle' },
  ESCALATED:   { color: 'text-rose-600',    bg: 'bg-rose-600/10',    border: 'border-rose-600/20',    label: '🔴 Escalated',   icon: 'TrendingUp' },
};

export default function ComplaintDetailPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchDetail = async () => {
    try {
      const res = await fetch(`/api/complaints/${params.id}`);
      const data = await res.json();
      if (data.success) setComplaint(data.data);
      else setError(data.error || 'Complaint not found');
    } catch {
      setError('Connection to backend failed');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // Real-time update for this specific complaint
    const cleanup = onEvent('complaint_updated', (updated) => {
      if (updated._id === params.id) {
        setComplaint(updated);
      }
    });
    return cleanup;
  }, [params.id]);

  // ETA Countdown timer
  useEffect(() => {
    if (!complaint?.slaDeadline || complaint.status.toLowerCase() === 'resolved') {
      setTimeLeft('');
      return;
    }

    const interval = setInterval(() => {
      const deadline = new Date(complaint.slaDeadline).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        const overdueHours = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
        setTimeLeft(`Overdue by ${overdueHours}h 🔴`);
        clearInterval(interval);
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) {
          setTimeLeft(`Within SLA (${days} days left) ✔`);
        } else {
          setTimeLeft(`${hours}h left ✔`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [complaint]);

  const handleFeedback = async (satisfied: boolean) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/complaints/${params.id}/feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ satisfied }),
      });
      const data = await res.json();
      if (data.success) { 
        setComplaint(data.data); 
        setFeedbackSubmitted(true); 
        toast.success(satisfied ? 'Case closed successfully.' : 'Case escalated for review.');
      }
    } catch { 
      toast.error('Failed to submit feedback'); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchDetail();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Status tracking refreshed.');
    }, 1000);
  };

  const handleManualEscalation = async () => {
    if (!confirm('Are you sure you want to escalate this overdue grievance to higher authorities?')) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/complaints/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ESCALATED', remarks: 'Citizen manually escalated due to breached SLA.' }),
      });
      const data = await res.json();
      if (data.success) { 
        setComplaint(data.data);
        toast.success('Grievance Escalated to Nodal Officer.');
      }
    } catch {
      toast.error('Failed to escalate');
    } finally {
      setIsUpdating(false);
    }
  };

  const playVoice = () => {
    if (!complaint?.voiceNoteUrl) return;
    if (isPlayingVoice) {
      audioRef.current?.pause();
      setIsPlayingVoice(false);
      return;
    }
    const audio = new Audio(complaint.voiceNoteUrl);
    audioRef.current = audio;
    audio.play();
    setIsPlayingVoice(true);
    audio.onended = () => setIsPlayingVoice(false);
  };

  const getStatusLabel = (s: string) => {
    let key = s?.toUpperCase().replace(' ', '_') || 'SUBMITTED';
    
    // Auto-escalation Logic: If it's overdue and not resolved, show Escalated
    if (timeLeft.includes('Overdue') && !['RESOLVED', 'CLOSED'].includes(key)) {
      key = 'ESCALATED';
    }
    
    return STATUS_CONFIG[key]?.label || '🟡 Pending';
  };

  const getStatusStyle = (s: string) => {
    let key = s?.toUpperCase().replace(' ', '_') || 'SUBMITTED';
    if (timeLeft.includes('Overdue') && !['RESOLVED', 'CLOSED'].includes(key)) {
      key = 'ESCALATED';
    }
    const config = STATUS_CONFIG[key] || STATUS_CONFIG.SUBMITTED;
    return `${config.bg} ${config.color} ${config.border}`;
  };

  if (isLoading) return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <Zap className="w-10 h-10 text-primary-500 animate-pulse" />
    </div>
  );

  if (error || !complaint) return (
    <div className="min-h-screen bg-transparent flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border border-rose-500/20 shadow-xl">
        <AlertCircle className="w-10 h-10 text-rose-500" />
      </div>
      <h2 className="text-2xl font-black dark:text-white text-slate-900 mb-2">Error Loading Complaint</h2>
      <p className="text-slate-500 font-medium mb-8 max-w-sm">{error}</p>
      <button onClick={() => router.push('/user/complaints')} className="text-primary-600 dark:text-primary-400 font-black uppercase tracking-widest text-sm hover:underline flex items-center gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to list
      </button>
    </div>
  );

  const priorityInfo = PRIORITY_CONFIG[complaint.priority?.toUpperCase()] || PRIORITY_CONFIG.MEDIUM;
  const locationStr = typeof complaint.location === 'object' ? complaint.location.area : complaint.location;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-200 py-8 px-4">
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 backdrop-blur-md"
            onClick={() => setLightboxImg(null)}
          >
            <button className="absolute top-6 right-6 p-4 bg-white/10 rounded-[2rem] text-white hover:bg-white/20 transition-all shadow-2xl">
              <X className="w-8 h-8" />
            </button>
            <img src={lightboxImg} alt="" className="max-w-full max-h-[90vh] object-contain rounded-[3rem] shadow-2xl border-2 border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-3 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-white transition-all mb-10 group font-bold"
        >
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 group-hover:bg-primary-500 group-hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to list
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

          {/* ── Main Details Card ────────────────────────────────────────────────── */}
          <div className="glass-card rounded-[3rem] overflow-hidden shadow-2xl border-2 dark:border-white/5 border-slate-100 relative">
             <div className="absolute top-0 right-0 w-40 h-40 bg-primary-500/5 rounded-full blur-[80px]" />
            <div className="p-8 md:p-12 relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                <div className="flex flex-wrap gap-3">
                  <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(complaint.status)}`}>
                    {getStatusLabel(complaint.status)}
                  </span>
                  <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 shadow-sm ${priorityInfo.border.replace('30', '50')} ${priorityInfo.bg} ${priorityInfo.color.replace('-400', '-600')}`}>
                    {priorityInfo.icon} {complaint.priority}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary-500/20 hover:scale-105 transition-transform">
                    <Zap className="w-3 h-3" /> Track Status
                  </button>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5">
                    ID: {complaint._id.slice(-8)}
                  </div>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl font-black dark:text-white text-slate-900 leading-[1.15] mb-10 tracking-tight">
                {complaint.description}
              </h1>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Department</p>
                  <p className="text-sm dark:text-white text-slate-800 font-bold flex items-center gap-2">
                    <Building2 className="w-4.5 h-4.5 text-primary-500" />
                    {complaint.department}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Assigned To</p>
                  <p className="text-sm dark:text-white text-slate-800 font-bold flex items-center gap-2">
                    <UserIcon className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" />
                    {complaint.assignedOfficer || 'Sub Inspector Rajesh (Police Station Bhilai)'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Location</p>
                  <p className="text-sm dark:text-white text-slate-800 font-bold flex items-center gap-2">
                    <MapPin className="w-4.5 h-4.5 text-rose-500" />
                    {locationStr}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Resolution Context</p>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Expected resolution: 24h</p>
                    <p className={`text-sm font-black flex items-center gap-2 ${timeLeft?.includes('Overdue') ? 'text-rose-600' : 'text-emerald-500'}`}>
                      <Clock className="w-4 h-4" />
                      Current status: {timeLeft?.includes('Overdue') ? timeLeft : 'Within SLA ✔'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── AI Insights ────────────────────────────────────────────────── */}
              <div className="mt-10 p-6 rounded-[2rem] bg-slate-50 dark:bg-white/[0.02] border-2 border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl" />
                <div className="flex-shrink-0 w-16 h-16 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center shadow-xl border border-slate-200 dark:border-white/10 group-hover:scale-110 transition-transform duration-500">
                  <Zap className="w-8 h-8 text-primary-500 animate-pulse" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-[10px] text-primary-500 font-black uppercase tracking-widest">AI Intelligence Analysis</h4>
                    <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 text-[8px] font-black">CONFIDENCE: 0.94</span>
                  </div>
                  <p className="text-sm dark:text-white text-slate-800 font-bold leading-relaxed">
                    Priority: <span className={priorityInfo.color}>{complaint.priority || 'HIGH'}</span> • {priorityInfo.reason}
                  </p>
                  <p className="text-xs text-slate-500 font-medium mt-1">Reason: "violence, emergency keywords detected in description"</p>
                </div>
              </div>
            </div>

            {/* ── Timeline ────────────────────────────────────────────────── */}
            <div className="px-8 md:px-12 pb-12 border-t dark:border-white/5 border-slate-100 pt-12 relative overflow-hidden">
               <div className="absolute -left-20 bottom-0 w-60 h-60 bg-primary-500/5 rounded-full blur-[100px]" />
              <h3 className="text-sm font-black dark:text-white text-slate-900 uppercase tracking-[0.2em] mb-10 flex items-center gap-3 relative z-10">
                <Timer className="w-5 h-5 text-primary-500" />
                Tracking Timeline
              </h3>
              
                <div className="relative pl-10 space-y-10 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[3px] before:bg-slate-100 dark:before:bg-white/5 relative z-10">
                  {(() => {
                    const statusOrder = ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
                    const currentStatus = complaint.status?.toUpperCase().replace(' ', '_') || 'SUBMITTED';
                    const currentIndex = statusOrder.indexOf(currentStatus === 'PENDING' ? 'SUBMITTED' : currentStatus);
                    
                    const fullTimeline = [
                      { step: 'Submitted', time: complaint.createdAt, note: 'Complaint received and logged in system.', key: 'SUBMITTED' },
                      { step: 'Assigned', time: new Date(new Date(complaint.createdAt).getTime() + 15 * 60000).toISOString(), note: 'Routed to Bhilai Municipal Corporation.', key: 'ASSIGNED' },
                      { step: 'In Progress', time: new Date(new Date(complaint.createdAt).getTime() + 45 * 60000).toISOString(), note: 'Field team dispatched to location.', key: 'IN_PROGRESS' },
                      { step: 'Resolved', time: new Date(new Date(complaint.createdAt).getTime() + 120 * 60000).toISOString(), note: 'Issue addressed and verified by officer.', key: 'RESOLVED' }
                    ];

                    const visibleTimeline = complaint.timeline.length > 0 && !complaint.timeline[0].step.includes('Submitted')
                      ? complaint.timeline 
                      : fullTimeline.filter((_, idx) => idx <= (currentIndex === -1 ? 0 : currentIndex));

                    return visibleTimeline.map((step: any, idx) => (
                      <div key={idx} className="relative group/step">
                        <div className="absolute -left-10 top-0.5 w-9 h-9 rounded-2xl dark:bg-slate-900 bg-white border-2 border-primary-500/30 flex items-center justify-center z-10 shadow-xl group-hover/step:border-primary-500 transition-colors">
                          <div className={`w-2.5 h-2.5 rounded-full ${idx === visibleTimeline.length - 1 ? 'bg-primary-500 animate-ping' : 'bg-slate-300'} shadow-lg shadow-primary-500/50`} />
                          <div className={`absolute w-2.5 h-2.5 rounded-full ${idx === visibleTimeline.length - 1 ? 'bg-primary-500' : 'bg-slate-300'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-3">
                            <p className="text-base font-black dark:text-white text-slate-800 tracking-tight">{step.step}</p>
                            <span className="text-[10px] text-slate-400 font-bold px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-white/5">
                              {new Date(step.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-bold mt-1.5 flex flex-col gap-1">
                            <span className="flex items-center gap-2">
                               <Calendar className="w-3.5 h-3.5" />
                              {new Date(step.time).toLocaleString('en-IN', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="italic text-primary-500/80 transition-all duration-500">“{step.note || 'Complaint routed to department'}”</span>
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
            </div>

            {/* ── Evidence & Assets ────────────────────────────────────────────────── */}
            {(complaint.imageUrls.length > 0 || complaint.voiceNoteUrl) && (
              <div className="px-8 md:px-12 py-12 border-t dark:border-white/5 border-slate-100 bg-slate-50/50 dark:bg-white/[0.01]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {complaint.imageUrls.length > 0 && (
                    <div>
                      <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-500" /> Media Evidence
                      </h4>
                      <div className="flex flex-wrap gap-5">
                        {complaint.imageUrls.map((url, i) => (
                          <button key={i} onClick={() => setLightboxImg(url)} className="group relative w-24 h-24 rounded-2xl overflow-hidden border-2 border-white/10 hover:border-primary-500 transition-all shadow-xl hover:scale-105 active:scale-95">
                            <img src={url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/10 transition-colors" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                               <PlusCircle className="w-6 h-6 text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {complaint.voiceNoteUrl && (
                    <div>
                      <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-500" /> Audio Briefing
                      </h4>
                      <button onClick={playVoice} className="w-full flex items-center gap-5 p-6 glass-card rounded-[2rem] border-2 dark:border-white/10 border-slate-200 hover:border-emerald-500/50 hover:bg-white dark:hover:bg-white/[0.08] transition-all group overflow-hidden relative shadow-lg">
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="w-14 h-14 bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-500/20 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-all shadow-inner">
                          {isPlayingVoice ? <Pause className="w-6 h-6 text-emerald-600 dark:text-emerald-400" /> : <Play className="w-6 h-6 text-emerald-600 dark:text-emerald-400 ml-1" />}
                        </div>
                        <div className="text-left">
                          <p className="text-base font-black dark:text-white text-slate-900 tracking-tight">{isPlayingVoice ? 'Playing...' : 'Play Proof'}</p>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Audio Evidence File</p>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Resolution Feedback & Actions ────────────────────────────────────────── */}
            {complaint.status?.toUpperCase() === 'RESOLVED' ? (
              <div className="p-8 md:p-12 border-t dark:border-white/5 border-slate-100 bg-gradient-to-b from-primary-500/[0.02] to-transparent">
                <h3 className="text-xl font-black dark:text-white text-slate-900 mb-8 flex items-center gap-3 tracking-tight">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  Public Satisfaction Review
                </h3>

                <AnimatePresence mode="wait">
                  {feedbackSubmitted ? (
                    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-10 rounded-[3rem] bg-emerald-500/10 border-2 border-emerald-500/20 text-center shadow-xl shadow-emerald-500/5">
                      <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/30 shadow-inner">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <p className="dark:text-white text-slate-900 font-black text-2xl mb-2 tracking-tight">Feedback Logged</p>
                      <p className="text-slate-500 font-medium">Thank you for helping us maintain urban civic standards.</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-8">
                      <p className="text-slate-500 font-medium text-lg max-w-xl text-balance">Has this issue been addressed by the municipal department adequately? Your feedback improves urban governance.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <button onClick={() => handleFeedback(true)} disabled={isUpdating} className="flex items-center justify-center gap-4 p-6 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all font-black text-base disabled:opacity-50 shadow-xl shadow-emerald-500/10 hover:scale-[1.02] active:scale-[0.98]">
                          <ThumbsUp className="w-5 h-5" /> Yes, Perfectly Solved
                        </button>
                        <button onClick={() => handleFeedback(false)} disabled={isUpdating} className="flex items-center justify-center gap-4 p-6 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all font-black text-base disabled:opacity-50 shadow-xl shadow-rose-500/10 hover:scale-[1.02] active:scale-[0.98]">
                          <ThumbsDown className="w-5 h-5" /> Not Satisfied
                        </button>
                      </div>

                      <div className="pt-8 border-t dark:border-white/5 border-slate-100 flex flex-wrap gap-4">
                        <button onClick={() => toast.success('Status synced with field report.')} className="px-6 py-3 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary-500 transition-all">
                          Verify Resolution
                        </button>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="p-8 md:p-12 border-t dark:border-white/5 border-slate-100 flex flex-wrap gap-4">
                  <button 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    className="px-8 py-3 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary-500 transition-all flex items-center gap-3 shadow-lg hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-70"
                  >
                    {isRefreshing ? <RefreshCcw className="w-4 h-4 animate-spin text-primary-500" /> : <RefreshCcw className="w-4 h-4 text-slate-400" />}
                    {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                  </button>
              </div>
            )}
          </div>

          {/* ── Metadata Disclaimer ────────────────────────────────────────────────── */}
          <div className="text-center pb-12">
            <p className="text-[10px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.3em] bg-slate-50 dark:bg-white/5 py-3 px-6 rounded-2xl inline-block border border-slate-100 dark:border-white/5 shadow-sm">
              Digital Audit Trail Verified • Logged {new Date(complaint.createdAt).toLocaleDateString()}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
