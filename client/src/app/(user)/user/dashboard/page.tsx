'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusCircle, ListTodo, ChevronRight,
  Clock, CheckCircle2, AlertCircle,
  Inbox, LogIn, Zap, Activity, Navigation, Bell
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { onEvent } from '@/lib/socket';
import toast from 'react-hot-toast';

interface Complaint {
  _id: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  location: any;
  createdAt: string;
}

export default function CitizenDashboard() {
  const router = useRouter();
  const { user, token, t } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchComplaints = useCallback(async () => {
    if (!token) { setIsLoading(false); return; }
    try {
      const res = await api.getMyComplaints();
      if (res.success) setComplaints(res.data as Complaint[]);
    } catch {
      // fail silently on dashboard
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => { 
    fetchComplaints();

    // ── Real-time Listeners ──────────────────────────────────────────
    const unsubStats = onEvent('stats_updated', () => {
      fetchComplaints();
    });

    const unsubCreated = onEvent('complaint_created', (complaint) => {
      toast.success(`Broadcasting: New ${complaint.category} issue reported nearby.`, {
        icon: '📢',
        style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
      });
    });

    const unsubEscalated = onEvent('complaint_escalated', (complaint) => {
      toast.error(`Emergency Update: A grievance has been escalated in your zone.`, {
        icon: '🚨',
        style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' }
      });
    });

    return () => {
      unsubStats();
      unsubCreated();
      unsubEscalated();
    };
  }, [fetchComplaints]);


  const pending   = complaints.filter(c => c.status?.toLowerCase() === 'pending').length;
  const resolved  = complaints.filter(c => c.status?.toLowerCase() === 'resolved').length;
  const escalated = complaints.filter(c => c.status?.toLowerCase() === 'escalated').length;
  const total     = complaints.length;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-200 py-8 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">

        {/* ── Welcome Header ─────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-600 uppercase tracking-widest mb-1 font-bold">{t('liveIntelligence')}</p>
            <h1 className="text-3xl font-black dark:text-white text-slate-900">{user?.name || 'Guest User'}</h1>
            <p className="text-slate-500 mt-1 text-sm font-medium">{user?.email || 'Public Access'} • Citizen Portal</p>
          </div>
          <div className="flex items-center gap-4 px-6 py-4 rounded-[2rem] glass-card relative overflow-hidden shadow-xl shadow-blue-500/5 transition-all hover:shadow-blue-500/10">
             <div className="absolute top-0 right-0 w-1.5 h-full bg-blue-500" />
            <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
              <Activity className="w-6 h-6 text-emerald-500 dark:text-emerald-400 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] text-slate-500 dark:text-slate-600 uppercase tracking-widest font-bold">System Status</p>
              <p className="text-sm font-black text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                {t('connected')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats Row ────────────────────────────────────────── */}
        {!isLoading && total > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10"
          >
            {[
              { label: t('total'),     count: total,     icon: Inbox,         color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-500/5',    border: 'border-blue-500/20' },
              { label: t('pending'),   count: pending,   icon: Clock,         color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/5',   border: 'border-amber-500/20' },
              { label: t('resolved'),  count: resolved,  icon: CheckCircle2,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' },
              { label: t('escalated'), count: escalated, icon: AlertCircle,   color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-500/5',    border: 'border-rose-500/20' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className={`glass-card p-6 shadow-lg border-2 ${s.border} relative group overflow-hidden`}>
                  <div className={`absolute -right-4 -bottom-4 w-20 h-20 ${s.bg} rounded-full blur-2xl transition-all group-hover:scale-150`} />
                  <Icon className={`w-5 h-5 ${s.color} mb-4 relative z-10`} />
                  <p className={`text-4xl font-black ${s.color} relative z-10 tabular-nums`}>{s.count}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase tracking-widest mt-2 relative z-10">{s.label}</p>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* ── Action Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {/* File Complaint */}
          <motion.button
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => router.push('/user/complaints/new')}
            suppressHydrationWarning
            className="group col-span-1 p-6 rounded-[2rem] bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-left relative overflow-hidden shadow-xl shadow-blue-500/20 border border-white/10"
          >
            <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all duration-500" />
            <PlusCircle className="w-10 h-10 text-white mb-4 group-hover:rotate-90 transition-transform duration-700 ease-out" />
            <h2 className="text-xl font-black text-white mb-2">{t('reportIssue')}</h2>
            <p className="text-blue-100/70 text-[13px] leading-relaxed mb-5 max-w-[85%]">{t('aiBacked')}</p>
            <div className="inline-flex items-center gap-2 text-white text-xs font-bold bg-white/15 px-5 py-2.5 rounded-xl group-hover:bg-white/25 transition-all backdrop-blur-md shadow-lg">
              {t('file')} <ChevronRight className="w-4 h-4" />
            </div>
          </motion.button>

          {/* Nearby Issues */}
          <motion.button
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => router.push('/user/nearby')}
            suppressHydrationWarning
            className="group p-6 rounded-[2rem] glass-card text-left relative overflow-hidden shadow-lg"
          >
            <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
            <Navigation className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mb-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            <h2 className="text-xl font-black dark:text-white text-slate-900 mb-2">{t('nearbyIssues')}</h2>
            <p className="text-slate-500 text-[13px] mb-5">Explore geo-tagged problems in real-time.</p>
            <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-500/10 px-5 py-2.5 rounded-xl group-hover:bg-emerald-500/20 transition-all">
              View Map <ChevronRight className="w-4 h-4" />
            </div>
          </motion.button>

          {/* My Complaints */}
          <motion.button
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => router.push('/user/complaints')}
            suppressHydrationWarning
            className="group p-6 rounded-[2rem] glass-card text-left relative overflow-hidden shadow-lg"
          >
            <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
            <ListTodo className="w-10 h-10 text-blue-600 dark:text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-xl font-black dark:text-white text-slate-900 mb-2">My Tracking</h2>
            <p className="text-slate-500 text-[13px] mb-5">Monitor your grievances status history.</p>
            <div className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-bold bg-blue-500/10 px-5 py-2.5 rounded-xl group-hover:bg-blue-500/20 transition-all">
              {t('trackAll')} <ChevronRight className="w-4 h-4" />
            </div>
          </motion.button>
        </div>

        {/* ── Recent Activity ───────────────────────────────────── */}
        <div className="glass-card rounded-[3rem] p-8 md:p-10 shadow-2xl relative overflow-hidden border-2 dark:border-white/5 border-slate-100">
           <div className="absolute -right-24 -top-24 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[100px]" />
          <h3 className="text-sm font-black dark:text-white text-slate-900 mb-10 flex items-center gap-3 uppercase tracking-[0.2em]">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 shadow-sm border border-blue-500/20">
              <Bell className="w-4 h-4" />
            </span>
            {t('liveActivity')}
          </h3>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-3xl dark:bg-white/5 bg-slate-100 animate-pulse" />)}
            </div>
          ) : complaints.length === 0 ? (
            <div className="text-center py-24 px-6 rounded-[2rem] bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/10">
              <div className="w-20 h-20 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              </div>
              <p className="text-slate-900 dark:text-slate-300 text-lg font-bold">{t('noActiveGrievances')}</p>
              <p className="text-slate-500 text-sm mt-3 max-w-sm mx-auto leading-relaxed">
                Your city is waiting for your input. Once you report an issue, it will appear here with live tracking updates.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {complaints.slice(0, 5).map((c, i) => {
                const statusKey = c.status?.toLowerCase();
                const statusStyles: Record<string, string> = {
                  pending:   'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400',
                  resolved:  'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
                  escalated: 'text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400',
                };
                return (
                  <motion.div
                    key={c._id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => router.push(`/user/complaints/${c._id}`)}
                    className="flex items-center justify-between p-6 rounded-3xl bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 hover:border-blue-500/30 hover:bg-white hover:dark:bg-white/[0.05] hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <span 
                        suppressHydrationWarning
                        className={`text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-widest ${statusStyles[statusKey] || 'text-slate-400 bg-slate-100 dark:bg-white/5'}`}
                      >
                        {c.status}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-300 truncate group-hover:text-blue-600 dark:group-hover:text-white transition-colors">
                          {c.description}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{new Date(c.createdAt).toLocaleDateString()} • {c.category}</p>
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 group-hover:bg-blue-500/10 transition-all flex-shrink-0">
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </motion.div>
                );
              })}
              {complaints.length > 5 && (
                <button
                  onClick={() => router.push('/user/complaints')}
                  className="w-full mt-6 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 py-5 transition-all bg-slate-50/50 dark:bg-white/[0.03] rounded-[2rem] border border-slate-100 dark:border-white/5 hover:border-blue-500/30 hover:shadow-lg shadow-blue-500/5"
                >
                  {t ? t('viewFullHistory') : 'View full tracking feed'} ({complaints.length} issues)
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
