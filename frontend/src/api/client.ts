import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Callbacks the auth context installs on mount so ``client.ts`` can drive
 * navigation on a refresh failure without a hard page reload, and so token
 * mutations flow through a single source of truth.
 */
export interface AuthSeam {
  getAccessToken?: () => string | null;
  getRefreshToken?: () => string | null;
  setAccessToken?: (token: string) => void;
  onAuthFailure?: () => void;
}

let authSeam: AuthSeam | null = null;

export function installAuth(seam: AuthSeam) {
  authSeam = seam;
}

function readAccessToken(): string | null {
  const fromSeam = authSeam?.getAccessToken?.();
  if (fromSeam !== undefined && fromSeam !== null) return fromSeam;
  return localStorage.getItem('access_token');
}

function readRefreshToken(): string | null {
  const fromSeam = authSeam?.getRefreshToken?.();
  if (fromSeam !== undefined && fromSeam !== null) return fromSeam;
  return localStorage.getItem('refresh_token');
}

function persistAccessToken(token: string) {
  authSeam?.setAccessToken?.(token);
  localStorage.setItem('access_token', token);
}

function purgeSessionFallback() {
  if (authSeam?.onAuthFailure) {
    authSeam.onAuthFailure();
    return;
  }
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/login';
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
    const token = readAccessToken();
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
    const status = error.response?.status;

    if (status === 429) {
      return Promise.reject(error);
    }

    if (
      status === 401 &&
      originalRequest &&
      originalRequest.headers &&
      !originalRequest.headers['X-Retry']
    ) {
      const refreshToken = readRefreshToken();

      if (!refreshToken) {
        purgeSessionFallback();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/token/refresh/`, {
          refresh: refreshToken,
        });

        const { access } = response.data as { access: string };
        persistAccessToken(access);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access}`;
          originalRequest.headers['X-Retry'] = 'true';
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        purgeSessionFallback();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// -------------------------------------------------------------------------
// Shared helpers used by the typed api modules
// -------------------------------------------------------------------------

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Read a list endpoint that may be paginated depending on ``ENABLE_PAGINATION``. */
export function unwrapList<T>(payload: T[] | Paginated<T>): T[] {
  return Array.isArray(payload) ? payload : payload.results;
}

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
