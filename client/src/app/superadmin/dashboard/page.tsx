'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  TrendingUp,
  Users,
  UserCog,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

function formatCount(value: number) {
  return value.toLocaleString();
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="glass-card p-4 border border-slate-200/70 bg-white/80 text-slate-900 shadow-sm dark:border-white/5 dark:bg-white/5 dark:text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500/80 font-bold dark:text-white/35">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-2 dark:text-white">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [summary, setSummary] = useState<any>(null);
  const [departmentStats, setDepartmentStats] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/superadmin/login');
      else if (user.role !== 'SUPER_ADMIN') {
        router.push(user.role === 'ADMIN' ? '/admin' : '/');
      }
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (!user || user.role !== 'SUPER_ADMIN') return;

    const fetchData = async () => {
      setIsFetching(true);
      setFetchError(null);
      try {
        const [sumRes, deptRes, dptRes, userRes] = await Promise.all([
          api.getSummary(),
          api.getDepartmentStats(),
          api.getDepartments(),
          api.getUsers(),
        ]);

        if (sumRes.success) setSummary(sumRes.data);
        if (deptRes.success) setDepartmentStats(deptRes.data as any[]);
        if (dptRes.success) setDepartments(dptRes.data as any[]);
        if (userRes.success) setUsers(userRes.data as any[]);

        if (!sumRes.success || !deptRes.success || !dptRes.success || !userRes.success) {
          setFetchError('Data refresh incomplete. Please check API services.');
        }
      } catch (err) {
        setFetchError('Unable to fetch dashboard data.');
      } finally {
        setIsFetching(false);
      }
    };

    fetchData();
  }, [user]);

  if (isLoading || !user || user.role !== 'SUPER_ADMIN') return null;

  const activeComplaints = Math.max(
    (summary?.total || 0) - (summary?.resolved || 0),
    0
  );
  const highPriorityComplaints = departmentStats.reduce(
    (total, item) => total + Number(item.highPriority || 0),
    0
  );
  const activeOfficials = users.filter((entry) => entry.isActive !== false).length;

  const dashboardDepartments = departments
    .map((department) => {
      const stats = departmentStats.find((item) => item.department === department.name) || {
        department: department.name,
        total: 0,
        active: 0,
        resolved: 0,
        highPriority: 0,
      };
      const departmentUsers = users.filter((entry) => entry.department === department.name);
      const activeDepartmentUsers = departmentUsers.filter((entry) => entry.isActive !== false).length;

      return {
        name: department.name,
        stats,
        departmentUsers,
        activeDepartmentUsers,
        departmentMeta: department,
      };
    })
    .sort((left, right) => (right.stats.total || 0) - (left.stats.total || 0));

  const roleTotals = users.reduce<Record<string, number>>((acc, entry) => {
    const key = entry.role || 'UNKNOWN';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const adminCount = roleTotals.ADMIN || 0;
  const superAdminCount = roleTotals.SUPER_ADMIN || 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-gradient-to-br from-slate-50 via-white to-cyan-50/70 p-5 shadow-xl dark:border-white/5 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/60 lg:p-6 dark:shadow-2xl">
        <div className="absolute inset-0 opacity-60">
          <div className="absolute -top-16 right-0 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl dark:bg-cyan-500/15" />
          <div className="absolute -bottom-16 left-0 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl dark:bg-violet-500/15" />
        </div>

        <div className="relative z-10 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-lg shadow-cyan-500/20">
              <LayoutDashboard className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.45em] text-cyan-600 font-bold dark:text-cyan-300/80">Superadmin Dashboard</p>
              <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900 lg:text-4xl dark:text-white">
                Department Command View
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
                All departments’ active, resolved, and high-priority complaints can be viewed in a single dashboard.
User management can also be monitored department-wise.
              </p>
            </div>
          </div>

          {fetchError && (
            <p className="text-xs text-rose-600 dark:text-rose-300">{fetchError}</p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500/80 dark:text-white/35">Departments</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCount(departments.length)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500/80 dark:text-white/35">Officials</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCount(users.length)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500/80 dark:text-white/35">Admins</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCount(adminCount)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur shadow-sm dark:border-white/10 dark:bg-white/5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500/80 dark:text-white/35">Super Admins</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCount(superAdminCount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Complaints" value={formatCount(summary?.total || 0)} icon={TrendingUp} accent="bg-cyan-500/20" />
        <StatCard label="Active Complaints" value={formatCount(activeComplaints)} icon={Activity} accent="bg-amber-500/20" />
        <StatCard label="Resolved Complaints" value={formatCount(summary?.resolved || 0)} icon={CheckCircle2} accent="bg-emerald-500/20" />
        <StatCard label="High Priority" value={formatCount(highPriorityComplaints)} icon={AlertTriangle} accent="bg-rose-500/20" />
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Department Dashboards</h2>
          <p className="text-sm text-slate-500 mt-1 dark:text-white/40">Har department ke complaints aur officials ka current snapshot.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dashboardDepartments.map((department, index) => (
            <motion.div
              key={department.name}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-4 border border-slate-200/70 bg-white/80 text-slate-900 shadow-sm dark:border-white/5 dark:bg-white/5 dark:text-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                    <h3 className="text-lg font-bold text-slate-900 uppercase tracking-tight dark:text-white">{department.name}</h3>
                  </div>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">
                    {department.departmentMeta?.type || 'Department'}
                    {department.departmentMeta?.location ? ` • ${department.departmentMeta.location}` : ''}
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-600 dark:bg-white/5 dark:text-white/55">
                  {department.departmentUsers.length} Officials
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">Total</p>
                  <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{formatCount(department.stats.total || 0)}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">Active</p>
                  <p className="mt-2 text-xl font-bold text-cyan-700 dark:text-cyan-300">{formatCount(department.stats.active || 0)}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">Resolved</p>
                  <p className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatCount(department.stats.resolved || 0)}</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 dark:bg-white/5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">High Priority</p>
                  <p className="mt-2 text-xl font-bold text-rose-600 dark:text-rose-300">{formatCount(department.stats.highPriority || 0)}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/5 dark:bg-black/20">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">User Management</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-white">{formatCount(department.activeDepartmentUsers)} active / {formatCount(department.departmentUsers.length)} total</p>
                </div>
                <UserCog className="h-5 w-5 text-slate-500 dark:text-white/45" />
              </div>
            </motion.div>
          ))}
        </div>
        {!isFetching && dashboardDepartments.length === 0 && (
          <div className="glass-card p-5 border border-slate-200/70 bg-white/80 text-sm text-slate-600 shadow-sm dark:border-white/5 dark:bg-white/5 dark:text-white/50">
            No department data available yet. Add departments or sync complaints to populate this view.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2 border border-slate-200/70 bg-white/80 text-slate-900 shadow-sm dark:border-white/5 dark:bg-white/5 dark:text-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Management Snapshot</h2>
              <p className="text-sm text-slate-500 mt-1 dark:text-white/40">Department-wise officials aur role split.</p>
            </div>
            <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-200/70 text-left text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:border-white/5 dark:text-white/30">
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Officials</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-3 py-3">Admins</th>
                  <th className="px-3 py-3">Super Admins</th>
                </tr>
              </thead>
              <tbody>
                {dashboardDepartments.map((department) => {
                  const departmentAdmins = department.departmentUsers.filter((entry) => entry.role === 'ADMIN').length;
                  const departmentSuperAdmins = department.departmentUsers.filter((entry) => entry.role === 'SUPER_ADMIN').length;

                  return (
                    <tr key={department.name} className="border-b border-slate-200/70 hover:bg-slate-50/80 dark:border-white/[0.03] dark:hover:bg-white/[0.02]">
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900 dark:text-white">{department.name}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-white/65">{formatCount(department.departmentUsers.length)}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-white/65">{formatCount(department.activeDepartmentUsers)}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-white/65">{formatCount(departmentAdmins)}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-white/65">{formatCount(departmentSuperAdmins)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card p-5 border border-slate-200/70 bg-white/80 text-slate-900 shadow-sm dark:border-white/5 dark:bg-white/5 dark:text-white">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Role Split</h2>
              <p className="text-sm text-slate-500 mt-1 dark:text-white/40">Current user management distribution.</p>
            </div>
            <BadgeCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
          </div>

          <div className="space-y-3">
            {Object.keys(roleTotals).length === 0 && (
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-4 text-sm text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-white/45">
                No users found.
              </div>
            )}

            {Object.entries(roleTotals).map(([role, count]) => (
              <div key={role} className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-4 flex items-center justify-between dark:border-white/5 dark:bg-white/[0.03]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500/80 dark:text-white/35">{role.replace('_', ' ')}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{formatCount(count)}</p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-cyan-500/15 flex items-center justify-center">
                  <UserCog className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}