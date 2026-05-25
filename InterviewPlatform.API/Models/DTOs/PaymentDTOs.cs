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
    public CreditBalanceDto? Credits { get; set; }
}
