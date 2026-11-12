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

export interface UploadedMediaResult {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  originalFilename: string;
  folder: string;
}

const parseApiResponse = async <T = any>(response: Response, endpoint: string) => {
  const rawText = await response.text();
  let data: any;

  if (!rawText) {
    if (response.ok) {
      data = { success: true, data: null };
    } else if (response.status >= 500) {
      data = {
        success: false,
        message: 'Backend server is unreachable. Please ensure the backend API server is running on port 8007.'
      };
    } else {
      data = {
        success: false,
        message: `Request failed with HTTP ${response.status}.`
      };
    }
  } else {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {
        success: false,
        message:
          response.status >= 500
            ? 'Backend server is unreachable or returned an invalid response. Please ensure the backend API server is running on port 8007.'
            : `Unexpected non-JSON response from server (HTTP ${response.status}).`
      };
    }
  }

  if (!response.ok) {
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      // Session expired
      removeAuthToken();
      window.location.href = '/login';
    }
    throw new Error(data.message || `Request failed with HTTP ${response.status}`);
  }

  return data as {
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
  };
};

export const apiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
) => {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error('Unable to reach the backend server. Please ensure the API server is running.');
  }

  return parseApiResponse<T>(response, endpoint);
};

/**
 * Upload an image, video, or document directly to Cloudinary via `/api/uploads`.
 */
export const uploadMediaFile = async (
  file: File,
  category: 'kyc' | 'queries' | 'staff' | 'payments' | 'reports' | 'general' = 'general'
): Promise<UploadedMediaResult> => {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });
  } catch {
    throw new Error('Unable to reach the backend server while uploading media.');
  }

  const parsed = await parseApiResponse<UploadedMediaResult>(response, '/uploads');
  return parsed.data;
};

