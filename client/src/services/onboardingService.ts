import api from './api';

export interface AssessmentQuestion {
  id: number;
  question: string;
  options: string[];
  topic: string;
}

export interface AssessmentSet {
  assessmentId: string;
  questions: AssessmentQuestion[];
}

export interface AssessmentResult {
  score: number;
  total: number;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  recommendedCompanyTrack: 'service' | 'startup' | 'faang';
  strongTopics: string[];
  weakTopics: string[];
}

export const onboardingService = {
  async createAssessment(): Promise<AssessmentSet> {
    const { data } = await api.post<AssessmentSet>('/onboarding/assessment');
    return data;
  },

  async submit(assessmentId: string, answers: { questionId: number; selectedIndex: number }[]): Promise<AssessmentResult> {
    const { data } = await api.post<AssessmentResult>('/onboarding/assessment/submit', { assessmentId, answers });
    return data;
  },

  async getProfile(): Promise<AssessmentResult | null> {
    const { data } = await api.get<AssessmentResult | null>('/onboarding/profile');
    return data;
  },
};
