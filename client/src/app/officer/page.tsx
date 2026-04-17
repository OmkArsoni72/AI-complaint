'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { Shield, FileText } from 'lucide-react';
import OfficerComplaintTable from '@/components/officer/OfficerComplaintTable';

export default function OfficerDashboard() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const compRes = await api.getOfficerComplaints();
      if (compRes.success) setComplaints(compRes.data as any[]);
    };
    fetchData();
    const handler = () => fetchData();
    window.addEventListener('crisis-simulated', handler);
    return () => window.removeEventListener('crisis-simulated', handler);
  }, []);

  const pending = complaints.filter((c) => c.status === 'PENDING').length;
  const inProgress = complaints.filter((c) => c.status === 'IN_PROGRESS').length;
  const resolved = complaints.filter((c) => c.status === 'RESOLVED').length;
  const escalated = complaints.filter((c) => c.status === 'ESCALATED').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary-400" />
          <h1 className="text-2xl font-bold text-white">Officer Dashboard</h1>
        </div>
        <p className="text-sm text-white/40">
          {user?.department ? `${user.department} • ${user.region}` : 'Assigned complaints'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Assigned', value: complaints.length, cls: 'border-primary-500/30 bg-primary-500/5 text-primary-400' },
          { label: 'Pending', value: pending, cls: 'border-warning-500/30 bg-warning-500/5 text-warning-400' },
          { label: 'In Progress', value: inProgress, cls: 'border-accent-500/30 bg-accent-500/5 text-accent-400' },
          { label: 'Resolved', value: resolved, cls: 'border-success-500/30 bg-success-500/5 text-success-400' },
          { label: 'Escalated', value: escalated, cls: 'border-danger-500/30 bg-danger-500/5 text-danger-400' },
        ].map((s) => (
          <div key={s.label} className={`glass-card p-3 border ${s.cls}`}>
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{s.label}</p>
            <p className="text-2xl font-black mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-white/60">
        <FileText className="w-4 h-4" />
        <span className="text-sm">My Assigned Complaints</span>
      </div>

      <OfficerComplaintTable complaints={complaints} />
    </div>
  );
}
