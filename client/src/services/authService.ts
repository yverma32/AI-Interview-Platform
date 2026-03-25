import api, { fetchCsrfToken, withCsrf } from './api';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/auth';

export const authService = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    // Login is CSRF-exempt on the backend, no token needed
    const { data } = await api.post<AuthResponse>('/auth/login', credentials);
    return data;
  },

  async register(userData: RegisterRequest): Promise<AuthResponse> {
    // Register is CSRF-exempt on the backend
    const { data } = await api.post<AuthResponse>('/auth/register', userData);
    return data;
  },

  async logout(): Promise<void> {
    try {
      const csrfToken = await fetchCsrfToken();
      await api.post('/auth/logout', {}, csrfToken ? withCsrf(csrfToken) : {});
    } catch {
      // Even if the server call fails, clear local state
    }
  },

  async getProfile(): Promise<User> {
    const { data } = await api.get<User>('/auth/profile');
    return data;
  },
};
