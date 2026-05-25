import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export interface CreditBalance {
  basicCredits: number;
  premiumCredits: number;
}

export interface CreditPack {
  id: 'starter' | 'basic' | 'premium' | 'pro';
  name: string;
  price: number;
  currency: string;
  basicCredits: number;
  premiumCredits: number;
  description: string;
  perBasicCredit: number | null;
  perPremiumCredit: number | null;
  highlight: boolean;
}

export const useCredits = () =>
  useQuery<CreditBalance>({
    queryKey: ['credits'],
    queryFn: () => api.get<CreditBalance>('/interview/credits').then((r) => r.data),
    staleTime: 30_000,
  });

export const useCreditPacks = () =>
  useQuery<{ packs: CreditPack[] }>({
    queryKey: ['credit-packs'],
    queryFn: () => api.get<{ packs: CreditPack[] }>('/pricing/packs').then((r) => r.data),
    staleTime: 60 * 60 * 1000,
  });

interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  packId: string;
  packName: string;
}

export const useCreateOrder = () =>
  useMutation<CreateOrderResponse, Error, string>({
    mutationFn: (packId) =>
      api.post<CreateOrderResponse>('/payment/create-order', { packId }).then((r) => r.data),
  });

interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  packId?: string;
  credits?: CreditBalance;
}

export const useVerifyPayment = () => {
  const queryClient = useQueryClient();
  return useMutation<
    VerifyPaymentResponse,
    Error,
    { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
  >({
    mutationFn: (data) =>
      api.post<VerifyPaymentResponse>('/payment/verify', data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
    },
  });
};
