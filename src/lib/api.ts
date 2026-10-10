import {
  Meeting,
  Decision,
  ActionItem,
  AuditLog,
  DashboardMetrics,
  SystemSettings,
} from '../types/index.ts';

export async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.error) errorMsg = errorData.error;
      if (errorData.details) {
        errorMsg += ': ' + errorData.details.map((d: any) => `${d.path}: ${d.message}`).join(', ');
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Meetings
  getMeetings: () => fetchJson<Meeting[]>('/api/meetings'),
  getMeeting: (id: string) =>
    fetchJson<{
      meeting: Meeting;
      decisions: Decision[];
      actionItems: ActionItem[];
      auditLogs: AuditLog[];
    }>(`/api/meetings/${id}`),
  createMeeting: (data: {
    title: string;
    meetingDate: string;
    participants: string[];
    transcript: string;
  }) =>
    fetchJson<Meeting>('/api/meetings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteMeeting: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/meetings/${id}`, {
      method: 'DELETE',
    }),
  extractMeeting: (id: string) =>
    fetchJson<{
      meeting: Meeting;
      decisions: Decision[];
      actionItems: ActionItem[];
      metrics: { processingTimeMs: number; modelUsed: string };
    }>(`/api/meetings/${id}/extract`, {
      method: 'POST',
    }),

  // Action Items
  getActionItems: (params?: {
    meetingId?: string;
    status?: string;
    needsReview?: boolean;
    search?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.meetingId) query.set('meetingId', params.meetingId);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.needsReview !== undefined) query.set('needsReview', String(params.needsReview));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return fetchJson<(ActionItem & { meetingTitle?: string })[]>(
      `/api/action-items${qs ? `?${qs}` : ''}`
    );
  },
  updateActionItem: (id: string, updates: Partial<ActionItem>) =>
    fetchJson<ActionItem>(`/api/action-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  deleteActionItem: (id: string) =>
    fetchJson<{ success: boolean }>(`/api/action-items/${id}`, {
      method: 'DELETE',
    }),
  completeActionItem: (id: string) =>
    fetchJson<ActionItem>(`/api/action-items/${id}/complete`, {
      method: 'POST',
    }),
  approveActionItem: (id: string) =>
    fetchJson<ActionItem>(`/api/action-items/${id}/approve`, {
      method: 'POST',
    }),
  rejectActionItem: (id: string) =>
    fetchJson<ActionItem>(`/api/action-items/${id}/reject`, {
      method: 'POST',
    }),
  bulkApproveMeeting: (meetingId?: string) =>
    fetchJson<{ success: boolean; count: number }>('/api/action-items/bulk-approve', {
      method: 'POST',
      body: JSON.stringify({ meetingId }),
    }),

  // Metrics
  getMetrics: () => fetchJson<DashboardMetrics>('/api/metrics'),

  // Audit Logs
  getAuditLogs: (limit = 100) => fetchJson<AuditLog[]>(`/api/audit-logs?limit=${limit}`),

  // Settings
  getSettings: () => fetchJson<SystemSettings>('/api/settings'),
  updateSettings: (settings: Partial<SystemSettings>) =>
    fetchJson<SystemSettings>('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),

  // Reseed data
  seedData: () =>
    fetchJson<{ success: boolean; message: string }>('/api/seed', {
      method: 'POST',
    }),

  // Supabase Integration
  getSupabaseStatus: () =>
    fetchJson<{
      connected: boolean;
      projectId: string;
      url: string;
      tables: {
        meetings: boolean;
        decisions: boolean;
        action_items: boolean;
        audit_logs: boolean;
        system_settings: boolean;
      };
      allReady: boolean;
      error?: string;
    }>('/api/supabase/status'),

  syncToSupabase: () =>
    fetchJson<{
      success: boolean;
      synced: {
        meetings: number;
        decisions: number;
        actionItems: number;
        auditLogs: number;
      };
      error?: string;
    }>('/api/supabase/sync', {
      method: 'POST',
    }),

  getSupabaseSql: () => fetchJson<{ sql: string }>('/api/supabase/sql'),
};
