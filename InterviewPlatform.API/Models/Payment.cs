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
    public int AmountInPaise { get; set; }
    public string Currency { get; set; } = "INR";
    public string Status { get; set; } = "Created"; // Created, Paid, Failed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
