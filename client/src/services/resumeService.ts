import api from './api';

export interface ParsedResume {
  name?: string;
  currentRole?: string;
  totalExperience?: string;
  skills: string[];
  projects: { name: string; description?: string; technologies: string[]; impact?: string }[];
  companies: { name: string; role?: string; duration?: string; highlights: string[] }[];
  education: { degree: string; institution?: string; year?: string }[];
}

export interface ResumeResponse {
  id: number;
  fileName: string;
  uploadedAt: string;
  parsed?: ParsedResume;
  snippet?: string;
}

export const resumeService = {
  async upload(file: File): Promise<ResumeResponse> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ResumeResponse>('/resume/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async getLatest(): Promise<ResumeResponse | null> {
    try {
      const { data } = await api.get<ResumeResponse>('/resume');
      return data;
    } catch {
      return null;
    }
  },
};
