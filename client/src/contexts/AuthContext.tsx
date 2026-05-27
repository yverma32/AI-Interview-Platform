import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types/auth';
import { authService } from '../services/authService';
import { analytics } from '../services/analytics';
import { resetCsrfToken } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (data: {
    fullName: string;
    email: string;
    password: string;
    experienceLevel?: string;
    preferredTechnologies?: string;
  }) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Extract a human-friendly error message from various API error shapes.
 */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as {
      response?: { data?: { message?: string; errors?: Record<string, string[]>; title?: string }; status?: number };
      code?: string;
      message?: string;
    };

    if (err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED') {
      return 'Unable to connect to the server. Please check your connection and try again.';
    }

    if (err.response?.data) {
      const data = err.response.data;
      if (data.message) return data.message;
      if (data.errors) {
        const messages = Object.values(data.errors).flat();
        if (messages.length > 0) return messages.join(' ');
      }
      if (data.title) return data.title;
    }

    if (err.response?.status === 429) return 'Too many attempts. Please wait a moment and try again.';
    if (err.response?.status === 500) return 'Server error. Please try again later.';
    if (err.response?.status === 503) return 'Service temporarily unavailable. Please try again later.';
  }

  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // On mount, attempt to fetch profile using the HttpOnly cookie.
    // If the cookie is valid, we get the user back. If not, we're logged out.
    authService
      .getProfile()
      .then((profile) => setUser(profile))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      if (response.success && response.user) {
        setUser(response.user);
        // Drop any anonymous CSRF token cached before login; the next request will fetch
        // a fresh one signed for this user's id so the API middleware validates it.
        resetCsrfToken();
        return { success: true };
      }
      return { success: false, message: response.message || 'Invalid email or password.' };
    } catch (error: unknown) {
      return { success: false, message: extractErrorMessage(error, 'Login failed. Please try again.') };
    }
  };

  const register = async (data: {
    fullName: string;
    email: string;
    password: string;
    experienceLevel?: string;
    preferredTechnologies?: string;
  }) => {
    try {
      const response = await authService.register(data);
      if (response.success) {
        // Fire the signup event before auto-login so the funnel is "anonymous → user_registered → identified".
        analytics.userRegistered({
          experienceLevel: data.experienceLevel,
          preferredTechnologies: data.preferredTechnologies,
        });
        // Registration succeeded — now auto-login to set cookies
        return await login(data.email, data.password);
      }
      return { success: false, message: response.message || 'Registration failed.' };
    } catch (error: unknown) {
      return { success: false, message: extractErrorMessage(error, 'Registration failed. Please try again.') };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      // The previous user's signed CSRF token is now bound to an id that won't match the
      // new (anonymous) session — clear it so we re-fetch on next state-changing request.
      resetCsrfToken();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
