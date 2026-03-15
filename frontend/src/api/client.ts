import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const PUBLIC_API_PREFIXES = ['/analysis/', '/auth/', '/health/'];

function normalizePath(url: string | undefined): string {
  if (!url) return '';
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    return new URL(url, base).pathname;
  } catch {
    return url;
  }
}

function isPublicPath(url: string | undefined): boolean {
  const path = normalizePath(url);
  return PUBLIC_API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function parseRetryAfter(value: unknown): number | undefined {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === 'number') {
    return value;
  }
  return undefined;
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url;
    const status = error.response?.status;

    if (status === 429) {
      return Promise.reject(error);
    }

    if (status === 401 && isPublicPath(requestUrl)) {
      return Promise.reject(error);
    }

    if (status === 401 && originalRequest && originalRequest.headers && !originalRequest.headers['X-Retry']) {
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data as { access: string };
        localStorage.setItem('access_token', access);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
          originalRequest.headers['X-Retry'] = 'true';
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface ApiErrorInfo {
  message: string;
  status?: number;
  isRateLimited: boolean;
  retryAfter?: number;
}

export function handleApiError(error: unknown): ApiErrorInfo {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 429) {
      const retryAfterHeader = error.response?.headers?.['retry-after'];
      const retryAfter = parseRetryAfter(retryAfterHeader);
      const data = error.response?.data as Record<string, unknown> | undefined;
      const detail = typeof data?.detail === 'string' ? data.detail : undefined;
      return {
        message: detail || 'Request rate limited. Please wait and retry.',
        status,
        isRateLimited: true,
        retryAfter,
      };
    }

    if (error.response) {
      const data = error.response.data as Record<string, unknown>;
      let message = 'An error occurred';
      if (typeof data.detail === 'string') {
        message = data.detail;
      } else if (typeof data.error === 'string') {
        message = data.error;
      } else if (typeof data.message === 'string') {
        message = data.message;
      } else if (Array.isArray(data)) {
        message = data.join(', ');
      } else {
        const firstArray = Object.values(data).find((value) => Array.isArray(value));
        if (Array.isArray(firstArray) && typeof firstArray[0] === 'string') {
          message = firstArray[0];
        }
      }
      return { message, status, isRateLimited: false };
    }

    if (error.request) {
      return {
        message: 'Network error. Please check your connection.',
        status,
        isRateLimited: false,
      };
    }

    return { message: error.message, status, isRateLimited: false };
  }

  return { message: 'An unexpected error occurred', isRateLimited: false };
}
