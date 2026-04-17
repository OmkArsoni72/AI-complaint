export const CATEGORIES = [
  'Traffic & Transport',
  'Water Supply',
  'Electricity',
  'Sanitation',
  'Road & Infrastructure',
  'Public Safety',
  'General',
] as const;

export const DELHI_DISTRICTS = [
  'Central Delhi',
  'East Delhi',
  'New Delhi',
  'North Delhi',
  'North East Delhi',
  'North West Delhi',
  'Shahdara',
  'South Delhi',
  'South East Delhi',
  'South West Delhi',
  'West Delhi',
] as const;

export const PRIORITY_COLORS = {
  HIGH: { bg: 'bg-danger-500/15', text: 'text-danger-400', border: 'border-danger-500/25', dot: 'bg-danger-500' },
  MEDIUM: { bg: 'bg-warning-500/15', text: 'text-warning-400', border: 'border-warning-500/25', dot: 'bg-warning-500' },
  LOW: { bg: 'bg-success-500/15', text: 'text-success-400', border: 'border-success-500/25', dot: 'bg-success-500' },
} as const;

export const STATUS_COLORS = {
  PENDING: { bg: 'bg-warning-500/15', text: 'text-warning-400', label: 'Pending' },
  IN_PROGRESS: { bg: 'bg-primary-500/15', text: 'text-primary-400', label: 'In Progress' },
  RESOLVED: { bg: 'bg-success-500/15', text: 'text-success-400', label: 'Resolved' },
  ESCALATED: { bg: 'bg-danger-500/15', text: 'text-danger-400', label: 'Escalated' },
  REJECTED: { bg: 'bg-slate-500/20', text: 'text-slate-300', label: 'Rejected' },
} as const;

export const CATEGORY_ICONS: Record<string, string> = {
  'Traffic & Transport': '🚗',
  'Water Supply': '💧',
  'Electricity': '⚡',
  'Sanitation': '🗑️',
  'Road & Infrastructure': '🛣️',
  'Public Safety': '🛡️',
  'General': '📋',
};

export const DEPARTMENT_COLORS: Record<string, string> = {
  'Delhi Traffic Police': '#06b6d4',
  'Delhi Jal Board': '#0d9488',
  'BSES / TPDDL': '#f59e0b',
  'Municipal Corporation of Delhi': '#10b981',
  'Public Works Department': '#8b5cf6',
  'Delhi Police': '#f43f5e',
  'General Administration': '#64748b',
};

export const AI_INSIGHTS: any[] = [];

export const DELHI_CENTER = { lat: 28.6139, lng: 77.209 } as const;
