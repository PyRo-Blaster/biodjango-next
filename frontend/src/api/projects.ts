import { apiClient } from './client';

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  owner?: {
    id: number;
    username: string;
    email: string;
  };
  is_public: boolean;
  sequences_count?: number;
  access_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
  is_allowed?: boolean;
}

export type ProjectDetail = Project;

export interface Sequence {
  id: string;
  name: string;
  sequence: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const response = await apiClient.get<Project[] | Paginated<Project>>('/projects/');
    return Array.isArray(response.data) ? response.data : response.data.results;
  },

  get: async (id: string): Promise<ProjectDetail> => {
    const response = await apiClient.get<ProjectDetail>(`/projects/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.post<Project>('/projects/', data);
    return response.data;
  },

  update: async (id: string, data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/projects/${id}/`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}/`);
  },

  uploadFasta: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/projects/${id}/upload_fasta/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  requestAccess: async (projectId: string, reason: string) => {
    const response = await apiClient.post('/projects/access-requests/', {
      project: projectId,
      reason,
    });
    return response.data;
  },
};
