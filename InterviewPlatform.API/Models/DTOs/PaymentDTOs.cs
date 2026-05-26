using System.ComponentModel.DataAnnotations;

namespace InterviewPlatform.API.Models.DTOs;

public class CreateOrderRequest
{
    [Required]
    [RegularExpression("^(starter|basic|premium|pro)$", ErrorMessage = "Invalid pack. Must be starter, basic, premium, or pro.")]
    public string PackId { get; set; } = string.Empty;

    [RegularExpression("^(INR|USD)$", ErrorMessage = "Invalid currency. Must be INR or USD.")]
    public string Currency { get; set; } = "INR";
}

public class CreateOrderResponse
{
    public string OrderId { get; set; } = string.Empty;
    /// <summary>Smallest currency unit — paise for INR, cents for USD.</summary>
    public int Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string RazorpayKeyId { get; set; } = string.Empty;
    public string PackId { get; set; } = string.Empty;
    public string PackName { get; set; } = string.Empty;
}

public class VerifyPaymentRequest
{
    [Required]
    public string RazorpayOrderId { get; set; } = string.Empty;
    [Required]
    public string RazorpayPaymentId { get; set; } = string.Empty;
    [Required]
    public string RazorpaySignature { get; set; } = string.Empty;
}

public class VerifyPaymentResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? PackId { get; set; }
    /// <summary>Basic credits added in THIS purchase (already accounting for any bonus multiplier).</summary>
    public int BasicCreditsAdded { get; set; }
    /// <summary>Premium credits added in THIS purchase (already accounting for any bonus multiplier).</summary>
    public int PremiumCreditsAdded { get; set; }
    /// <summary>True if the founding-member 2× bonus was applied to this purchase. Used by the
    /// frontend to render the celebratory confetti modal.</summary>
    public bool FoundingMemberBonusApplied { get; set; }
    public CreditBalanceDto? Credits { get; set; }
}

/// <summary>
/// Public state of the launch founding-member promo. Drives the live counter banner on the
/// pricing page so visitors can see how many spots remain. No auth required.
/// </summary>
public class FoundingStatusDto
{
    public int TotalSpots { get; set; }
    public int SpotsRemaining { get; set; }
    public bool Active => SpotsRemaining > 0;
}

/// <summary>
/// One row of the user's billing history. Includes everything a user might need for support
/// (RazorpayPaymentId), for accounting (amount + date), or for understanding what they got
/// (credits with bonus flag). Only completed and abandoned payments are surfaced — we hide
/// stillborn Razorpay orders that never had a checkout opened.
/// </summary>
public class PaymentHistoryItem
{
    public int Id { get; set; }
    public string PackId { get; set; } = string.Empty;
    public string PackName { get; set; } = string.Empty;
    public decimal AmountRupees { get; set; }
    public string Currency { get; set; } = "INR";
    public string CurrencySymbol { get; set; } = "₹";
    public string Status { get; set; } = string.Empty;
    public string? RazorpayOrderId { get; set; }
    public string? RazorpayPaymentId { get; set; }
    public int BasicCreditsReceived { get; set; }
    public int PremiumCreditsReceived { get; set; }
    public bool FoundingMemberBonusApplied { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}
