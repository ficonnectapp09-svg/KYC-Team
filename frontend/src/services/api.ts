const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('connect_backoffice_token');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('connect_backoffice_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('connect_backoffice_token');
  localStorage.removeItem('connect_backoffice_user');
};

export const apiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{
  success: boolean;
  data: T;
  message?: string;
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  categoryCounts?: Record<string, number>;
  unreadCount?: number;
  summary?: any;
}> => {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Server response could not be parsed.'
  }));

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Session expired
      removeAuthToken();
      window.location.href = '/login';
    }
    throw new Error(data.message || `Request failed with HTTP ${response.status}`);
  }

  return data;
};

