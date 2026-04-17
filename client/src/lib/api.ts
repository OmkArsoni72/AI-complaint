const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('grievance_token') : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; data: T; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: getAuthHeaders(),
      ...options,
    });

    // Some backend failures can return HTML (for example 404 fallback pages).
    // Parse defensively so the UI doesn't crash with "Unexpected token '<'".
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const result = isJson ? await res.json() : null;

    if (res.status === 401) {
      return { success: false, data: null as T, message: 'Session expired or invalid.' };
    }

    if (!res.ok) {
      return {
        success: false,
        data: null as T,
        message:
          (result as any)?.error ||
          (result as any)?.message ||
          `HTTP error ${res.status}${isJson ? '' : ' (non-JSON response from server)'}`,
      };
    }

    if (!isJson) {
      return {
        success: false,
        data: null as T,
        message: 'Invalid server response format',
      };
    }

    return result;
  } catch (err) {
    console.error('API Error:', err);
    return { success: false, data: null as T, message: 'Backend unavailable' };
  }
}

export const api = {
  // ── Admin (Tenant Scoped) ─────────────────────────────
  getAdminComplaints: async (params?: string) => {
    return await fetchApi<any[]>(`/admin/complaints${params ? `?${params}` : ''}`);
  },

  acceptAdminComplaint: async (id: string) => {
    return await fetchApi<any>(`/admin/complaints/${id}/accept`, { method: 'PATCH' });
  },

  rejectAdminComplaint: async (id: string, reason: string) => {
    return await fetchApi<any>(`/admin/complaints/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    });
  },

  assignAdminComplaint: async (id: string, officerId: string) => {
    return await fetchApi<any>(`/admin/complaints/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ officerId }),
    });
  },

  updateAdminComplaintStatus: async (id: string, status: string, remarks?: string) => {
    return await fetchApi<any>(`/admin/complaints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    });
  },

  addAdminComplaintRemark: async (id: string, text: string) => {
    return await fetchApi<any>(`/admin/complaints/${id}/remark`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  getAdminOfficers: async () => {
    return await fetchApi<any[]>('/admin/officers');
  },

  createAdminOfficer: async (data: any) => {
    return await fetchApi<any>('/admin/officers', { method: 'POST', body: JSON.stringify(data) });
  },

  getSubDepartments: async () => {
    return await fetchApi<any[]>('/admin/sub-departments');
  },

  createSubDepartment: async (data: any) => {
    return await fetchApi<any>('/admin/sub-departments', { method: 'POST', body: JSON.stringify(data) });
  },

  updateSubDepartment: async (id: string, data: any) => {
    return await fetchApi<any>(`/admin/sub-departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteSubDepartment: async (id: string) => {
    return await fetchApi<any>(`/admin/sub-departments/${id}`, { method: 'DELETE' });
  },
  // ── Complaints ──────────────────────────────────────────
  getComplaints: async (params?: string) => {
    return await fetchApi<any[]>(`/complaints${params ? `?${params}` : ''}`);
  },

  getMyComplaints: async () => {
    return await fetchApi<any[]>(`/complaints/my`);
  },

  getComplaint: async (id: string) => {
    return await fetchApi<any>(`/complaints/${id}`);
  },

  createComplaint: async (data: any) => {
    return await fetchApi<any>('/complaints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateComplaint: async (id: string, data: any) => {
    return await fetchApi<any>(`/complaints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updateStatus: async (id: string, status: string, remarks?: string) => {
    return await fetchApi<any>(`/complaints/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, remarks }),
    });
  },

  addFeedback: async (id: string, satisfied: boolean, comment: string) => {
    return await fetchApi<any>(`/complaints/${id}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ satisfied, comment }),
    });
  },

  // ── Officers ────────────────────────────────────────────
  getOfficers: async () => {
    const res = await fetchApi<any[]>('/officers');
    if (res.success && res.data) return res;
    return { success: true, data: [] };
  },

  // ── Analytics ───────────────────────────────────────────
  getSummary: async () => {
    return await fetchApi<any>('/analytics/summary');
  },

  getDepartmentStats: async () => {
    return await fetchApi<any[]>('/analytics/department');
  },

  getResolutionStats: async () => {
    return await fetchApi<any>('/analytics/resolution');
  },

  getEscalationStats: async () => {
    return await fetchApi<any>('/analytics/escalation');
  },

  getHeatmap: async () => {
    return await fetchApi<any[]>('/analytics/heatmap');
  },

  getAIInsights: async () => {
    return await fetchApi<any[]>('/analytics/insights');
  },

  // ── Users (SUPER_ADMIN) ─────────────────────────────────
  getUsers: async () => {
    return await fetchApi<any[]>('/users');
  },

  createUser: async (data: any) => {
    return await fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) });
  },

  updateUser: async (id: string, data: any) => {
    return await fetchApi<any>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteUser: async (id: string) => {
    return fetchApi<any>(`/users/${id}`, { method: 'DELETE' });
  },

  // ── User Profile (Self) ─────────────────────────────────
  getMe: async () => {
    return await fetchApi<any>('/users/me');
  },

  updateProfile: async (data: any) => {
    return await fetchApi<any>('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // ── SLA Config (SUPER_ADMIN) ────────────────────────────
  getSLAConfigs: async () => {
    return await fetchApi<any[]>('/sla');
  },

  updateSLAConfig: async (id: string, data: any) => {
    return await fetchApi<any>(`/sla/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  // ── Audit Logs (SUPER_ADMIN) ────────────────────────────
  getAuditLogs: async (params?: string) => {
    return await fetchApi<any[]>(`/audit-logs${params ? `?${params}` : ''}`);
  },

  // ── Notifications ──────────────────────────────────────
  getNotifications: async () => {
    return await fetchApi<any[]>('/notifications');
  },

  markNotificationAsRead: async (id: string) => {
    return await fetchApi<any>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  markAllNotificationsAsRead: async () => {
    return await fetchApi<any>('/notifications/read-all', { method: 'PATCH' });
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = typeof window !== 'undefined' ? localStorage.getItem('grievance_token') : null;
    const res = await fetch(`${API_BASE}/users/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    return await res.json();
  },

  // ── Departments (SUPER_ADMIN) ───────────────────────────
  getDepartments: async () => {
    const res = await fetchApi<any[]>('/departments');
    if (res.success && res.data) return res;
    return { success: true, data: [] };
  },

  createDepartment: async (data: any) => {
    return fetchApi<any>('/departments', { method: 'POST', body: JSON.stringify(data) });
  },

  updateDepartment: async (id: string, data: any) => {
    return fetchApi<any>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteDepartment: async (id: string) => {
    return fetchApi<any>(`/departments/${id}`, { method: 'DELETE' });
  },

  // ── Simulate Crisis ────────────────────────────────────
  simulateCrisis: async () => {
    return await fetchApi<any>('/simulate', { method: 'POST' });
  },

  // ── Superadmin Admin Management ───────────────────────
  getSuperadminAdmins: async () => {
    return await fetchApi<any[]>('/superadmin/admins');
  },

  warnSuperadminAdmin: async (id: string, message: string) => {
    return await fetchApi<any>(`/superadmin/admins/${id}/warn`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // ── Generic fetch method ────────────────────────────────
  fetchApi: async <T,>(endpoint: string, options?: RequestInit) => {
    return await fetchApi<T>(endpoint, options);
  },
};
