import api, { fetchCsrfToken, withCsrf, storeRefreshToken, clearRefreshToken } from './api';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth';

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    // Login is CSRF-exempt on the backend, no token needed
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    // Store refresh token in memory as fallback for mobile browsers with cookie restrictions
    if (data.refreshToken) {
      storeRefreshToken(data.refreshToken);
    }
    return data;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Register is CSRF-exempt on the backend
    const { data } = await api.post<AuthResponse>('/auth/register', userData);
    // Store refresh token in memory as fallback for mobile browsers with cookie restrictions
    if (data.refreshToken) {
      storeRefreshToken(data.refreshToken);
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      const csrfToken = await fetchCsrfToken();
      await api.post('/auth/logout', {}, csrfToken ? withCsrf(csrfToken) : {});
    } catch {
      // Even if the server call fails, clear local state
    } finally {
      clearRefreshToken();
    }
  },

  async getProfile(): Promise<User> {
    const { data } = await api.get<User>('/auth/profile');
    // Guard against the API path being misconfigured — if the request hit a SPA shell
    // (e.g. VITE_API_URL points to a frontend host and that host's catch-all serves
    // index.html), axios will hand us an HTML string or a string-with-no-id object.
    // Reject anything that doesn't look like a real User payload so the AuthProvider
    // doesn't end up "logged in" as a phantom.
    if (!data || typeof data !== 'object' || typeof (data as User).id !== 'number') {
      throw new Error('Profile response was not a valid user object — check VITE_API_URL.');
    }
    return data;
  },
};
