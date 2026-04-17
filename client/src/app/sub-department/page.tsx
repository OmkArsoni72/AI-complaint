'use client';

import { useEffect, useState } from 'react';
import { Shield, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import ComplaintTable from '@/components/admin/ComplaintTable';

export default function SubDepartmentDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/sub-department/login');
      else if (user.role !== 'ADMIN') router.push('/sub-department/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const res = await api.getAdminComplaints();
      if (res.success) setComplaints(res.data as any[]);
    };
    fetchData();
  }, [user]);

  const complaintStats = complaints.reduce(
    (acc: any, c: any) => {
      const s = (c?.status || 'PENDING').toString().toUpperCase();
      acc.total += 1;
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    },
    { total: 0, PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0, ESCALATED: 0 }
  );

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-primary-400" />
            <h1 className="text-2xl font-bold text-white uppercase tracking-tight">Sub-Department Desk</h1>
          </div>
          <p className="text-sm text-white/40">Assigned complaints for your unit</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{
          label: 'Pending',
          value: complaintStats.PENDING,
          cls: 'border-warning-500/30 bg-warning-500/5 text-warning-400',
        }, {
          label: 'In Progress',
          value: complaintStats.IN_PROGRESS,
          cls: 'border-primary-500/30 bg-primary-500/5 text-primary-400',
        }, {
          label: 'Resolved',
          value: complaintStats.RESOLVED,
          cls: 'border-success-500/30 bg-success-500/5 text-success-400',
        }, {
          label: 'Escalated',
          value: complaintStats.ESCALATED,
          cls: 'border-danger-500/30 bg-danger-500/5 text-danger-400',
        }].map((s) => (
          <div key={s.label} className={`glass-card p-3 border ${s.cls}`}>
            <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{s.label}</p>
            <p className="text-2xl font-black mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-white/60">
        <FileText className="w-4 h-4" />
        <span className="text-sm">Assigned Complaints</span>
      </div>

      <ComplaintTable complaints={complaints} officers={[]} />
    </div>
  );
}
