import api from './api';

export interface CreateOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  razorpayKeyId: string;
  packId: string;
  packName: string;
}

export interface CreditBalance {
  basicCredits: number;
  premiumCredits: number;
}

export interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  packId?: string;
  credits?: CreditBalance;
}

export const paymentService = {
  async createOrder(packId: string): Promise<CreateOrderResponse> {
    const { data } = await api.post<CreateOrderResponse>('/payment/create-order', { packId });
    return data;
  },

  async verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ): Promise<VerifyPaymentResponse> {
    const { data } = await api.post<VerifyPaymentResponse>('/payment/verify', {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    });
    return data;
  },
};
