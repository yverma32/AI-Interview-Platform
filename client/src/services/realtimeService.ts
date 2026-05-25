import api from './api';
import type {
  CompleteSessionPayload,
  CreateRealtimeSessionRequest,
  CreateRealtimeSessionResponse,
  ScoreAnswerPayload,
} from '../types/realtime';

export const realtimeService = {
  async createSession(req: CreateRealtimeSessionRequest): Promise<CreateRealtimeSessionResponse> {
    const { data } = await api.post<CreateRealtimeSessionResponse>('/realtime/session', req);
    return data;
  },

  async scoreAnswer(sessionId: number, payload: ScoreAnswerPayload): Promise<void> {
    await api.post(`/realtime/session/${sessionId}/score`, payload);
  },

  async completeSession(sessionId: number, payload: CompleteSessionPayload): Promise<void> {
    await api.post(`/realtime/session/${sessionId}/complete`, payload);
  },
};
