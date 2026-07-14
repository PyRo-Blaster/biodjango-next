import { apiClient, unwrapList, type Paginated } from './client';

export interface AccessRequest {
  id: string;
  user: { username: string; email: string };
  project_name: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_username: string;
  action: string;
  target_type: string;
  object_id: string;
  ip_address: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

export const adminApi = {
  listAccessRequests: async (): Promise<AccessRequest[]> => {
    const response = await apiClient.get<AccessRequest[] | Paginated<AccessRequest>>(
      '/projects/access-requests/',
    );
    return unwrapList(response.data);
  },

  reviewAccessRequest: async (
    id: string,
    status: 'APPROVED' | 'REJECTED',
  ): Promise<void> => {
    await apiClient.patch(`/projects/access-requests/${id}/review/`, { status });
  },

  listAuditLogs: async (): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[] | Paginated<AuditLog>>(
      '/core/audit-logs/',
    );
    return unwrapList(response.data);
  },
};
