'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle, MapPin, AlignLeft, Tag, Send, ArrowRight, Sparkles,
  Camera, X, Mic, MicOff, Play, Pause, Trash2, Upload,
  Brain, Zap, Clock, Building2, AlertTriangle, CheckCircle2,
  ChevronDown, Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const CATEGORIES = [
  'Water Supply', 'Electricity', 'Traffic & Transport',
  'Sanitation', 'Public Safety', 'Environment',
  'Health', 'Education', 'Infrastructure',
];

// AI simulation on frontend for instant feedback
function clientDetectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/water|pipeline|drain|leak|sewage|tap|flood|paani|jal|nall/.test(lower)) return 'Water Supply';
  if (/electricity|power|light|outage|wire|spark|transformer|bijli|taar/.test(lower)) return 'Electricity';
  if (/traffic|road|pothole|signal|accident|jam|highway|sadak|rasta|gadda/.test(lower)) return 'Traffic & Transport';
  if (/garbage|clean|waste|filth|sanitation|dump|rubbish|kachra|gunda|safai/.test(lower)) return 'Sanitation';
  if (/safety|crime|police|robbery|assault|theft|harassment|danger|shakti|chor/.test(lower)) return 'Public Safety';
  if (/park|tree|garden|pollution|environment|ped|per|pradushan/.test(lower)) return 'Environment';
  if (/hospital|health|medical|disease|clinic|bimari|aspatal/.test(lower)) return 'Health';
  if (/building|collapse|construction|encroachment|girna|ghar|makan/.test(lower)) return 'Infrastructure';
  return '';
}

function clientDetectPriority(text: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const lower = text.toLowerCase();
  if (/fire|accident|collapse|emergency|urgent|danger|death|explosion|toxic|gas leak|aag|khatra|maut/.test(lower)) return 'HIGH';
  if (/broken|leak|not working|damaged|pothole|outage|contaminated|blocked|toota|kharab|paresani/.test(lower)) return 'MEDIUM';
  return 'LOW';
}

function clientDetectTags(text: string, category: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (/leak|leaking|leakage/.test(lower)) tags.push('leakage');
  if (/urgent|emergency|immediately|fire|critical/.test(lower)) tags.push('urgent');
  if (/pothole|road damage|broken road/.test(lower)) tags.push('road-damage');
  if (/no water|water shortage|dry tap/.test(lower)) tags.push('no-water');
  if (/power cut|no electricity|outage|blackout/.test(lower)) tags.push('power-cut');
  if (/garbage|waste|dump|rubbish|trash/.test(lower)) tags.push('garbage');
  if (/flood|waterlogging|overflow/.test(lower)) tags.push('flooding');
  if (/danger|hazard|unsafe|risk/.test(lower)) tags.push('safety-risk');
  if (/noise|loud|disturbance/.test(lower)) tags.push('noise');
  if (category) tags.push(category.toLowerCase().replace(/[& ]+/g, '-'));
  return [...new Set(tags)].slice(0, 6);
}

const DEPT_MAP: Record<string, string> = {
  'Water Supply': 'Delhi Jal Board',
  'Electricity': 'BSES / TPDDL',
  'Traffic & Transport': 'Delhi Traffic Police',
  'Sanitation': 'Municipal Corporation of Delhi',
  'Public Safety': 'Delhi Police',
  'Environment': 'Delhi Pollution Control Committee',
  'Health': 'Delhi Health Services',
  'Infrastructure': 'Public Works Department',
  '': 'Auto-detecting...',
};

const SLA_MAP: Record<string, Record<string, string>> = {
  'Water Supply': { HIGH: '4 hrs', MEDIUM: '24 hrs', LOW: '48 hrs' },
  'Electricity': { HIGH: '2 hrs', MEDIUM: '12 hrs', LOW: '24 hrs' },
  'Traffic & Transport': { HIGH: '1 hr', MEDIUM: '8 hrs', LOW: '24 hrs' },
  'Public Safety': { HIGH: '30 min', MEDIUM: '4 hrs', LOW: '12 hrs' },
  'Sanitation': { HIGH: '6 hrs', MEDIUM: '24 hrs', LOW: '72 hrs' },
};

