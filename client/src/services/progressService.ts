import api from './api';

export interface OverallStats {
  totalInterviews: number;
  completedInterviews: number;
  averageScore: number | null;
  bestScore: number | null;
  totalQuestionsAnswered: number;
  totalPracticeMinutes: number;
}

export interface ScorePoint {
  date: string;
  score: number;
  technology: string;
}

export interface TechnologyStats {
  technology: string;
  interviewCount: number;
  averageScore: number | null;
  bestScore: number | null;
  lastPracticed: string;
}

export interface TopicScore {
  topic: string;
  averageScore: number;
  questionCount: number;
}

export interface RecentSession {
  id: number;
  technology: string;
  experienceLevel: string;
  totalQuestions: number;
  status: string;
  overallScore: number | null;
  startedAt: string;
  duration: string | null;
}

export interface ProgressData {
  stats: OverallStats;
  scoreHistory: ScorePoint[];
  technologyBreakdown: TechnologyStats[];
  topicScores: TopicScore[];
  strengths: string[];
  improvements: string[];
  recentSessions: RecentSession[];
}

export const progressService = {
  async getProgress(): Promise<ProgressData> {
    const { data } = await api.get<ProgressData>('/progress');
    return data;
  },
};
