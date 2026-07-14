import { apiClient, unwrapList, type Paginated } from './client';
import type { Sequence } from './projects';

export const sequencesApi = {
  listByProject: async (projectId: string): Promise<Sequence[]> => {
    const response = await apiClient.get<Sequence[] | Paginated<Sequence>>(
      `/projects/sequences/?project_id=${encodeURIComponent(projectId)}`,
    );
    return unwrapList(response.data);
  },
};
