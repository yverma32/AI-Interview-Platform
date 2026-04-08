import api from './api';
import type {
  InterviewStartResponse,
  AnswerResponse,
  InterviewHistoryItem,
  InterviewDetail,
  StartInterviewRequest,
  SubmitAnswerRequest,
  WeakTopicItem,
} from '../types/interview';

export const interviewService = {
  async startInterview(request: StartInterviewRequest): Promise<InterviewStartResponse> {
    const { data } = await api.post<InterviewStartResponse>('/interview/start', request);
    return data;
  },

  async submitAnswer(sessionId: number, request: SubmitAnswerRequest): Promise<AnswerResponse> {
    const { data } = await api.post<AnswerResponse>(`/interview/${sessionId}/answer`, request);
    return data;
  },

  async getHistory(): Promise<InterviewHistoryItem[]> {
    const { data } = await api.get<InterviewHistoryItem[]>('/interview/history');
    return data;
  },

  async getDetail(sessionId: number): Promise<InterviewDetail> {
    const { data } = await api.get<InterviewDetail>(`/interview/${sessionId}`);
    return data;
  },

  async getWeakTopics(technology?: string): Promise<WeakTopicItem[]> {
    const params = technology ? { technology } : {};
    const { data } = await api.get<WeakTopicItem[]>('/interview/weak-topics', { params });
    return data;
  },
};
