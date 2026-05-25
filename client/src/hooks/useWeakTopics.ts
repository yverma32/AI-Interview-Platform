import { useQuery } from '@tanstack/react-query';
import { interviewService } from '../services/interviewService';

export const useWeakTopics = (technology?: string) =>
  useQuery({
    queryKey: ['weak-topics', technology ?? null],
    queryFn: () => interviewService.getWeakTopics(technology),
  });
