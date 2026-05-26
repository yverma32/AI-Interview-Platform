using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace InterviewPlatform.API.Services;

public class PaymentService : IPaymentService
{
    /// <summary>How many users are eligible for the launch double-credit bonus. First 50 buyers.</summary>
    public const int FoundingMemberCap = 50;

    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly HttpClient _http;
    private readonly ILogger<PaymentService> _logger;

    public PaymentService(AppDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory, ILogger<PaymentService> logger)
    {
        _db = db;
        _config = config;
        _http = httpClientFactory.CreateClient("Razorpay");
        _logger = logger;
    }

    public async Task<CreateOrderResponse> CreateCreditOrderAsync(int userId, string packId)
    {
        var pack = CreditPacks.GetById(packId)
            ?? throw new ArgumentException($"Invalid credit pack: {packId}");

        var keyId = _config["Razorpay:KeyId"] ?? throw new InvalidOperationException("Razorpay KeyId not configured.");
        var keySecret = _config["Razorpay:KeySecret"] ?? throw new InvalidOperationException("Razorpay KeySecret not configured.");

        var orderPayload = new
        {
            amount = pack.PriceInPaise,
            currency = "INR",
            receipt = $"credits_{userId}_{packId}_{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
            notes = new { userId = userId.ToString(), packId }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.razorpay.com/v1/orders");
        request.Content = new StringContent(JsonSerializer.Serialize(orderPayload), Encoding.UTF8, "application/json");

        var authBytes = Encoding.ASCII.GetBytes($"{keyId}:{keySecret}");
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));

