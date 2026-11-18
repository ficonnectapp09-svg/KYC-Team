const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const getAuthToken = (): string | null => {
  return localStorage.getItem('connect_backoffice_token');
};

const inFlightGetRequests = new Map<string, Promise<any>>();
const getResponseCache = new Map<string, { data: any; timestamp: number }>();

export const clearSupportApiCache = (): void => {
  inFlightGetRequests.clear();
  getResponseCache.clear();
};

export const setAuthToken = (token: string): void => {
  clearSupportApiCache();
  localStorage.setItem('connect_backoffice_token', token);
};

export const removeAuthToken = (): void => {
  clearSupportApiCache();
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
        message: 'Backend server returned an internal error (HTTP 500). Please check backend logs.'
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
            ? (rawText && rawText.length < 200 ? rawText : `Backend server returned an error (HTTP ${response.status}).`)
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

export interface ApiResponse<T = any> {
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
}

export const apiFetch = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const token = getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  // Normalize endpoint to prevent double '/api/api/' or missing leading slash
  let cleanEndpoint = endpoint.trim();
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  } else if (cleanEndpoint.startsWith('api/')) {
    cleanEndpoint = cleanEndpoint.substring(3);
  }
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = '/' + cleanEndpoint;
  }

  const url = `${API_BASE}${cleanEndpoint}`;
  const method = String(options.method || 'GET').toUpperCase();
  const isGet = method === 'GET' || method === 'HEAD';
  const authScope = token ? token.slice(-12) : 'anon';
  const reqKey = `${authScope}:${method}:${url}`;

  if (isGet) {
    // Short 15s TTL cache for badge count endpoints; in-flight deduplication for ALL GETs
    const isCountEndpoint = cleanEndpoint.includes('/categories/counts');
    if (isCountEndpoint) {
      const cached = getResponseCache.get(reqKey);
      if (cached && Date.now() - cached.timestamp < 15000) {
        return cached.data;
      }
    }
    if (inFlightGetRequests.has(reqKey)) {
      return inFlightGetRequests.get(reqKey)!;
    }
  }

  const execute = (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch {
      throw new Error('Unable to reach the backend server. Please ensure the API server is running.');
    }

    const parsed = await parseApiResponse<T>(response, url);
    if (isGet && cleanEndpoint.includes('/categories/counts')) {
      getResponseCache.set(reqKey, { data: parsed, timestamp: Date.now() });
    } else if (!isGet) {
      // Invalidate count caches immediately after any mutation and notify Sidebar badges
      getResponseCache.clear();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('support:counts_invalidated'));
      }
    }
    return parsed;
  })();

  if (isGet) {
    inFlightGetRequests.set(reqKey, execute);
    return execute.finally(() => {
      inFlightGetRequests.delete(reqKey);
    });
  }

  return execute;
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

