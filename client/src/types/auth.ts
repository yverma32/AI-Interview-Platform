export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  experienceLevel?: string;
  preferredTechnologies?: string;
  basicCredits: number;
  premiumCredits: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  message?: string;
  refreshToken?: string;
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
