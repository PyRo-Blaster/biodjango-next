import { apiClient } from './client';

interface LoginResponse {
  access: string;
  refresh: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
}

interface UserInfo {
  id: number;
  username: string;
  email: string;
}

export const authApi = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/api/auth/login/', {
      username,
      password,
    });
    return response.data;
  },

  register: async (data: RegisterData): Promise<UserInfo> => {
    const response = await apiClient.post<UserInfo>('/api/auth/register/', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await apiClient.post('/api/auth/logout/', { refresh: refreshToken });
      } catch {
        // Ignore logout errors
      }
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};
