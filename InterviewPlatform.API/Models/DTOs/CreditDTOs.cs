namespace InterviewPlatform.API.Models.DTOs;

/// <summary>
/// Result of asking InterviewService whether the user can start an interview in the chosen mode.
/// HasCredits=false carries a Reason for the UI to display verbatim.
/// </summary>
public class CreditCheckResult
{
    public bool HasCredits { get; set; }
    public int BasicBalance { get; set; }
    public int PremiumBalance { get; set; }
    public string? Reason { get; set; }
}

public class CreditBalanceDto
{
    public int BasicCredits { get; set; }
    public int PremiumCredits { get; set; }
}
