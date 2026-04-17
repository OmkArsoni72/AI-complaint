'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MapPin, Clock, Tag, MessageSquare,
  ThumbsUp, ThumbsDown, AlertCircle, CheckCircle2,
  Calendar, Building2, Zap, Image as ImageIcon, Mic,
  Play, Pause, X, User as UserIcon, Timer, PlusCircle
} from 'lucide-react';
import { onEvent } from '@/lib/socket';

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

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  HIGH:   { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    icon: '🔴' },
  MEDIUM: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   icon: '🟡' },
  LOW:    { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '🟢' },
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
        setTimeLeft('SLA Breached');
        clearInterval(interval);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
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
      }
    } catch { 
      alert('Failed to submit feedback'); 
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

  const getStatusStyle = (s: string) => {
    const lower = s?.toLowerCase();
    if (lower === 'pending') return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    if (lower === 'resolved') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (lower === 'escalated') return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
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
                    {complaint.status}
                  </span>
                  <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 shadow-sm ${priorityInfo.border.replace('30', '50')} ${priorityInfo.bg} ${priorityInfo.color.replace('-400', '-600')}`}>
                    {priorityInfo.icon} {complaint.priority}
                  </span>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-100 dark:bg-white/5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/5">
                  ID: {complaint._id.slice(-8)}
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
                    {complaint.assignedOfficer || 'Pending...'}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Location</p>
                  <p className="text-sm dark:text-white text-slate-800 font-bold flex items-center gap-2">
                    <MapPin className="w-4.5 h-4.5 text-rose-500" />
                    {locationStr}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Deadline</p>
                  <p className={`text-sm font-black flex items-center gap-2 ${timeLeft.includes('Breached') ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
                    <Clock className="w-4.5 h-4.5" />
                    {timeLeft || 'Calculating...'}
                  </p>
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
                {complaint.timeline.map((step, idx) => (
                  <div key={idx} className="relative group/step">
                    <div className="absolute -left-10 top-0.5 w-9 h-9 rounded-2xl dark:bg-slate-900 bg-white border-2 border-primary-500/30 flex items-center justify-center z-10 shadow-xl group-hover/step:border-primary-500 transition-colors">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 shadow-lg shadow-primary-500/50" />
                    </div>
                    <div>
                      <p className="text-base font-black dark:text-white text-slate-800 tracking-tight">{step.step}</p>
                      <p className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(step.time).toLocaleString('en-IN', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
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

            {/* ── Resolution Feedback ────────────────────────────────────────────────── */}
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
                    <p className="text-slate-500 font-medium text-lg max-w-xl">Has this issue been addressed by the municipal department adequately? Your feedback improves urban governance.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <button onClick={() => handleFeedback(true)} disabled={isUpdating} className="flex items-center justify-center gap-4 p-6 rounded-[2rem] bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all font-black text-base disabled:opacity-50 shadow-xl shadow-emerald-500/10 hover:scale-[1.02] active:scale-[0.98]">
                        <ThumbsUp className="w-5 h-5" /> Yes, Perfectly Solved
                      </button>
                      <button onClick={() => handleFeedback(false)} disabled={isUpdating} className="flex items-center justify-center gap-4 p-6 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all font-black text-base disabled:opacity-50 shadow-xl shadow-rose-500/10 hover:scale-[1.02] active:scale-[0.98]">
                        <ThumbsDown className="w-5 h-5" /> Not Satisfied
                      </button>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
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