const PRIORITY_CONFIG = {
  HIGH:   { label: 'HIGH',   color: 'text-rose-400',  bg: 'bg-rose-500/10',  border: 'border-rose-500/30',   icon: '🔴', desc: 'Immediate action required' },
  MEDIUM: { label: 'MEDIUM', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',  icon: '🟡', desc: 'Action within 24 hours' },
  LOW:    { label: 'LOW',    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: '🟢', desc: 'Standard processing time' },
};

export default function NewComplaintPage() {
  const router = useRouter();
  const { token, t } = useAuth();

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isCapturingLoc, setIsCapturingLoc] = useState(false);

  // Auto-capture location
  useEffect(() => {
    if ("geolocation" in navigator) {
      setIsCapturingLoc(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsCapturingLoc(false);
        },
        () => setIsCapturingLoc(false)
      );
    }
  }, []);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);

  // AI auto-detection state
  const [aiCategory, setAiCategory] = useState('');
  const [aiPriority, setAiPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('LOW');
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI analysis debounce
  useEffect(() => {
    if (!description.trim() || description.length < 10) {
      setAnalysisVisible(false);
      return;
    }
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const detectedCat = category || clientDetectCategory(description);
      const detectedPri = clientDetectPriority(description);
      const detectedTags = clientDetectTags(description, detectedCat);
      setAiCategory(detectedCat);
      setAiPriority(detectedPri);
      setAiTags(detectedTags);
      setIsAnalyzing(false);
      setAnalysisVisible(true);
    }, 700);
    return () => clearTimeout(timer);
  }, [description, category]);

  // Image handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [...images, ...files].slice(0, 5);
    setImages(newFiles);
    const previews = newFiles.map(f => URL.createObjectURL(f));
    setImagePreviews(previews);
  };

  const removeImage = (idx: number) => {
    const newFiles = images.filter((_, i) => i !== idx);
    const newPreviews = imagePreviews.filter((_, i) => i !== idx);
    setImages(newFiles);
    setImagePreviews(newPreviews);
  };

  // Voice recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = e => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      setIsRecording(true);
      setVoiceDuration(0);
      timerRef.current = setInterval(() => setVoiceDuration(d => d + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const playVoice = () => {
    if (!voiceBlob) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingVoice(false);
      return;
    }
    const url = URL.createObjectURL(voiceBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setIsPlayingVoice(true);
    audio.onended = () => { setIsPlayingVoice(false); audioRef.current = null; };
  };

  const deleteVoice = () => {
    setVoiceBlob(null);
    setVoiceDuration(0);
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlayingVoice(false);
  };

  // Submit
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('description', description);
      formData.append('location', location);
      formData.append('category', category || aiCategory || 'General');
      if (coords) {
        formData.append('lat', coords.lat.toString());
        formData.append('lng', coords.lng.toString());
      }
      images.forEach(img => formData.append('images', img));
      if (voiceBlob) {
        formData.append('voice', new File([voiceBlob], 'voice-note.webm', { type: 'audio/webm' }));
      }

      const res = await fetch(`${API_BASE}/complaints`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSubmittedData(data.data);
      } else {
        setError(data.error || 'Failed to submit complaint');
      }
    } catch {
      setError('Connection to backend failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityInfo = PRIORITY_CONFIG[aiPriority] || PRIORITY_CONFIG.LOW;
  const effectiveCategory = category || aiCategory;
  const slaTime = SLA_MAP[effectiveCategory]?.[aiPriority] || '48 hrs';
  const dept = DEPT_MAP[effectiveCategory] || 'Auto-detecting...';

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  if (submittedData) {
    return (
      <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-200 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-lg w-full text-center"
        >
          <div className="w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/20 border-2 border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black dark:text-white text-slate-900 mb-3 tracking-tight">Complaint Registered!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">AI has analyzed and routed your complaint to the appropriate department.</p>

          <div className="glass-card rounded-[2.5rem] p-8 mb-8 text-left space-y-5 shadow-2xl border-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Category</span>
              <span className="dark:text-white text-slate-900 font-black">{submittedData.category}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Priority</span>
              <span className={`font-black ${PRIORITY_CONFIG[submittedData.priority as 'HIGH'|'MEDIUM'|'LOW']?.color.replace('-400', '-600') || 'text-slate-900 dark:text-white'}`}>
                {PRIORITY_CONFIG[submittedData.priority as 'HIGH'|'MEDIUM'|'LOW']?.icon} {submittedData.priority}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">Department</span>
              <span className="dark:text-white text-slate-900 font-black">{submittedData.department}</span>
            </div>
            {submittedData.tags?.length > 0 && (
              <div className="pt-5 border-t dark:border-white/5 border-slate-100">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-3">AI-Generated Tags</p>
                <div className="flex flex-wrap gap-2">
                  {submittedData.tags.map((t: string) => (
                    <span key={t} className="px-3 py-1.5 bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm">#{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/user/complaints')}
              className="flex-1 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary-500/20 active:scale-95"
            >
              Track Status <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => { setSubmittedData(null); setDescription(''); setCategory(''); setLocation(''); setImages([]); setImagePreviews([]); setVoiceBlob(null); }}
              className="flex-1 py-4 bg-white/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 dark:text-white text-slate-900 font-black rounded-2xl border dark:border-white/10 border-slate-200 transition-all shadow-lg active:scale-95"
            >
              File Another
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-200 py-8 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10 flex flex-col items-center text-center">
            <div className="p-4 bg-primary-500/10 border-2 border-primary-500/20 rounded-[2rem] shadow-xl shadow-primary-500/5 mb-6">
              <PlusCircle className="w-10 h-10 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-4xl font-black dark:text-white text-slate-900 tracking-tight mb-3">{t('fileGrievance')}</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium max-w-md">
            Our AI analyzes your complaint in real-time and routes it to the right department for faster resolution.
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 rounded-[2rem] bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-sm font-bold flex items-center gap-3 shadow-lg"
          >
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* ── Description ─────────────────────────────────────────── */}
          <div className="glass-card rounded-[2.5rem] p-8 shadow-xl border-2 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 mb-6 uppercase tracking-widest relative z-10">
              <AlignLeft className="w-4 h-4 text-primary-500" />
              {t('describeIssue')} *
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What seems to be the problem? Be specific — e.g. 'Broken water pipeline leaking in Sector 7, causing road damage...'"
              required
              rows={5}
              className="w-full bg-transparent dark:text-white text-slate-900 placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none resize-none text-lg leading-relaxed font-medium relative z-10"
            />
            <div className="mt-6 flex items-center justify-between relative z-10">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">{description.length} characters</span>
              {isAnalyzing && (
                <span className="flex items-center gap-2 text-xs font-bold text-primary-600 dark:text-primary-400">
                  <Loader2 className="w-4 h-4 animate-spin" /> AI analyzing...
                </span>
              )}
            </div>
          </div>

          {/* ── AI Intelligence Panel ─────────────────────────────────── */}
          <AnimatePresence>
            {analysisVisible && (
              <motion.div
                initial={{ opacity: 0, y: -20, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-gradient-to-br from-primary-500/[0.08] via-indigo-500/[0.05] to-purple-500/[0.08] border-2 border-primary-500/20 rounded-[2.5rem] p-8 shadow-2xl relative">
                  <div className="absolute -left-10 -top-10 w-40 h-40 bg-primary-500/10 rounded-full blur-[80px]" />
                  <div className="flex items-center gap-3 mb-8 relative z-10">
                    <div className="w-10 h-10 rounded-2xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                      <Brain className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-sm font-black text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em]">AI Intelligence Report</h3>
                    <Sparkles className="w-4 h-4 text-purple-500 ml-auto animate-pulse" />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6 relative z-10">
                    {/* Category */}
                    <div className="col-span-2 glass-card dark:bg-white/5 bg-white/40 rounded-3xl p-5 border shadow-sm">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">Detected Category</p>
                      <p className="dark:text-white text-slate-900 font-black text-lg">{effectiveCategory || 'General'}</p>
                    </div>
                    {/* Priority */}
                    <div className={`glass-card dark:bg-white/5 bg-white/40 rounded-3xl p-5 border-2 ${priorityInfo.border.replace('30', '50')} shadow-sm`}>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2">Priority</p>
                      <p className={`font-black text-base flex items-center gap-2 ${priorityInfo.color.replace('-400', '-600')}`}>
                         {priorityInfo.icon} {priorityInfo.label}
                      </p>
                      <p className="text-[9px] text-slate-500 font-bold mt-1 leading-tight">{priorityInfo.desc}</p>
                    </div>
                    {/* SLA */}
                    <div className="glass-card dark:bg-white/5 bg-white/40 rounded-3xl p-5 border shadow-sm">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-2 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> SLA Deadline
                      </p>
                      <p className="dark:text-white text-slate-900 font-black text-base">{slaTime}</p>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="flex items-center gap-4 glass-card dark:bg-white/5 bg-white/40 rounded-3xl p-6 mb-6 relative z-10 border shadow-md">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                      <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-1">Routed to Department</p>
                      <p className="dark:text-white text-slate-900 font-black text-base">{dept}</p>
                    </div>
                    <div className="ml-auto">
                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl shadow-sm">Auto-routed</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {aiTags.length > 0 && (
                    <div className="relative z-10">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-black mb-3">AI-Generated Tags</p>
                      <div className="flex flex-wrap gap-2.5">
                        {aiTags.map(tag => (
                          <span key={tag} className="px-3 py-1.5 bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Category + Location ──────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Category */}
            <div className="glass-card rounded-[2.5rem] p-6 shadow-xl border-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">
                <Tag className="w-4 h-4 text-primary-500" />
                {t('category')}
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full bg-transparent dark:text-white text-slate-900 font-bold focus:outline-none appearance-none cursor-pointer pr-10 py-2 border-b-2 border-slate-100 dark:border-white/5 transition-colors focus:border-primary-500/50"
                >
                  <option value="" className="dark:bg-slate-900 bg-white">⚡ Auto-detect (AI)</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c} className="dark:bg-slate-900 bg-white">{c}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            {/* Location */}
            <div className="glass-card rounded-[2.5rem] p-6 shadow-xl border-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">
                <MapPin className="w-4 h-4 text-rose-500 font-bold" />
                {t('exactLocation')} *
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="e.g. Lajpat Nagar Market, Block C"
                required
                className="w-full bg-transparent dark:text-white text-slate-900 font-bold placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none py-2 border-b-2 border-slate-100 dark:border-white/5 transition-colors focus:border-rose-500/50"
              />
            </div>
          </div>

          {/* ── Image Upload ─────────────────────────────────────────── */}
          <div className="glass-card rounded-[2.5rem] p-8 shadow-xl border-2">
            <div className="flex items-center justify-between mb-6">
              <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <Camera className="w-4 h-4 text-indigo-500" />
                {t('photoEvidence')}
              </label>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-white/5 px-2.5 py-1 rounded-lg">
                {images.length} / 5 photos
              </span>
            </div>

            {imagePreviews.length > 0 && (
              <div className="flex flex-wrap gap-4 mb-6">
                {imagePreviews.map((src, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group w-24 h-24"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover rounded-2xl border-2 border-white/10 shadow-lg" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg transform scale-0 group-hover:scale-100 transition-transform active:scale-90"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 5}
              className="w-full py-6 border-2 border-dashed dark:border-white/10 border-slate-200 rounded-[2rem] text-slate-400 dark:text-slate-500 hover:border-primary-500/50 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-500/5 transition-all flex flex-col items-center justify-center gap-2 text-sm disabled:opacity-40 group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center group-hover:bg-primary-500/10 transition-colors">
                <Upload className="w-6 h-6" />
              </div>
              <span className="font-bold uppercase tracking-widest text-[10px]">
                {images.length === 0 ? 'Click to upload proof' : 'Add more photos'}
              </span>
            </button>
          </div>

          {/* ── Voice Input ──────────────────────────────────────────── */}
          <div className="glass-card rounded-[2.5rem] p-8 shadow-xl border-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 mb-6 uppercase tracking-widest">
              <Mic className="w-4 h-4 text-emerald-500" />
              {t('voiceNote')}
              <span className="text-[9px] text-slate-400 normal-case tracking-normal ml-2 font-medium">(Optional) — For voice description</span>
            </label>

            {voiceBlob ? (
              <div className="flex items-center gap-6 p-6 bg-emerald-500/5 dark:bg-emerald-500/10 border-2 border-emerald-500/20 rounded-[2rem] shadow-inner">
                <button type="button" onClick={playVoice}
                  className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-lg active:scale-95 flex-shrink-0"
                >
                  {isPlayingVoice ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <div className="flex-1">
                  <p className="text-sm dark:text-white text-slate-900 font-bold uppercase tracking-widest">Voice Recorded</p>
                  <p className="text-xs text-slate-500 font-medium">{formatTime(voiceDuration)} duration</p>
                </div>
                <button type="button" onClick={deleteVoice} className="w-10 h-10 rounded-xl hover:bg-rose-500/10 text-rose-500 transition-colors flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all shadow-xl active:scale-95 ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
                      : 'bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-500'
                  }`}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
                <div>
                  {isRecording ? (
                    <div>
                      <p className="text-lg text-rose-600 dark:text-rose-400 font-black uppercase tracking-widest animate-pulse">Recording... {formatTime(voiceDuration)}</p>
                      <p className="text-xs text-slate-500 font-medium">Click the button again to stop</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg dark:text-slate-400 text-slate-800 font-black uppercase tracking-widest">Start Voice Log</p>
                      <p className="text-xs text-slate-500 font-medium">Speak clearly about the issue to the urban AI</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Submit ───────────────────────────────────────────────── */}
          <div className="pt-4 pb-12">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-6 bg-gradient-to-r from-primary-600 via-blue-600 to-indigo-700 hover:from-primary-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-[2.5rem] transition-all flex items-center justify-center gap-3 text-xl shadow-2xl shadow-primary-500/30 active:scale-[0.98]"
            >
              {isSubmitting ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Processing with AI...</>
              ) : (
                <><Zap className="w-6 h-6 fill-current" /> {t('submit')}</>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-widest font-bold mt-6">
              Verified Urban Intelligence Portal • Secure Transmission
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
