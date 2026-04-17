'use client';

import { useMemo, useState } from 'react';
import { Brain, BellRing, Clock3, Gauge, MapPin, MessageSquare, ShieldCheck, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Complaint {
  complaintId: string;
  category: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  slaDeadline?: string;
  rejectionReason?: string;
  timeline?: { step: string; time: string }[];
  location?: { area?: string; district?: string };
  assignedOfficerName?: string | null;
}

export type AdvancedSectionKey =
  | 'work-status'
  | 'performance'
  | 'alerts'
  | 'ai'
  | 'location'
  | 'communication'
  | 'controls';

type StatusValue = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED';
type StatusFilterValue = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'REJECTED';
type PriorityFilterValue = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type AiViewMode = 'FILTERED' | 'GLOBAL';

function formatDateTime(value?: string) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRemaining(deadline?: string) {
  if (!deadline) return 'No SLA';
  const ms = new Date(deadline).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'No SLA';
  if (ms <= 0) return 'Overdue';
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${h}h ${m}m left`;
}

function getProgress(status: string) {
  const s = status.toUpperCase();
  if (s === 'PENDING') return 10;
  if (s === 'IN_PROGRESS') return 60;
  if (s === 'ESCALATED') return 75;
  if (s === 'RESOLVED') return 100;
  if (s === 'REJECTED') return 100;
  return 0;
}

function getProgressWidthClass(progress: number) {
  if (progress >= 100) return 'w-full';
  if (progress >= 75) return 'w-3/4';
  if (progress >= 60) return 'w-3/5';
  if (progress >= 50) return 'w-1/2';
  if (progress >= 25) return 'w-1/4';
  return 'w-[10%]';
}

function getActionSuggestion(category?: string) {
  const map: Record<string, string> = {
    'Water Supply': 'Send water response team and inspect nearest pipeline valve',
    'Traffic & Transport': 'Dispatch traffic constable and clear choke point',
    'Public Safety': 'Assign patrol unit and verify on-ground risk',
    Electricity: 'Send line technician and check feeder fault',
    Sanitation: 'Assign sanitation team for immediate cleanup',
    'Road & Infrastructure': 'Raise repair ticket and field engineer visit',
  };
  return map[category || ''] || 'Assign field team and start site verification';
}

export default function AdminAdvancedSections({
  complaints,
  focusSection = 'all',
  onInlineStatusChange,
}: {
  complaints: Complaint[];
  focusSection?: AdvancedSectionKey | 'all';
  onInlineStatusChange?: (complaintId: string, status: StatusValue) => Promise<void>;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterValue>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [aiViewMode, setAiViewMode] = useState<AiViewMode>('FILTERED');
  const showSection = (key: AdvancedSectionKey) => focusSection === 'all' || focusSection === key;
  const areaOptions = useMemo(() => {
    return Array.from(new Set(complaints.map((c) => (c.location?.area || 'Unknown').trim()))).sort();
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return complaints.filter((c) => {
      const status = (c.status || '').toUpperCase();
      const priority = (c.priority || '').toUpperCase();
      const area = (c.location?.area || 'Unknown').trim();
      const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || priority === priorityFilter;
      const matchesArea = areaFilter === 'ALL' || area === areaFilter;
      const matchesQuery =
        q.length === 0 ||
        (c.complaintId || '').toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        area.toLowerCase().includes(q) ||
        (c.assignedOfficerName || '').toLowerCase().includes(q);

      return matchesStatus && matchesPriority && matchesArea && matchesQuery;
    });
  }, [complaints, searchText, statusFilter, priorityFilter, areaFilter]);

  const toStatusFilter = (value: string): StatusFilterValue => {
    const allowed: StatusFilterValue[] = ['ALL', 'PENDING', 'IN_PROGRESS', 'RESOLVED', 'ESCALATED', 'REJECTED'];
    return allowed.includes(value as StatusFilterValue) ? (value as StatusFilterValue) : 'ALL';
  };

  const toPriorityFilter = (value: string): PriorityFilterValue => {
    const allowed: PriorityFilterValue[] = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
    return allowed.includes(value as PriorityFilterValue) ? (value as PriorityFilterValue) : 'ALL';
  };

  const metrics = useMemo(() => {
    const assigned = filteredComplaints.filter((c) => c.assignedOfficerName && c.assignedOfficerName.trim() && c.assignedOfficerName !== '—');
    const resolved = filteredComplaints.filter((c) => c.status === 'RESOLVED');

    const avgResolutionHours = resolved.length
      ? resolved.reduce((sum, c) => {
          const start = new Date(c.createdAt).getTime();
          const end = c.resolvedAt ? new Date(c.resolvedAt).getTime() : Date.now();
          return sum + Math.max(0, end - start) / (1000 * 60 * 60);
        }, 0) / resolved.length
      : 0;

    const urgentHigh = filteredComplaints.filter((c) => c.priority === 'HIGH' && c.status !== 'RESOLVED').length;
    const slaWarning = filteredComplaints.filter((c) => {
      if (!c.slaDeadline || c.status === 'RESOLVED') return false;
      const remaining = new Date(c.slaDeadline).getTime() - Date.now();
      return remaining > 0 && remaining <= 2 * 60 * 60 * 1000;
    }).length;

    const duplicateRisk = new Set(
      filteredComplaints
        .filter((c) => c.location?.area && c.category)
        .map((c) => `${c.location?.area}::${c.category}`)
    ).size;

    const areaCounts: Record<string, number> = {};
    filteredComplaints.forEach((c) => {
      const area = c.location?.area || 'Unknown';
      areaCounts[area] = (areaCounts[area] || 0) + 1;
    });

    const topAreas = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const latest = filteredComplaints[0];
    const similar = filteredComplaints.filter(
      (c) =>
        latest &&
        c.complaintId !== latest.complaintId &&
        c.category === latest.category &&
        c.location?.area === latest.location?.area
    ).slice(0, 3);

    const workStatusRows = [...filteredComplaints].map((c) => {
      const timelineStart = (c.timeline || [])
        .find((t) => /accept|assign|in_progress|start/i.test(t.step || ''))
        ?.time;
      const started = ['IN_PROGRESS', 'ESCALATED', 'RESOLVED'].includes((c.status || '').toUpperCase());
      const startTime = started ? timelineStart || c.createdAt : null;
      const eta = c.status === 'RESOLVED' ? c.resolvedAt || c.slaDeadline || null : c.slaDeadline || null;
      const overdue = !!c.slaDeadline && new Date(c.slaDeadline).getTime() < Date.now() && c.status !== 'RESOLVED' && c.status !== 'REJECTED';
      const slaRisk = overdue ? 'High' : c.slaDeadline && formatRemaining(c.slaDeadline).includes('left') ? 'Medium' : 'Low';

      return {
        ...c,
        started,
        startTime,
        eta,
        overdue,
        slaRisk,
        progress: getProgress(c.status || 'PENDING'),
      };
    });

    const startedCount = workStatusRows.filter((r) => r.started).length;
    const notStartedCount = workStatusRows.length - startedCount;
    const overdueCount = workStatusRows.filter((r) => r.overdue).length;
    const pendingCount = workStatusRows.filter((r) => (r.status || '').toUpperCase() === 'PENDING').length;
    const inProgressCount = workStatusRows.filter((r) => (r.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const resolvedCount = workStatusRows.filter((r) => (r.status || '').toUpperCase() === 'RESOLVED').length;
    const escalatedCount = workStatusRows.filter((r) => (r.status || '').toUpperCase() === 'ESCALATED').length;
    const rejectedCount = workStatusRows.filter((r) => (r.status || '').toUpperCase() === 'REJECTED').length;

    return {
      assignedCount: assigned.length,
      avgResolutionHours,
      urgentHigh,
      slaWarning,
      duplicateRisk: Math.max(0, filteredComplaints.length - duplicateRisk),
      topAreas,
      latest,
      similar,
      workStatusRows,
      startedCount,
      notStartedCount,
      overdueCount,
      pendingCount,
      inProgressCount,
      resolvedCount,
      escalatedCount,
      rejectedCount,
    };
  }, [filteredComplaints]);

  const alertMetrics = useMemo(() => {
    const normalized = complaints.map((c) => ({
      ...c,
      normalizedStatus: (c.status || '').toUpperCase(),
      normalizedPriority: (c.priority || '').toUpperCase(),
    }));

    const openComplaints = normalized.filter((c) => c.normalizedStatus !== 'RESOLVED' && c.normalizedStatus !== 'REJECTED');
    const urgentOpen = openComplaints.filter((c) => c.normalizedPriority === 'HIGH');
    const slaWarningComplaints = openComplaints.filter((c) => {
      if (!c.slaDeadline) return false;
      const remaining = new Date(c.slaDeadline).getTime() - Date.now();
      return remaining > 0 && remaining <= 2 * 60 * 60 * 1000;
    });

    const overdueComplaints = openComplaints.filter((c) => {
      if (!c.slaDeadline) return false;
      return new Date(c.slaDeadline).getTime() <= Date.now();
    });

    const escalatedComplaints = normalized.filter((c) => c.normalizedStatus === 'ESCALATED');

    const duplicateGroupMap = new Map<string, Complaint[]>();
    normalized.forEach((c) => {
      const area = (c.location?.area || 'Unknown').trim();
      const key = `${area}::${c.category || 'General'}`;
      const prev = duplicateGroupMap.get(key) || [];
      duplicateGroupMap.set(key, [...prev, c]);
    });

    const duplicateGroups = Array.from(duplicateGroupMap.entries())
      .filter(([, items]) => items.length > 1)
      .sort((a, b) => b[1].length - a[1].length);

    return {
      urgentHigh: urgentOpen.length,
      slaWarning: slaWarningComplaints.length,
      overdueCount: overdueComplaints.length,
      escalatedCount: escalatedComplaints.length,
      duplicateRiskGroups: duplicateGroups.length,
      urgentExamples: urgentOpen.slice(0, 3).map((c) => `#${(c.complaintId || '').slice(-6)}`),
      slaExamples: slaWarningComplaints.slice(0, 3).map((c) => `#${(c.complaintId || '').slice(-6)}`),
      overdueExamples: overdueComplaints.slice(0, 3).map((c) => `#${(c.complaintId || '').slice(-6)}`),
      escalatedExamples: escalatedComplaints.slice(0, 3).map((c) => `#${(c.complaintId || '').slice(-6)}`),
      duplicateExamples: duplicateGroups.slice(0, 2).map(([key, items]) => `${key.replace('::', ' - ')} (${items.length})`),
      healthy:
        urgentOpen.length === 0 &&
        slaWarningComplaints.length === 0 &&
        overdueComplaints.length === 0 &&
        escalatedComplaints.length === 0 &&
        duplicateGroups.length === 0,
    };
  }, [complaints]);

  const aiInsights = useMemo(() => {
    const source = aiViewMode === 'GLOBAL' ? complaints : filteredComplaints;
    const latest = source[0];
    const similar = source.filter(
      (c) =>
        latest &&
        c.complaintId !== latest.complaintId &&
        c.category === latest.category &&
        c.location?.area === latest.location?.area
    ).slice(0, 3);

    return {
      source,
      latest,
      similar,
    };
  }, [aiViewMode, complaints, filteredComplaints]);

  const handleInlineStatusChange = async (complaintId: string, status: StatusValue) => {
    if (!onInlineStatusChange) return;
    try {
      setUpdatingId(complaintId);
      await onInlineStatusChange(complaintId, status);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
      <section className="glass-card p-4 border border-white/10 xl:col-span-3">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search complaint id, category, area, officer"
              className="input-field text-sm"
            />
          </div>
          <div className="w-full lg:w-44">
            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(toStatusFilter(e.target.value))}
              className="input-field text-sm"
              aria-label="Filter complaints by status"
              title="Filter by status"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ESCALATED">Escalated</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <div className="w-full lg:w-44">
            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Priority</label>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(toPriorityFilter(e.target.value))}
              className="input-field text-sm"
              aria-label="Filter complaints by priority"
              title="Filter by priority"
            >
              <option value="ALL">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div className="w-full lg:w-56">
            <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Area</label>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="input-field text-sm"
              aria-label="Filter complaints by area"
              title="Filter by area"
            >
              <option value="ALL">All Areas</option>
              {areaOptions.map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              setStatusFilter('ALL');
              setPriorityFilter('ALL');
              setAreaFilter('ALL');
            }}
            className="px-3 py-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 text-sm"
          >
            Clear Filters
          </button>
        </div>
        <p className="mt-2 text-xs text-white/50">
          Showing {filteredComplaints.length} of {complaints.length} complaints.
        </p>
      </section>

      {showSection('work-status') && (
      <section className="glass-card p-4 border border-cyan-500/20 xl:col-span-3">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-300" /> Work Status Deep Details
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/40">Work Started</p>
            <p className="text-cyan-300 font-bold text-xl">{metrics.startedCount}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/40">Not Started</p>
            <p className="text-warning-300 font-bold text-xl">{metrics.notStartedCount}</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/40">Overdue / At Risk</p>
            <p className="text-danger-300 font-bold text-xl">{metrics.overdueCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2"><p className="text-white/40">Total</p><p className="text-white font-bold text-lg">{metrics.workStatusRows.length}</p></div>
          <div className="bg-warning-500/10 border border-warning-500/20 rounded-lg px-3 py-2"><p className="text-white/40">Pending</p><p className="text-warning-300 font-bold text-lg">{metrics.pendingCount}</p></div>
          <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg px-3 py-2"><p className="text-white/40">In Progress</p><p className="text-primary-300 font-bold text-lg">{metrics.inProgressCount}</p></div>
          <div className="bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2"><p className="text-white/40">Resolved</p><p className="text-success-300 font-bold text-lg">{metrics.resolvedCount}</p></div>
          <div className="bg-danger-500/10 border border-danger-500/20 rounded-lg px-3 py-2"><p className="text-white/40">Escalated</p><p className="text-danger-300 font-bold text-lg">{metrics.escalatedCount}</p></div>
          <div className="bg-slate-500/10 border border-slate-500/20 rounded-lg px-3 py-2"><p className="text-white/40">Rejected</p><p className="text-slate-300 font-bold text-lg">{metrics.rejectedCount}</p></div>
        </div>

        <div className="space-y-2">
          {metrics.workStatusRows.length === 0 && (
            <p className="text-xs text-white/40">No complaints available for status tracking.</p>
          )}

          {metrics.workStatusRows.map((row) => (
            <div key={row.complaintId} className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-sm text-white font-semibold">
                    #{row.complaintId.slice(-6)} • {row.category}
                  </p>
                  <p className="text-xs text-white/50">
                    {row.location?.area || 'Unknown area'} | Officer: {row.assignedOfficerName || 'Unassigned'}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {row.started ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary-500/15 text-primary-300 border border-primary-500/20">
                      <CheckCircle2 className="w-3 h-3" /> Work Started
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning-500/15 text-warning-300 border border-warning-500/20">
                      <AlertTriangle className="w-3 h-3" /> Not Started
                    </span>
                  )}
                  <span className="px-2 py-1 rounded-md bg-white/10 text-white/70 border border-white/10">{row.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs mb-2">
                <div className="bg-black/20 rounded-md p-2 border border-white/5">
                  <p className="text-white/40">Started At</p>
                  <p className="text-white/80">{formatDateTime(row.startTime || undefined)}</p>
                </div>
                <div className="bg-black/20 rounded-md p-2 border border-white/5">
                  <p className="text-white/40">ETA / Deadline</p>
                  <p className="text-white/80">{formatDateTime(row.eta || undefined)}</p>
                </div>
                <div className="bg-black/20 rounded-md p-2 border border-white/5">
                  <p className="text-white/40">Remaining</p>
                  <p className={`${row.overdue ? 'text-danger-300' : 'text-white/80'}`}>{formatRemaining(row.slaDeadline)}</p>
                </div>
                <div className="bg-black/20 rounded-md p-2 border border-white/5">
                  <p className="text-white/40">SLA Risk</p>
                  <p className={`${row.slaRisk === 'High' ? 'text-danger-300' : row.slaRisk === 'Medium' ? 'text-warning-300' : 'text-success-300'}`}>{row.slaRisk}</p>
                </div>
              </div>

              <div className="mb-2">
                <div className="flex items-center justify-between text-[11px] text-white/50 mb-1">
                  <span>Completion Progress</span>
                  <span>{row.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
                  <div className={`h-full ${getProgressWidthClass(row.progress)} ${row.progress >= 100 ? 'bg-success-400' : row.overdue ? 'bg-danger-400' : 'bg-primary-400'}`} />
                </div>
              </div>

              {onInlineStatusChange && row.status !== 'REJECTED' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleInlineStatusChange(row.complaintId, 'PENDING')}
                    disabled={updatingId === row.complaintId || row.status === 'PENDING'}
                    className="px-2.5 py-1 text-[11px] rounded-md border border-warning-500/30 bg-warning-500/10 text-warning-300 disabled:opacity-50"
                  >
                    Mark Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInlineStatusChange(row.complaintId, 'IN_PROGRESS')}
                    disabled={updatingId === row.complaintId || row.status === 'IN_PROGRESS'}
                    className="px-2.5 py-1 text-[11px] rounded-md border border-primary-500/30 bg-primary-500/10 text-primary-300 disabled:opacity-50"
                  >
                    Work Started / In Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInlineStatusChange(row.complaintId, 'RESOLVED')}
                    disabled={updatingId === row.complaintId || row.status === 'RESOLVED'}
                    className="px-2.5 py-1 text-[11px] rounded-md border border-success-500/30 bg-success-500/10 text-success-300 disabled:opacity-50"
                  >
                    Mark Complete
                  </button>
                </div>
              )}

              {row.status === 'REJECTED' && row.rejectionReason && (
                <p className="text-[11px] text-slate-300 bg-slate-500/10 border border-slate-500/20 rounded-md px-2 py-1">
                  Rejection reason: {row.rejectionReason}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

      {showSection('performance') && (
      <section className="glass-card p-4 border border-primary-500/15 xl:col-span-2">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Gauge className="w-4 h-4 text-primary-400" /> Personal Performance Dashboard
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">Total</p><p className="text-white font-bold text-lg">{metrics.workStatusRows.length}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">In Progress</p><p className="text-primary-300 font-bold text-lg">{metrics.inProgressCount}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">Resolved</p><p className="text-success-400 font-bold text-lg">{metrics.resolvedCount}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">Pending</p><p className="text-warning-400 font-bold text-lg">{metrics.pendingCount}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">Escalations</p><p className="text-danger-400 font-bold text-lg">{metrics.escalatedCount}</p></div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3"><p className="text-white/40">Avg Hrs</p><p className="text-white font-bold text-lg">{metrics.avgResolutionHours.toFixed(1)}</p></div>
        </div>
        <div className="mt-3 text-xs text-white/60">
          Completion Rate: <span className="text-success-300 font-semibold">{metrics.workStatusRows.length ? Math.round((metrics.resolvedCount / metrics.workStatusRows.length) * 100) : 0}%</span>
          {' '}| Active Workload: <span className="text-primary-300 font-semibold">{metrics.inProgressCount + metrics.pendingCount}</span>
        </div>
      </section>
      )}

      {showSection('alerts') && (
      <section className="glass-card p-4 border border-warning-500/20">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-warning-400" /> Smart Alerts
        </h3>
        <p className="text-[11px] text-white/50 mb-3">
          Live alerts are calculated from all complaints (global), not just current filters.
        </p>
        <div className="space-y-2 text-xs">
          <div className={`rounded-lg px-3 py-2 border ${alertMetrics.urgentHigh > 0 ? 'bg-danger-500/10 border-danger-500/20 text-danger-300' : 'bg-white/5 border-white/10 text-white/70'}`}>
            <p>High priority open: {alertMetrics.urgentHigh}</p>
            {alertMetrics.urgentExamples.length > 0 && <p className="text-[11px] opacity-80 mt-0.5">Examples: {alertMetrics.urgentExamples.join(', ')}</p>}
          </div>

          <div className={`rounded-lg px-3 py-2 border ${alertMetrics.slaWarning > 0 ? 'bg-warning-500/10 border-warning-500/20 text-warning-300' : 'bg-white/5 border-white/10 text-white/70'}`}>
            <p>SLA warning (&lt; 2h): {alertMetrics.slaWarning}</p>
            {alertMetrics.slaExamples.length > 0 && <p className="text-[11px] opacity-80 mt-0.5">Examples: {alertMetrics.slaExamples.join(', ')}</p>}
          </div>

          <div className={`rounded-lg px-3 py-2 border ${alertMetrics.overdueCount > 0 ? 'bg-danger-500/10 border-danger-500/20 text-danger-300' : 'bg-white/5 border-white/10 text-white/70'}`}>
            <p>Overdue complaints: {alertMetrics.overdueCount}</p>
            {alertMetrics.overdueExamples.length > 0 && <p className="text-[11px] opacity-80 mt-0.5">Examples: {alertMetrics.overdueExamples.join(', ')}</p>}
          </div>

          <div className={`rounded-lg px-3 py-2 border ${alertMetrics.escalatedCount > 0 ? 'bg-danger-500/10 border-danger-500/20 text-danger-300' : 'bg-white/5 border-white/10 text-white/70'}`}>
            <p>Escalation count: {alertMetrics.escalatedCount}</p>
            {alertMetrics.escalatedExamples.length > 0 && <p className="text-[11px] opacity-80 mt-0.5">Examples: {alertMetrics.escalatedExamples.join(', ')}</p>}
          </div>

          <div className={`rounded-lg px-3 py-2 border ${alertMetrics.duplicateRiskGroups > 0 ? 'bg-primary-500/10 border-primary-500/20 text-primary-300' : 'bg-white/5 border-white/10 text-white/70'}`}>
            <p>Duplicate risk groups: {alertMetrics.duplicateRiskGroups}</p>
            {alertMetrics.duplicateExamples.length > 0 && <p className="text-[11px] opacity-80 mt-0.5">Hotspots: {alertMetrics.duplicateExamples.join(' | ')}</p>}
          </div>

          {alertMetrics.healthy && (
            <div className="rounded-lg px-3 py-2 border bg-success-500/10 border-success-500/20 text-success-300">
              System healthy: No high-risk alerts right now.
            </div>
          )}
        </div>
      </section>
      )}

      {showSection('ai') && (
      <section className="glass-card p-4 border border-white/10 xl:col-span-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent-400" /> AI Assistance
          </h3>
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => setAiViewMode('FILTERED')}
              className={`px-2.5 py-1.5 ${aiViewMode === 'FILTERED' ? 'bg-primary-500/20 text-primary-300' : 'bg-white/5 text-white/60'}`}
            >
              Filtered View
            </button>
            <button
              type="button"
              onClick={() => setAiViewMode('GLOBAL')}
              className={`px-2.5 py-1.5 border-l border-white/10 ${aiViewMode === 'GLOBAL' ? 'bg-primary-500/20 text-primary-300' : 'bg-white/5 text-white/60'}`}
            >
              All Complaints
            </button>
          </div>
        </div>
        {aiInsights.latest ? (
          <div className="space-y-3 text-xs">
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-white/50 mb-1">Suggested action</p>
              <p className="text-white">{getActionSuggestion(aiInsights.latest.category)}</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-white/50 mb-1">Priority insight</p>
              <p className="text-white">AI priority check: <span className="font-semibold">{aiInsights.latest.priority}</span> - keep escalation lock enabled for accountability.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <p className="text-white/50 mb-1">Similar complaints ({aiInsights.similar.length})</p>
              <div className="space-y-1 text-white/70">
                {aiInsights.similar.length === 0 && <p>No similar complaints in same area.</p>}
                {aiInsights.similar.map((s) => (
                  <p key={s.complaintId}>#{s.complaintId.slice(-6)} - {s.category} ({s.location?.area || 'Unknown'})</p>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-white/40">
            {aiViewMode === 'FILTERED'
              ? 'No complaints in current filters. Switch to All Complaints for global AI suggestions.'
              : 'No complaints available for AI suggestions.'}
          </p>
        )}
      </section>
      )}

      {showSection('location') && (
      <section className="glass-card p-4 border border-white/10">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary-400" /> Location Control
        </h3>
        <div className="space-y-2 text-xs">
          {metrics.topAreas.length === 0 && <p className="text-white/40">No area data found.</p>}
          {metrics.topAreas.map(([area, count]) => (
            <div key={area} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-white/70">{area}</span>
              <span className="text-primary-300 font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </section>
      )}

      {showSection('communication') && (
      <section className="glass-card p-4 border border-white/10 xl:col-span-2">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary-400" /> Communication Control
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/50 mb-1">Internal team message template</p>
            <p className="text-white/80">Team dispatched. Verify issue at location and upload proof with timestamp.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3">
            <p className="text-white/50 mb-1">Citizen update template</p>
            <p className="text-white/80">Your complaint is in progress. Assigned team is working and you will receive closure proof.</p>
          </div>
        </div>
      </section>
      )}

      {showSection('controls') && (
      <section className="glass-card p-4 border border-danger-500/20">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-danger-300" /> Non-Editable Controls
        </h3>
        <div className="space-y-2 text-xs text-white/70">
          <p>System-enforced: SLA cannot be edited by Admin.</p>
          <p>Auto-escalation cannot be stopped manually.</p>
          <p>Cross-department data access is blocked.</p>
          <p>Rule engine changes are reserved for Super Admin.</p>
        </div>
        <div className="mt-3 p-2 rounded-lg bg-danger-500/10 border border-danger-500/25 text-[11px] text-danger-200 flex items-center gap-2">
          <Clock3 className="w-3.5 h-3.5" />
          Accountability mode enabled: escalation runs automatically after SLA breach.
        </div>
      </section>
      )}
    </div>
  );
}
