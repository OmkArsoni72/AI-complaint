import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORY_ICONS, PRIORITY_COLORS } from '@/lib/constants';
import { MapPin, Clock } from 'lucide-react';

interface Complaint {
  _id: string;
  complaintId?: string;
  description: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  location: any;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ComplaintFeed({ complaints }: { complaints: Complaint[] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="glass-card h-full flex flex-col">
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Live Complaint Feed</h3>
          <p className="text-xs text-white/35">{complaints?.length || 0} recent complaints</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: '#34d399',
              boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)',
              animation: 'pulseRing 2s ease-in-out infinite',
            }}
          />
          <span className="text-[10px] text-white/45">Live</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <AnimatePresence initial={false}>
          {(complaints || []).slice(0, 15).map((c, i) => (
            <motion.div
              key={c._id || c.complaintId || i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-xl transition-all duration-200 cursor-pointer group"
              style={{
                background: 'rgba(255, 255, 255, 0.015)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.12)';
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.03)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.015)';
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-lg flex-shrink-0 mt-0.5">
                  {CATEGORY_ICONS[c.category] || 'GEN'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-white truncate">
                      {c.category}
                    </span>
                    <span
                      className={`badge text-[10px] ${
                        (PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW).bg
                      } ${(PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW).text} ${
                        (PRIORITY_COLORS[c.priority] || PRIORITY_COLORS.LOW).border
                      } border`}
                    >
                      {c.priority || 'LOW'}
                    </span>
                  </div>
                  <p className="text-xs text-white/45 line-clamp-1 mb-1.5">
                    {c.description}
                  </p>
                  <div className="flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> 
                      {typeof c.location === 'object' ? (c.location.area || 'Unknown') : (c.location || 'Unknown')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {mounted ? timeAgo(c.createdAt) : '...'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