        var response = await _http.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Razorpay order creation failed: {Status} {Body}", response.StatusCode, responseBody);
            throw new InvalidOperationException("Failed to create payment order. Please try again.");
        }

        using var doc = JsonDocument.Parse(responseBody);
        var orderId = doc.RootElement.GetProperty("id").GetString()
            ?? throw new InvalidOperationException("Razorpay returned no order ID.");

        var payment = new Payment
        {
            UserId = userId,
            RazorpayOrderId = orderId,
            PackId = packId,
            AmountInPaise = pack.PriceInPaise,
            BasicCreditsAdded = pack.BasicCredits,
            PremiumCreditsAdded = pack.PremiumCredits,
            CreatedAt = DateTime.UtcNow
        };
        _db.Payments.Add(payment);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Razorpay order {OrderId} created for user {UserId}, pack {Pack}", orderId, userId, packId);

        return new CreateOrderResponse
        {
            OrderId = orderId,
            Amount = pack.PriceInPaise,
            Currency = "INR",
            RazorpayKeyId = keyId,
            PackId = pack.Id,
            PackName = pack.Name
        };
    }

    public async Task<VerifyPaymentResponse> VerifyAndTopUpCreditsAsync(int userId, VerifyPaymentRequest request)
    {
        var keySecret = _config["Razorpay:KeySecret"] ?? throw new InvalidOperationException("Razorpay KeySecret not configured.");

        // 1. Verify Razorpay HMAC signature.
        var payload = $"{request.RazorpayOrderId}|{request.RazorpayPaymentId}";
        var expectedSignature = ComputeHmacSha256(payload, keySecret);

        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expectedSignature),
            Encoding.UTF8.GetBytes(request.RazorpaySignature)))
        {
            _logger.LogWarning("Payment signature mismatch for order {OrderId}, user {UserId}",
                request.RazorpayOrderId, userId);
            return new VerifyPaymentResponse { Success = false, Message = "Payment verification failed." };
        }

        var payment = await _db.Payments.FirstOrDefaultAsync(
            p => p.RazorpayOrderId == request.RazorpayOrderId && p.UserId == userId);

        if (payment == null)
            return new VerifyPaymentResponse { Success = false, Message = "Payment record not found." };

        // Idempotency: if already processed, return current balance without double-crediting.
        if (payment.Status == "Paid")
        {
            var existing = await _db.Users.FindAsync(userId);
            return new VerifyPaymentResponse
            {
                Success = true,
                Message = "Payment already processed.",
                PackId = payment.PackId,
                Credits = new CreditBalanceDto
                {
                    BasicCredits = existing?.BasicCreditsBalance ?? 0,
                    PremiumCredits = existing?.PremiumCreditsBalance ?? 0
                }
            };
        }

        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return new VerifyPaymentResponse { Success = false, Message = "User not found." };

        // 2. Decide whether this purchase qualifies for the founding-member bonus, then mark
        // payment complete and top up credits in a single SaveChanges so the credit grant
        // and the founding-member flag commit atomically.
        var (basicAdded, premiumAdded, bonusApplied) = await ApplyFoundingMemberBonusAsync(user, payment);

        user.BasicCreditsBalance += basicAdded;
        user.PremiumCreditsBalance += premiumAdded;

        payment.RazorpayPaymentId = request.RazorpayPaymentId;
        payment.RazorpaySignature = request.RazorpaySignature;
        payment.Status = "Paid";
        payment.PaidAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Credits topped up for user {UserId}: +{Basic} basic, +{Premium} premium (pack {Pack}, founding-bonus={Bonus})",
            userId, basicAdded, premiumAdded, payment.PackId, bonusApplied);

        return new VerifyPaymentResponse
        {
            Success = true,
            Message = bonusApplied
                ? "🎉 Founding member bonus applied! Credits doubled."
                : "Credits added to your account!",
            PackId = payment.PackId,
            BasicCreditsAdded = basicAdded,
            PremiumCreditsAdded = premiumAdded,
            FoundingMemberBonusApplied = bonusApplied,
            Credits = new CreditBalanceDto
            {
                BasicCredits = user.BasicCreditsBalance,
                PremiumCredits = user.PremiumCreditsBalance
            }
        };
    }

    /// <summary>
    /// Decides if THIS payment qualifies the user as a founding member (first 50 buyers).
    /// Returns the (possibly doubled) credit amounts plus a flag so callers can surface "bonus applied".
    /// Idempotent at the user level: once a user IsFoundingMember, future purchases get normal credits.
    /// </summary>
    private async Task<(int basicAdded, int premiumAdded, bool bonusApplied)> ApplyFoundingMemberBonusAsync(User user, Payment payment)
    {
        if (user.IsFoundingMember)
        {
            // Already a founding member from a prior purchase; future purchases credit normally.
            return (payment.BasicCreditsAdded, payment.PremiumCreditsAdded, false);
        }

        var founderCount = await _db.Users.CountAsync(u => u.IsFoundingMember);
        if (founderCount >= FoundingMemberCap)
        {
            // Cap already filled.
            return (payment.BasicCreditsAdded, payment.PremiumCreditsAdded, false);
        }

        user.IsFoundingMember = true;
        return (payment.BasicCreditsAdded * 2, payment.PremiumCreditsAdded * 2, true);
    }

    public async Task<bool> HandleWebhookAsync(string rawBody, string signatureHeader)
    {
        var webhookSecret = _config["Razorpay:WebhookSecret"];
        if (string.IsNullOrWhiteSpace(webhookSecret))
        {
            _logger.LogError("Razorpay WebhookSecret not configured; rejecting webhook.");
            return false;
        }
        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            _logger.LogWarning("Razorpay webhook arrived without X-Razorpay-Signature header.");
            return false;
        }

        // Razorpay signs the RAW request body bytes with the webhook secret. We must compare hex-encoded HMAC-SHA256.
        var expected = ComputeHmacSha256(rawBody, webhookSecret);
        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signatureHeader)))
        {
            _logger.LogWarning("Razorpay webhook signature mismatch.");
            return false;
        }

        // Parse the event. We only care about successful captures today; other events are acknowledged but ignored.
        using var doc = JsonDocument.Parse(rawBody);
        var root = doc.RootElement;
        var eventType = root.TryGetProperty("event", out var evt) ? evt.GetString() : null;

        if (eventType != "payment.captured" && eventType != "order.paid")
        {
            _logger.LogInformation("Razorpay webhook ignored (event={Event}).", eventType);
            return true; // valid signature, just nothing to do
        }

        // Both event payloads carry the order under payload.payment.entity.order_id (and payload.order.entity.id for order.paid).
        string? orderId = null;
        if (root.TryGetProperty("payload", out var payload))
        {
            if (payload.TryGetProperty("payment", out var paymentEntity) &&
                paymentEntity.TryGetProperty("entity", out var paymentEntityInner) &&
                paymentEntityInner.TryGetProperty("order_id", out var oid))
            {
                orderId = oid.GetString();
            }
            else if (payload.TryGetProperty("order", out var orderEntity) &&
                     orderEntity.TryGetProperty("entity", out var orderEntityInner) &&
                     orderEntityInner.TryGetProperty("id", out var id))
            {
                orderId = id.GetString();
            }
        }

        if (string.IsNullOrWhiteSpace(orderId))
        {
            _logger.LogWarning("Razorpay webhook ({Event}) had no resolvable order_id.", eventType);
            return true; // signed but malformed — don't ask Razorpay to retry forever
        }

        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.RazorpayOrderId == orderId);
        if (payment == null)
        {
            // This can happen if the client created an order against a different environment, or if the
            // DB row was wiped. Acknowledge so Razorpay doesn't keep retrying.
            _logger.LogWarning("Razorpay webhook for unknown order {OrderId}.", orderId);
            return true;
        }

        if (payment.Status == "Paid")
        {
            _logger.LogInformation("Razorpay webhook for order {OrderId} ignored — already paid (idempotent).", orderId);
            return true;
        }

        var user = await _db.Users.FindAsync(payment.UserId);
        if (user == null)
        {
            _logger.LogError("Razorpay webhook for order {OrderId}: user {UserId} not found.", orderId, payment.UserId);
            return true;
        }

        // Apply the same founding-member bonus path as the client /verify route. The user-level
        // IsFoundingMember check ensures we don't double-grant if the webhook arrives after /verify.
        var (basicAdded, premiumAdded, bonusApplied) = await ApplyFoundingMemberBonusAsync(user, payment);

        user.BasicCreditsBalance += basicAdded;
        user.PremiumCreditsBalance += premiumAdded;

        // We don't have the client-side payment_id / signature here, but Razorpay's payload does — keep them if available.
        if (root.TryGetProperty("payload", out var pl) &&
            pl.TryGetProperty("payment", out var pmt) &&
            pmt.TryGetProperty("entity", out var pmtEntity) &&
            pmtEntity.TryGetProperty("id", out var pmtId))
        {
            payment.RazorpayPaymentId = pmtId.GetString();
        }
        payment.Status = "Paid";
        payment.PaidAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Razorpay webhook credited user {UserId} via order {OrderId}: +{Basic} basic, +{Premium} premium (pack {Pack}, founding-bonus={Bonus})",
            payment.UserId, orderId, basicAdded, premiumAdded, payment.PackId, bonusApplied);

        return true;
    }

    private static string ComputeHmacSha256(string data, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexStringLower(hash);
    }
}
