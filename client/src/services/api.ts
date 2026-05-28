import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5290';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send HttpOnly cookies with every request (works on desktop)
});

// In-memory CSRF token cache. The token from /api/csrf/token is signed by the server
// with the JWT secret and bound to the user's id, so the middleware can validate it
// statelessly without reading any cookie. This matters on mobile Safari and Chrome
// Android private mode where third-party cookies get dropped and the old cookie-vs-
// header double-submit pattern silently breaks.
let cachedCsrfToken: string | undefined;

// ── Token storage ─────────────────────────────────────────────────────────────
// iOS Safari (and Chrome on iOS) ITP blocks cross-site cookies entirely, even
// with SameSite=None; Secure. The server sets HttpOnly cookies on login, but they
// are never sent on subsequent cross-origin requests (Vercel → Railway). To work
// around this, the server also returns tokens in the response body; we store them
// in localStorage and attach them as headers on every request.
//
// localStorage persists across page reloads and background tab kills — important
// because iOS aggressively suspends pages and the user would otherwise be logged out
// every time they switch apps.

const ACCESS_TOKEN_KEY = 'interview_access_token';
const REFRESH_TOKEN_KEY = 'interview_refresh_token';

export function storeAccessToken(token: string) {
  try {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch { /* private mode may block localStorage */ }
}

export function getAccessToken(): string | undefined {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearAccessToken() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch { /* ignore */ }
}

export function storeRefreshToken(token: string) {
  try {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch { /* ignore */ }
}

export function getRefreshToken(): string | undefined {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearRefreshToken() {
  try {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch { /* ignore */ }
}

/**
 * Invalidate the cached CSRF token. Call this after auth state changes (login, logout)
 * so the next state-changing request re-fetches a fresh token bound to the new user.
 */
export function resetCsrfToken() {
  cachedCsrfToken = undefined;
}

async function fetchCsrfTokenInternal(): Promise<string | undefined> {
  try {
    // On iOS Safari, ITP blocks the access_token cookie so the CSRF endpoint would
    // see an anonymous request and return an unsigned opaque token. The signed token
    // (which the CSRF middleware validates statelessly) is only issued for authenticated
    // users, so we must pass the stored access token as Authorization: Bearer here too.
    const headers: Record<string, string> = {};
    const storedToken = getAccessToken();
    if (storedToken) headers['Authorization'] = `Bearer ${storedToken}`;

    const { data } = await axios.get<{ success: boolean; token?: string }>(
      `${API_BASE_URL}/api/csrf/token`,
      { withCredentials: true, headers },
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

// Request interceptor — attach access token as Authorization: Bearer header (iOS ITP fallback)
// and CSRF token for state-changing requests.
api.interceptors.request.use(async (config) => {
  // iOS Safari ITP blocks cross-site cookies; use stored access token as Bearer header instead.
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const method = config.method?.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const csrfToken = cachedCsrfToken ?? (await fetchCsrfTokenInternal());
    if (csrfToken) {
      config.headers['X-XSRF-TOKEN'] = csrfToken;
    }
  }
  return config;
});

// Response interceptor — auto-refresh on 401 using cookie-based refresh with header fallback.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // First attempt: try refresh with cookie (works on desktop)
        const storedRefreshToken = getRefreshToken();
        const refreshHeaders: Record<string, string> = {};
        if (storedRefreshToken) {
          // Always send stored refresh token as header — the server accepts both cookie and header.
          refreshHeaders['X-Refresh-Token'] = storedRefreshToken;
        }

        const { data } = await axios.post(
          `${API_BASE_URL}/api/auth/refresh`,
          {},
          { withCredentials: true, headers: refreshHeaders }
        );

        if (data.success) {
          // Store rotated tokens for next request.
          if (data.accessToken) storeAccessToken(data.accessToken);
          if (data.refreshToken) storeRefreshToken(data.refreshToken);

          // Update the Authorization header on the retried request with the new access token.
          if (data.accessToken) {
            originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
          }
          return api(originalRequest);
        }
      } catch {
        // Refresh failed — clear tokens and let the caller handle the 401.
        clearAccessToken();
        clearRefreshToken();
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
