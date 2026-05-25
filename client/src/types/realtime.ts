export type RoundType = 'dsa' | 'system_design' | 'hr' | 'tech' | 'resume';
export type CompanyTrack = 'service' | 'startup' | 'faang';
export type HiringRecommendation = 'strong_yes' | 'yes' | 'no' | 'strong_no';

export interface CreateRealtimeSessionRequest {
  technology: string;
  experienceLevel: string;
  roundType: RoundType;
  companyTrack?: CompanyTrack;
  resumeContext?: string;
  focusTopics?: string[];
  totalQuestions: number;
}

export interface CreateRealtimeSessionResponse {
  clientSecret: string;
  sessionId: number;
  expiresAt: string;
  personaName: string;
  voice: string;
  realtimeModel: string;
}

export interface ScoreAnswerPayload {
  question: string;
  answer: string;
  topic: string;
  score: number;
  feedback: string;
  followUpAsked?: boolean;
  questionNumber: number;
}

export interface CompleteSessionPayload {
  transcript: TranscriptEntry[];
  overallScore?: number;
  overallFeedback?: string;
  strengths?: string[];
  improvements?: string[];
  hiringRecommendation?: HiringRecommendation;
  durationSeconds: number;
}

export interface TranscriptEntry {
  role: 'interviewer' | 'candidate';
  content: string;
  timestamp: string;
}

export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'active'
  | 'ai_speaking'
  | 'user_speaking'
  | 'ai_thinking'
  | 'ended'
  | 'error';

export interface QuestionScore {
  questionNumber: number;
  topic: string;
  score: number;
  feedback: string;
}
