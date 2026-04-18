'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Building2,
  User,
  Tag,
  AlertTriangle,
  Shield,
  ArrowRight,
  Gauge,
} from 'lucide-react';
import { PRIORITY_COLORS, CATEGORY_ICONS } from '@/lib/constants';

interface ComplaintData {
  complaintId: string;
  description: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  department: string;
  assignedOfficerName: string | null;
  confidence: number;
  slaDeadline: string;
  location: { area: string; district: string };
  createdAt: string;
}

function SLATimer({ deadline }: { deadline: string }) {
  const remaining = new Date(deadline).getTime() - Date.now();
  const hours = Math.max(0, Math.floor(remaining / (1000 * 60 * 60)));
  const mins = Math.max(0, Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)));
  const isUrgent = remaining < 2 * 60 * 60 * 1000;

  return (
    <div className={`flex items-center gap-2 ${isUrgent ? 'text-danger-400' : 'text-warning-400'}`}>
      <Clock className="w-4 h-4" />
      <span className="font-mono text-lg font-bold">
        {hours}h {mins}m
      </span>
      <span className="text-xs opacity-60">remaining</span>
    </div>
  );
}

export default function ProcessingResult({ data }: { data: ComplaintData }) {
  const priorityColor = PRIORITY_COLORS[data.priority];
  const icon = CATEGORY_ICONS[data.category] || 'GEN';

  const steps = [
    { icon: 'REC', label: 'Complaint Received', time: new Date(data.createdAt).toLocaleTimeString(), done: true },
    { icon: 'ANL', label: 'Analysis Complete', time: 'Auto', done: true },
    { icon: 'ROUTE', label: `Routed to ${data.department}`, time: 'Auto', done: true },
    { icon: 'ASSIGN', label: `Assigned to ${data.assignedOfficerName || 'Pending'}`, time: 'Auto', done: !!data.assignedOfficerName },
    { icon: 'RES', label: 'Resolution', time: 'Pending', done: data.status === 'RESOLVED' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Success Header */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-500/20 mb-4"
        >
          <CheckCircle2 className="w-8 h-8 text-success-400" />
        </motion.div>
        <h1 className="text-2xl font-bold text-white mb-1">Complaint Processed Successfully</h1>
        <p className="text-white/50 text-sm">
          Complaint ID: <span className="font-mono text-primary-400">{data.complaintId}</span>
        </p>
      </div>

      {/* Main Result Card */}
      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Detection Results */}
          <div className="space-y-5">
            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Detected Category</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-lg font-semibold text-white">{data.category}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Gauge className="w-3.5 h-3.5 text-primary-400" />
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${data.confidence * 100}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-500 rounded-full"
                  />
                </div>
                <span className="text-xs font-mono text-primary-400">
                  {(data.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Priority Level</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${priorityColor.bg} ${priorityColor.text} border ${priorityColor.border}`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                {data.priority} PRIORITY
              </span>
            </div>

            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">SLA Deadline</p>
              <SLATimer deadline={data.slaDeadline} />
            </div>
          </div>

          {/* Right: Assignment */}
          <div className="space-y-5">
            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Assigned Department</p>
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-400" />
                <span className="text-white font-medium">{data.department}</span>
              </div>
            </div>

            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Assigned Officer</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-accent-400" />
                <span className="text-white font-medium">
                  {data.assignedOfficerName || 'Auto-Assignment Pending'}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-white/40 mb-1.5 uppercase tracking-wide">Location</p>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-success-400" />
                <span className="text-white font-medium">
                  {data.location.area}, {data.location.district}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Processing Timeline</h3>
        <div className="space-y-0">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.2 }}
              className="flex items-center gap-4 relative"
            >
              {i < steps.length - 1 && (
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
    </motion.div>
  );
}
