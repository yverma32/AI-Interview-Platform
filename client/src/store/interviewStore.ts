import { create } from 'zustand';
import type { QuestionScore, RealtimeStatus, TranscriptEntry } from '../types/realtime';

interface InterviewState {
  // Session
  sessionId: number | null;
  status: RealtimeStatus;

  // Live transcript
  transcript: TranscriptEntry[];
  currentAIText: string;

  // Scores
  questionScores: QuestionScore[];
  currentTopic: string | null;
  questionNumber: number;

  // Actions
  setSessionId: (id: number | null) => void;
  setStatus: (status: RealtimeStatus) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  updateCurrentAIText: (text: string) => void;
  appendCurrentAIText: (delta: string) => void;
  addQuestionScore: (score: QuestionScore) => void;
  setCurrentTopic: (topic: string | null) => void;
  setQuestionNumber: (n: number) => void;
  reset: () => void;
}

const initial = {
  sessionId: null,
  status: 'idle' as RealtimeStatus,
  transcript: [],
  currentAIText: '',
  questionScores: [],
  currentTopic: null,
  questionNumber: 1,
};

/**
 * Centralized Realtime interview state. RealtimeInterviewRoomPage uses local refs/state today;
 * this store is the shared seam other components (LiveScoreCard, sidebars, dashboards) can subscribe
 * to without prop-drilling. Adopt incrementally — both styles coexist safely.
 */
export const useInterviewStore = create<InterviewState>((set) => ({
  ...initial,
  setSessionId: (id) => set({ sessionId: id }),
  setStatus: (status) => set({ status }),
  addTranscriptEntry: (entry) => set((s) => ({ transcript: [...s.transcript, entry] })),
  updateCurrentAIText: (text) => set({ currentAIText: text }),
  appendCurrentAIText: (delta) => set((s) => ({ currentAIText: s.currentAIText + delta })),
  addQuestionScore: (score) => set((s) => ({ questionScores: [...s.questionScores, score] })),
  setCurrentTopic: (topic) => set({ currentTopic: topic }),
  setQuestionNumber: (n) => set({ questionNumber: n }),
  reset: () => set(initial),
}));
