import { useQuery } from '@tanstack/react-query';
import { interviewService } from '../services/interviewService';

export const useInterviewHistory = () =>
  useQuery({
    queryKey: ['interview-history'],
    queryFn: () => interviewService.getHistory(),
  });
