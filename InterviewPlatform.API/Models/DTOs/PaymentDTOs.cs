using System.ComponentModel.DataAnnotations;

namespace InterviewPlatform.API.Models.DTOs;

public class CreateOrderRequest
{
    [Required]
    [RegularExpression("^(starter|basic|premium|pro)$", ErrorMessage = "Invalid pack. Must be starter, basic, premium, or pro.")]
    public string PackId { get; set; } = string.Empty;
}

public class CreateOrderResponse
{
    public string OrderId { get; set; } = string.Empty;
    public int Amount { get; set; } // in paise
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
