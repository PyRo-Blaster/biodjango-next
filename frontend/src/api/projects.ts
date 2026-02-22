import { apiClient } from './client';

export interface Project {
  id: number;
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
}

export interface ProjectDetail extends Project {
  sequences: Sequence[];
}

export interface Sequence {
  id: number;
  name: string;
  sequence: string;
  created_at: string;
}

export const projectsApi = {
  list: async (): Promise<Project[]> => {
    const response = await apiClient.get<Project[]>('/api/projects/');
    return response.data;
  },

  get: async (id: number): Promise<ProjectDetail> => {
    const response = await apiClient.get<ProjectDetail>(`/api/projects/${id}/`);
    return response.data;
  },

  create: async (data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.post<Project>('/api/projects/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await apiClient.patch<Project>(`/api/projects/${id}/`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/api/projects/${id}/`);
  },

  // Sequence operations
  addSequence: async (projectId: number, sequence: { name: string; sequence: string }): Promise<Sequence> => {
    const response = await apiClient.post<Sequence>(`/api/projects/${projectId}/sequences/`, sequence);
    return response.data;
  },

  deleteSequence: async (projectId: number, sequenceId: number): Promise<void> => {
    await apiClient.delete(`/api/projects/${projectId}/sequences/${sequenceId}/`);
  },
};
