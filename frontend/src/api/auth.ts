import { apiClient } from './client';

interface TokenPair {
  access: string;
  refresh: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<TokenPair> => {
    const response = await apiClient.post<TokenPair>('/auth/token/', { username, password });
    return response.data;
  },

  refresh: async (refresh: string): Promise<{ access: string }> => {
    const response = await apiClient.post<{ access: string }>('/auth/token/refresh/', { refresh });
    return response.data;
  },

  register: async (data: RegisterData): Promise<unknown> => {
    const response = await apiClient.post('/auth/register/', data);
    return response.data;
  },
};
