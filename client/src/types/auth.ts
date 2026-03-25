export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  experienceLevel?: string;
  preferredTechnologies?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  experienceLevel?: string;
  preferredTechnologies?: string;
}
