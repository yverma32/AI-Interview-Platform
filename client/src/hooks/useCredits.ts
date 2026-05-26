import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

export interface CreditBalance {
  basicCredits: number;
  premiumCredits: number;
}

export interface CreditPack {
  id: 'starter' | 'basic' | 'premium' | 'pro';
  name: string;
  priceINR: number;
  priceUSD: number;
  basicCredits: number;
  premiumCredits: number;
  description: string;
  perBasicCreditINR: number | null;
  perBasicCreditUSD: number | null;
  perPremiumCreditINR: number | null;
  perPremiumCreditUSD: number | null;
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
    queryKey: ['credit-packs-v2'],
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
  useMutation<CreateOrderResponse, Error, { packId: string; currency: string }>({
    mutationFn: ({ packId, currency }) =>
      api.post<CreateOrderResponse>('/payment/create-order', { packId, currency }).then((r) => r.data),
  });

export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  packId?: string;
  basicCreditsAdded: number;
  premiumCreditsAdded: number;
  foundingMemberBonusApplied: boolean;
  credits?: CreditBalance;
}

export interface FoundingStatus {
  totalSpots: number;
  spotsRemaining: number;
  active: boolean;
}

export interface PaymentHistoryItem {
  id: number;
  packId: string;
  packName: string;
  amountRupees: number;
  currency: string;
  currencySymbol: string;
  status: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  basicCreditsReceived: number;
  premiumCreditsReceived: number;
  foundingMemberBonusApplied: boolean;
  createdAt: string;
  paidAt?: string;
}

export const usePaymentHistory = () =>
  useQuery<PaymentHistoryItem[]>({
    queryKey: ['payment-history'],
    queryFn: () => api.get<PaymentHistoryItem[]>('/payment/history').then((r) => r.data),
    staleTime: 60_000,
  });

export const useFoundingStatus = () =>
  useQuery<FoundingStatus>({
    queryKey: ['founding-status'],
    queryFn: () => api.get<FoundingStatus>('/pricing/founding-status').then((r) => r.data),
    // Refresh every 5 min — we only need to know whether the promo is still active
    // (spots > 0), not a live count, so frequent polling is wasted bandwidth.
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

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
      // A successful purchase may have just consumed a founding-member spot — refresh the counter
      // so the banner on the pricing page reflects it immediately for other tabs/visitors.
      queryClient.invalidateQueries({ queryKey: ['founding-status'] });
    },
  });
};
