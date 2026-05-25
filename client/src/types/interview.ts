// ───────────── Interview Types ─────────────

export type InterviewMode = 'basic' | 'premium';

export interface InterviewStartResponse {
  sessionId: number;
  message: string;
  questionNumber: number;
  totalQuestions: number;
  topic?: string;
  interviewMode: InterviewMode;
}

export interface AnswerResponse {
  message: string;
  score?: number;
  feedback?: string;
  questionNumber: number;
  totalQuestions: number;
  topic?: string;
  isComplete: boolean;
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string[];
  improvements?: string[];
}

export interface InterviewHistoryItem {
  id: number;
  technology: string;
  experienceLevel: string;
  totalQuestions: number;
  status: string;
  overallScore?: number;
  startedAt: string;
  completedAt?: string;
}

export interface InterviewDetail {
  id: number;
  technology: string;
  experienceLevel: string;
  totalQuestions: number;
  status: string;
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string[];
  improvements?: string[];
  startedAt: string;
  completedAt?: string;
  messages: MessageResponse[];
}

export interface MessageResponse {
  role: string;
  content: string;
  score?: number;
  feedback?: string;
  questionTopic?: string;
  questionNumber?: number;
  createdAt: string;
}

export interface StartInterviewRequest {
  technology: string;
  experienceLevel: string;
  totalQuestions: number;
  focusTopics?: string[];
  interviewMode: InterviewMode;
}

export interface SubmitAnswerRequest {
  answer: string;
}

export interface WeakTopicItem {
  topic: string;
  averageScore: number;
  questionCount: number;
  technology: string;
}

export interface CreditBalance {
  basicCredits: number;
  premiumCredits: number;
}
