import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5290';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly cookies with every request
});

// Request interceptor — automatically attach CSRF token for state-changing requests
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    // Read existing CSRF cookie
    let csrfToken = getCsrfFromCookie();
    if (!csrfToken) {
      // Fetch a fresh token
      await axios.get(`${API_BASE_URL}/api/csrf/token`, { withCredentials: true });
      csrfToken = getCsrfFromCookie();
    }
    if (csrfToken) {
      config.headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }
  return config;
});

function getCsrfFromCookie(): string | undefined {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Response interceptor — auto-refresh on 401 using cookie-based refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh endpoint reads refresh_token from HttpOnly cookie automatically
        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );

        if (data.success) {
          // Cookies are set by the server — just retry the original request
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — let the caller handle the error gracefully.
        // AuthContext will set user to null and routing will redirect to /login.
      }
    }

    return Promise.reject(error);
  }
);

/**
 * Fetch a CSRF token cookie from the server.
 * Must be called before state-changing requests (logout, etc.)
 */
export async function fetchCsrfToken(): Promise<string | undefined> {
  await api.get('/csrf/token');
  // Read the non-HttpOnly XSRF-TOKEN cookie
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Add CSRF header to a request config.
 */
export function withCsrf(csrfToken: string) {
  return { headers: { 'X-XSRF-TOKEN': csrfToken } };
}

export default api;
