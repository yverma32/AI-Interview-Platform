import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5290';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly cookies with every request
});

// In-memory CSRF token cache. The token from /api/csrf/token is signed by the server
// with the JWT secret and bound to the user's id, so the middleware can validate it
// statelessly without reading any cookie. This matters on mobile Safari and Chrome
// Android private mode where third-party cookies get dropped and the old cookie-vs-
// header double-submit pattern silently breaks.
let cachedCsrfToken: string | undefined;

/**
 * Invalidate the cached CSRF token. Call this after auth state changes (login, logout)
 * so the next state-changing request re-fetches a fresh token bound to the new user.
 */
export function resetCsrfToken() {
  cachedCsrfToken = undefined;
}

async function fetchCsrfTokenInternal(): Promise<string | undefined> {
  try {
    const { data } = await axios.get<{ success: boolean; token?: string }>(
      `${API_BASE_URL}/api/csrf/token`,
      { withCredentials: true },
    );
    if (data?.token) {
      cachedCsrfToken = data.token;
      return data.token;
    }
  } catch {
    /* fall through, request will fail with 403 and surface a user-facing error */
  }
  // Fall back to cookie read for same-site deployments where document.cookie sees it.
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Request interceptor — automatically attach CSRF token for state-changing requests.
api.interceptors.request.use(async (config) => {
  const method = config.method?.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const csrfToken = cachedCsrfToken ?? (await fetchCsrfTokenInternal());
    if (csrfToken) {
      config.headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }
  return config;
});

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
 * Fetch a CSRF token from the server. Returns the token (from the response body
 * on cross-site deployments, from document.cookie as fallback) and caches it for
 * subsequent state-changing requests.
 */
export async function fetchCsrfToken(): Promise<string | undefined> {
  return fetchCsrfTokenInternal();
}

/**
 * Add CSRF header to a request config.
 */
export function withCsrf(csrfToken: string) {
  return { headers: { 'X-XSRF-TOKEN': csrfToken } };
}

export default api;
