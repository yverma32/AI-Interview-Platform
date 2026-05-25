import { useMutation, useQueryClient } from '@tanstack/react-query';
import { realtimeService } from '../services/realtimeService';
import type { CreateRealtimeSessionRequest } from '../types/realtime';

export const useCreateRealtimeSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateRealtimeSessionRequest) => realtimeService.createSession(req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['credits'] });
      qc.invalidateQueries({ queryKey: ['interview-history'] });
    },
  });
};
