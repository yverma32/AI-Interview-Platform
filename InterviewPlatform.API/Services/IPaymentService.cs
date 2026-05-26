using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IPaymentService
{
    /// <summary>Create a Razorpay order for a credit pack and persist a pending Payment row.</summary>
    Task<CreateOrderResponse> CreateCreditOrderAsync(int userId, string packId);

    /// <summary>Verify the Razorpay signature, mark payment paid, and top up the user's credit balances.</summary>
    Task<VerifyPaymentResponse> VerifyAndTopUpCreditsAsync(int userId, VerifyPaymentRequest request);

    /// <summary>
    /// Handle a Razorpay server-to-server webhook. Validates the X-Razorpay-Signature HMAC,
    /// then for "payment.captured" events tops up credits idempotently (no-op if already credited
    /// via the client /verify path).
    /// </summary>
    Task<bool> HandleWebhookAsync(string rawBody, string signatureHeader);

    /// <summary>Return the user's payment history, newest first.</summary>
    Task<List<PaymentHistoryItem>> GetPaymentHistoryAsync(int userId);
}
