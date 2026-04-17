'use client';

import { useEffect, useState } from 'react';
import { Shield, AlertTriangle, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function SuperadminAdminPanel() {
	const [admins, setAdmins] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [warningTarget, setWarningTarget] = useState<any>(null);
	const [warningText, setWarningText] = useState('');

	useEffect(() => {
		const fetchData = async () => {
			const res = await api.getSuperadminAdmins();
			if (res.success) setAdmins(res.data as any[]);
			setIsLoading(false);
		};
		fetchData();
	}, []);

	const handleWarn = async () => {
		if (!warningTarget) return;
		const res = await api.warnSuperadminAdmin(warningTarget.id, warningText);
		if (res.success) {
			toast.success('Warning sent');
			setWarningTarget(null);
			setWarningText('');
		} else {
			toast.error(res.message || 'Failed to send warning');
		}
	};

	return (
		<div className="space-y-6 animate-fade-in">
			<div className="flex items-center gap-2">
				<Shield className="w-5 h-5 text-primary-400" />
				<h1 className="text-2xl font-bold text-white uppercase tracking-tight">Admin Panel</h1>
			</div>

			<div className="glass-card p-5">
				<div className="flex items-center justify-between">
					<div>
						<p className="text-sm text-white/70">Head Admin Performance Overview</p>
						<p className="text-xs text-white/40">Only admins created by superadmin departments are shown.</p>
					</div>
				</div>
			</div>

			<div className="glass-card overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-white/5">
								{['Admin', 'Department', 'Total', 'Resolved', 'Pending', 'Avg Days', 'Last Login', 'Status', 'Action'].map((h) => (
									<th key={h} className="text-left px-4 py-3 text-[10px] uppercase tracking-wider text-white/30 font-semibold">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{!isLoading && admins.length === 0 && (
								<tr>
									<td colSpan={9} className="px-4 py-8 text-center text-white/30 text-sm">
										No admins found
									</td>
								</tr>
							)}
							{admins.map((admin: any) => (
								<tr key={admin.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
									<td className="px-4 py-3">
										<div>
											<p className="text-sm text-white font-semibold">{admin.name}</p>
											<p className="text-[10px] text-white/40 flex items-center gap-1"><Mail className="w-3 h-3" /> {admin.email}</p>
										</div>
									</td>
									<td className="px-4 py-3 text-xs text-white/60">{admin.department || '—'}</td>
									<td className="px-4 py-3 text-xs text-white/60">{admin.stats?.total ?? 0}</td>
									<td className="px-4 py-3 text-xs text-success-400">{admin.stats?.resolved ?? 0}</td>
									<td className="px-4 py-3 text-xs text-warning-400">{admin.stats?.pending ?? 0}</td>
									<td className="px-4 py-3 text-xs text-white/60">
										{admin.stats?.avgResolutionMs
											? (admin.stats.avgResolutionMs / (1000 * 60 * 60 * 24)).toFixed(1)
											: '—'}
									</td>
									<td className="px-4 py-3 text-xs text-white/50">
										{admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleDateString() : '—'}
									</td>
									<td className="px-4 py-3">
										<span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${admin.status === 'ACTIVE' ? 'bg-success-500/10 text-success-400' : 'bg-danger-500/10 text-danger-400'}`}>
											{admin.status}
										</span>
									</td>
									<td className="px-4 py-3">
										<button
											onClick={() => setWarningTarget(admin)}
											className="px-2 py-1 text-[10px] rounded-md bg-danger-500/10 text-danger-300 border border-danger-500/30"
										>
											Warn
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{warningTarget && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
					<div className="glass-card w-full max-w-lg p-6">
						<div className="flex items-center gap-2 mb-4">
							<AlertTriangle className="w-5 h-5 text-danger-400" />
							<h2 className="text-lg font-bold text-white">Send Warning</h2>
						</div>
						<p className="text-sm text-white/60 mb-4">
							{warningTarget.name} ({warningTarget.department})
						</p>
						<textarea
							value={warningText}
							onChange={(e) => setWarningText(e.target.value)}
							className="input-field min-h-[120px] text-sm"
							placeholder="Write warning note"
						/>
						<div className="flex gap-3 justify-end mt-4">
							<button
								onClick={() => { setWarningTarget(null); setWarningText(''); }}
								className="px-4 py-2 rounded-xl border border-white/10 text-white/60 hover:bg-white/5 text-sm"
							>
								Cancel
							</button>
							<button
								onClick={handleWarn}
								className="btn-primary text-sm"
							>
								Send Warning
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
