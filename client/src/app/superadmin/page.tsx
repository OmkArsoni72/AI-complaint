'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Shield, Users, FileText, Settings, Map, BarChart3, Building2, PlusCircle, Trash2, Edit, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import StatsCards from '@/components/dashboard/StatsCards';
import ComplaintTable from '@/components/admin/ComplaintTable';
import OfficerList from '@/components/admin/OfficerList';
import DepartmentChart from '@/components/analytics/DepartmentChart';
import EscalationChart from '@/components/analytics/EscalationChart';

const CityMap = dynamic(() => import('@/components/dashboard/CityMap'), { ssr: false });

export default function SuperAdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) router.push('/superadmin/login');
      else if (user.role !== 'SUPER_ADMIN') {
        router.push(user.role === 'ADMIN' ? '/admin' : '/');
      }
    }
  }, [user, isLoading, router]);

  const [stats, setStats] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [escData, setEscData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [tab, setTab] = useState<'overview' | 'users' | 'sla' | 'audit' | 'departments'>('overview');
  const [showAddDept, setShowAddDept] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newDept, setNewDept] = useState<any>({ name: '', type: 'Law Enforcement', location: '', jurisdictionLevel: 'City' });
  const [newUser, setNewUser] = useState<any>({
    name: '', email: '', password: '', role: 'ADMIN', department: '',
    rank: '', level: 1, phone: '', employeeId: '', officeAddress: '',
    district: '', state: '', pincode: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [viewingDept, setViewingDept] = useState<string | null>(null);

  const exportToCSV = (deptName: string) => {
    const deptComplaints = complaints.filter((c) => c.department === deptName);
    if (deptComplaints.length === 0) {
      toast.error('No complaints to export');
      return;
    }
    const headers = ['Complaint ID', 'Description', 'Category', 'Location', 'Priority', 'Status', 'Date'];
    const rows = deptComplaints.map((c) => [
      c.complaintId || c._id,
      `"${String(c.description || '').replace(/"/g, '""')}"`,
      c.category,
      c.location?.area || 'Unknown',
      c.priority,
      c.status,
      new Date(c.createdAt).toLocaleDateString(),
    ]);
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `${deptName}_complaints.csv`);
    a.click();
  };

  const validateField = (field: string, value: string) => {
    const trimmed = value?.trim?.() || '';
    switch (field) {
      case 'name':
        if (!trimmed) return 'Name is required';
        if (!/^[a-zA-Z\s.]+$/.test(trimmed)) return 'Name should only contain letters';
        return '';
      case 'email':
        if (!trimmed) return 'Email is required';
        if (!/^\S+@\S+\.\S+$/.test(trimmed)) return 'Invalid email format';
        return '';
      case 'password':
        if (editingUserId) return '';
        if (!trimmed || trimmed.length < 6) return 'Password must be at least 6 characters';
        return '';
      case 'phone':
        if (!trimmed) return 'Phone is required';
        if (!/^[6-9]\d{9}$/.test(trimmed)) return 'Invalid Indian phone number (10 digits)';
        return '';
      case 'pincode':
        if (!trimmed) return 'Pincode is required';
        if (!/^\d{6}$/.test(trimmed)) return 'Pincode must be 6 digits';
        return '';
      case 'rank':
        if (!trimmed) return 'Designation is required';
        return '';
      case 'employeeId':
        if (!trimmed) return 'Govt ID is required';
        return '';
      case 'department':
        if (!trimmed) return 'Department is required';
        return '';
      default:
        return '';
    }
  };

  const validateUser = () => {
    const newErrors: Record<string, string> = {
      name: validateField('name', newUser.name || ''),
      email: validateField('email', newUser.email || ''),
      password: validateField('password', newUser.password || ''),
      phone: validateField('phone', newUser.phone || ''),
      pincode: validateField('pincode', newUser.pincode || ''),
      rank: validateField('rank', newUser.rank || ''),
      employeeId: validateField('employeeId', newUser.employeeId || ''),
      department: validateField('department', newUser.department || ''),
    };

    Object.keys(newErrors).forEach((key) => {
      if (!newErrors[key]) delete newErrors[key];
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUserFieldChange = (field: string, value: string) => {
    setNewUser((prev: any) => ({ ...prev, [field]: value }));
    const error = validateField(field, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (error) next[field] = error; else delete next[field];
      return next;
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUser()) return;

    const res = editingUserId
      ? await api.updateUser(editingUserId, newUser)
      : await api.createUser(newUser);

    if (res.success) {
      toast.success(editingUserId ? 'Account Updated!' : 'Official Account Created!');
      setShowAddUser(false);
      setEditingUserId(null);
      setNewUser({
        name: '', email: '', password: '', role: 'ADMIN', department: '',
        rank: '', level: 1, phone: '', employeeId: '', officeAddress: '',
        district: '', state: '', pincode: ''
      });
      setErrors({});
      const usrRes = await api.getUsers();
      if (usrRes.success) setUsers(usrRes.data as any[]);
    } else {
      toast.error(res.message || res.error || 'Action failed');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Delete this official?')) return;
    const res = await api.deleteUser(id);
    if (res.success) {
      toast.success('Official removed');
      const usrRes = await api.getUsers();
      if (usrRes.success) setUsers(usrRes.data as any[]);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!window.confirm('Delete this department?')) return;
    const res = await api.deleteDepartment(id);
    if (res.success) {
      toast.success('Department removed');
      const dptRes = await api.getDepartments();
      if (dptRes.success) setDepartments(dptRes.data as any[]);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      const [sumRes, compRes, offRes, deptRes, escRes] = await Promise.all([
        api.getSummary(),
        api.getComplaints('limit=200'),
        api.getOfficers(),
        api.getDepartmentStats(),
        api.getEscalationStats(),
      ]);
      if (sumRes.success) setStats(sumRes.data);
      if (compRes.success) setComplaints(compRes.data as any[]);
      if (offRes.success) setOfficers(offRes.data as any[]);
      if (deptRes.success) setDeptData(deptRes.data as any[]);
      if (escRes.success) setEscData(escRes.data);

      try {
        const [usrRes, slaRes, audRes, dptRes] = await Promise.all([
          api.getUsers(),
          api.getSLAConfigs(),
          api.getAuditLogs(),
          api.getDepartments(),
        ]);
        if (usrRes.success) setUsers(usrRes.data as any[]);
        if (slaRes.success) setSlaConfigs(slaRes.data as any[]);
        if (audRes.success) setAuditLogs(audRes.data as any[]);
        if (dptRes.success) setDepartments(dptRes.data as any[]);
      } catch {}
    };
    fetchAll();

    const handler = () => fetchAll();
    window.addEventListener('crisis-simulated', handler);
    return () => window.removeEventListener('crisis-simulated', handler);
  }, []);

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDept.name?.trim()) return toast.error('Department name is required');
    if (!/^[a-zA-Z\s&-.]+$/.test(newDept.name)) return toast.error('Department name contains invalid characters');
    if (!newDept.location?.trim()) return toast.error('Location is required');
    if (!/^[a-zA-Z\s,]+$/.test(newDept.location)) return toast.error('Location contains invalid characters');

    try {
      const typeIcons: { [key: string]: string } = {
        'Law Enforcement': 'LAW',
        'Municipal / Nagar Nigam': 'MUNI',
        'Electricity': 'ELEC',
        'Water Supply': 'WATR',
        'Public Works (PWD)': 'PWD',
        'Cyber / Digital': 'CYBR',
        'Health': 'HLTH',
        'Education': 'EDU',
        'Transport': 'TRAN',
        'Revenue / Govt Office': 'REVN',
        'Anti-Corruption': 'ANTI',
        'Social Welfare': 'SWEL'
      };

      const deptData = {
        ...newDept,
        icon: typeIcons[newDept.type] || 'DEPT',
      };

      const res = editingDeptId
        ? await api.updateDepartment(editingDeptId, deptData)
        : await api.createDepartment({ ...deptData, categories: [], hierarchy: [] });

      if (res.success) {
        toast.success(editingDeptId ? 'Department Updated!' : 'Department Onboarded!');

        setShowAddDept(false);
        setEditingDeptId(null);
        setNewDept({ name: '', type: 'Law Enforcement', location: '', jurisdictionLevel: 'City' });
        const dptRes = await api.getDepartments();
        if (dptRes.success) setDepartments(dptRes.data as any[]);
      } else {
        toast.error(res.message || 'Action failed');
      }
    } catch (err) {
      toast.error('System error processing department');
    }
  };

  const startEditUser = (u: any) => {
    setNewUser({
      ...u,
      password: '',
      district: u.district || '',
      state: u.state || '',
      pincode: u.pincode || ''
    });
    setEditingUserId(u._id);
    setShowAddUser(true);
  };

  const startEditDept = (d: any) => {
    setNewDept({ name: d.name, type: d.type, location: d.location, jurisdictionLevel: d.jurisdictionLevel });
    setEditingDeptId(d._id);
    setShowAddDept(true);
  };

  const tabs = [
    { key: 'overview' as const, label: 'City Dashboard', icon: Map },
    { key: 'departments' as const, label: 'Manage Depts', icon: Building2 },
    { key: 'users' as const, label: 'User Management', icon: Users },
    { key: 'sla' as const, label: 'SLA Rules', icon: Settings },
    { key: 'audit' as const, label: 'Audit Logs', icon: FileText },
  ];

  if (isLoading || !user || user.role !== 'SUPER_ADMIN') return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative rounded-2xl overflow-hidden p-6 lg:p-8 border border-slate-200 dark:border-white/5 bg-gradient-to-br from-slate-100 to-white dark:from-slate-900/80 dark:to-slate-800/80 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-purple-600 flex items-center justify-center shadow-lg shadow-accent-500/20">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-white/70 uppercase tracking-tight">
                Superadmin Command
              </h1>
            </div>
            <p className="text-slate-500 dark:text-white/50 text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-success-500 animate-[pulse_2s_ease-in-out_infinite]"></span>
              Full system visibility & live telemetry — <strong className="text-slate-700 dark:text-white/80">{user?.region || 'Delhi NCR'}</strong>
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1.5 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.05] rounded-xl overflow-x-auto custom-scrollbar">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-white/10 text-accent-600 dark:text-accent-400 shadow-sm border border-slate-200/50 dark:border-white/10'
                  : 'text-slate-500 dark:text-white/40 hover:text-slate-800 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5'
              }`}>
              <Icon className={`w-4 h-4 ${isActive ? 'text-accent-500' : ''}`} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <StatsCards data={stats} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DepartmentChart data={deptData} />
            <EscalationChart data={escData} />
          </div>
          <OfficerList officers={officers} />
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Citywide Complaint Map</h3>
            <CityMap complaints={complaints} />
          </div>
        </div>
      )}

      {tab === 'departments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Department Management</h2>
            <button onClick={() => setShowAddDept(true)} className="btn-primary flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Add Department
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {departments.map((d, i) => (
              <motion.div key={d._id || i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-5 relative overflow-hidden group border-l-4 border-primary-500">
                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEditDept(d)} className="p-1.5 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteDept(d._id)} className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-[10px] font-bold text-primary-400">
                    {d.icon || 'DEPT'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">{d.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-primary-400 font-bold uppercase">{d.type || 'Law'}</span>
                      <span className="text-white/20">•</span>
                      <p className="text-[10px] text-white/40 font-medium">Location: {d.location}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-[9px] text-white/20 uppercase font-black tracking-widest mb-3">Department Head Performance</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(() => {
                      const stats = deptData.find(s => s.department === d.name) || { total: 0, pending: 0, resolved: 0, performance: 0 };
                      return [
                        { label: 'Total', value: stats.total },
                        { label: 'Pending', value: stats.pending },
                        { label: 'Resolved', value: stats.resolved }
                      ].map((s, idx) => (
                        <div key={idx} className="text-center p-2 rounded-lg bg-white/5">
                          <p className="text-sm font-bold text-white">{s.value}</p>
                          <p className="text-[9px] text-white/30">{s.label}</p>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={() => setViewingDept(d.name)} className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5">
                      View Complaints
                    </button>
                    <button onClick={() => exportToCSV(d.name)} className="flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20">
                      Export CSV
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">User Management</h2>
            <button onClick={() => setShowAddUser(true)} className="btn-primary flex items-center gap-2">
              <PlusCircle className="w-4 h-4" /> Add Official
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Name', 'Role', 'Department', 'Email', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <motion.tr key={u._id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-xs text-white font-semibold">{u.name}</p>
                        <p className="text-[10px] text-white/40">{u.employeeId || 'Govt Staff'}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${u.role === 'SUPER_ADMIN' ? 'bg-accent-500/15 text-accent-400' : 'bg-primary-500/15 text-primary-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{u.department || 'All Depts'}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${u.isActive !== false ? 'bg-success-500/15 text-success-400' : 'bg-danger-500/15 text-danger-400'}`}>
                        {u.isActive !== false ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEditUser(u)} className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white hover:bg-white/10">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteUser(u._id)} className="p-1.5 rounded-lg bg-danger-500/10 text-danger-400 hover:bg-danger-500/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sla' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">SLA Rules</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {slaConfigs.map((s, i) => (
              <motion.div key={s._id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{s.category}</h3>
                  <span className="text-[10px] text-white/40">{s.department}</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-2 rounded-lg bg-danger-500/10">
                    <p className="text-xs text-danger-400 font-bold">{s.priorityHigh}h</p>
                    <p className="text-[9px] text-white/30">High</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-warning-500/10">
                    <p className="text-xs text-warning-400 font-bold">{s.priorityMedium}h</p>
                    <p className="text-[9px] text-white/30">Medium</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-success-500/10">
                    <p className="text-xs text-success-400 font-bold">{s.priorityLow}h</p>
                    <p className="text-[9px] text-white/30">Low</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Audit Logs</h2>
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Action', 'By', 'Role', 'Details', 'Time'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((a, i) => (
                  <motion.tr key={a._id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-white/80 font-semibold">{a.action}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{a.performedByName || 'System'}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{a.role || 'SYSTEM'}</td>
                    <td className="px-4 py-3 text-xs text-white/40 truncate max-w-[280px]">{a.details}</td>
                    <td className="px-4 py-3 text-[10px] text-white/30">{new Date(a.createdAt).toLocaleString()}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-lg p-5 sm:p-6 my-auto shadow-2xl border-white/10">
            <h2 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-primary-400" />
              {editingDeptId ? 'Update Department' : 'Add New Department'}
            </h2>
            <form onSubmit={handleSaveDept} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Department Name</label>
                <input type="text" value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })} className="input-field text-sm" placeholder="e.g. Delhi Police" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Department Type</label>
                <select value={newDept.type} onChange={(e) => setNewDept({ ...newDept, type: e.target.value })} className="input-field text-sm">
                  {['Law Enforcement', 'Municipal / Nagar Nigam', 'Electricity', 'Water Supply', 'Public Works (PWD)', 'Cyber / Digital', 'Health', 'Education', 'Transport', 'Revenue / Govt Office', 'Anti-Corruption', 'Social Welfare'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/40 uppercase mb-1">Location</label>
                <input type="text" value={newDept.location} onChange={(e) => setNewDept({ ...newDept, location: e.target.value })} className="input-field text-sm" placeholder="e.g. Central Delhi" required />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-white/5">
                <button type="button" onClick={() => { setShowAddDept(false); setEditingDeptId(null); }}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 transition-all text-sm">Cancel</button>
                <button type="submit" className="w-full sm:flex-1 btn-primary text-sm shadow-xl shadow-primary-500/20">Save Department</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-2xl p-5 sm:p-6 my-auto shadow-2xl border-slate-200/70 bg-white/90 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white">
            <div className="flex items-start justify-between gap-3 mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary-500" />
                {editingUserId ? 'Update Official' : 'Add Official'}
              </h2>
              <button
                type="button"
                onClick={() => { setShowAddUser(false); setEditingUserId(null); setErrors({}); }}
                className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all dark:border-white/10 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Full Name</label>
                  <input type="text" value={newUser.name || ''} onChange={(e) => handleUserFieldChange('name', e.target.value)} className="input-field text-sm" placeholder="Enter full name" required />
                  {errors.name && <p className="text-[10px] text-danger-500 mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Email</label>
                  <input type="email" value={newUser.email || ''} onChange={(e) => handleUserFieldChange('email', e.target.value)} className="input-field text-sm" placeholder="name@department.gov" required />
                  {errors.email && <p className="text-[10px] text-danger-500 mt-1">{errors.email}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Password</label>
                  <input type="password" value={newUser.password || ''} onChange={(e) => handleUserFieldChange('password', e.target.value)} className="input-field text-sm" placeholder={editingUserId ? 'Leave blank to keep existing' : 'Set a secure password'} required={!editingUserId} />
                  {errors.password && <p className="text-[10px] text-danger-500 mt-1">{errors.password}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Role</label>
                  <select value={newUser.role} onChange={(e) => handleUserFieldChange('role', e.target.value)} className="input-field text-sm">
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Department</label>
                  <select value={newUser.department} onChange={(e) => handleUserFieldChange('department', e.target.value)} className="input-field text-sm" required>
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  {errors.department && <p className="text-[10px] text-danger-500 mt-1">{errors.department}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Designation</label>
                  <input type="text" value={newUser.rank || ''} onChange={(e) => handleUserFieldChange('rank', e.target.value)} className="input-field text-sm" placeholder="Designation" required />
                  {errors.rank && <p className="text-[10px] text-danger-500 mt-1">{errors.rank}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Phone</label>
                  <input type="tel" inputMode="numeric" maxLength={10} value={newUser.phone || ''} onChange={(e) => handleUserFieldChange('phone', e.target.value.replace(/[^0-9]/g, ''))} className="input-field text-sm" placeholder="10-digit mobile number" required />
                  {errors.phone && <p className="text-[10px] text-danger-500 mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Govt Employee ID</label>
                  <input type="text" value={newUser.employeeId || ''} onChange={(e) => handleUserFieldChange('employeeId', e.target.value)} className="input-field text-sm" placeholder="Employee ID" required />
                  {errors.employeeId && <p className="text-[10px] text-danger-500 mt-1">{errors.employeeId}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">District</label>
                  <input type="text" value={newUser.district || ''} onChange={(e) => handleUserFieldChange('district', e.target.value)} className="input-field text-sm" placeholder="District" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">State</label>
                  <input type="text" value={newUser.state || ''} onChange={(e) => handleUserFieldChange('state', e.target.value)} className="input-field text-sm" placeholder="State" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 dark:text-white/40">Pincode</label>
                  <input type="text" inputMode="numeric" maxLength={6} value={newUser.pincode || ''} onChange={(e) => handleUserFieldChange('pincode', e.target.value.replace(/[^0-9]/g, ''))} className="input-field text-sm" placeholder="6-digit pincode" required />
                  {errors.pincode && <p className="text-[10px] text-danger-500 mt-1">{errors.pincode}</p>}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200/70 dark:border-white/5">
                <button type="button" onClick={() => { setShowAddUser(false); setEditingUserId(null); setErrors({}); }}
                  className="w-full sm:flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all text-sm dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5">Cancel</button>
                <button type="submit" className="w-full sm:flex-1 btn-primary text-sm shadow-xl shadow-primary-500/20">Save Official</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {viewingDept && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md overflow-y-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="glass-card w-full max-w-4xl p-5 sm:p-6 my-auto shadow-2xl border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-white">{viewingDept} Complaints</h2>
              <button onClick={() => setViewingDept(null)} className="px-3 py-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10">Close</button>
            </div>
            <ComplaintTable complaints={complaints.filter((c) => c.department === viewingDept)} />
          </motion.div>
        </div>
      )}

    </div>
  );
}
