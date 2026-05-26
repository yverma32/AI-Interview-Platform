namespace InterviewPlatform.API.Models;

public class Payment
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string RazorpayOrderId { get; set; } = string.Empty;
    public string? RazorpayPaymentId { get; set; }
    public string? RazorpaySignature { get; set; }

    public string PackId { get; set; } = string.Empty; // starter | basic | premium | pro
    public int BasicCreditsAdded { get; set; }
    public int PremiumCreditsAdded { get; set; }

    /// <summary>
    /// True if THIS payment was the one that granted the founding-member 2× bonus. Lets the
    /// /verify endpoint surface the bonus correctly even when the webhook crediting raced ahead
    /// of the client-side verify call. Without this column, the verify idempotency branch would
    /// return bonusApplied=false on a payment that did in fact apply the bonus via the webhook
    /// path, and the celebration modal would never fire.
    /// </summary>
    public bool FoundingMemberBonusApplied { get; set; } = false;

    public int AmountInPaise { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "Created"; // Created, Paid, Failed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
