namespace InterviewPlatform.API.Models;

public class User
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "User"; // User, Admin
    public string? ExperienceLevel { get; set; } // Junior, Mid, Senior
    public string? PreferredTechnologies { get; set; } // Comma-separated: ".NET,React,Java"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    // --- Credit system ---
    // 2 basic + 1 premium granted on signup; never expire. Deducted at interview start.
    public int BasicCreditsBalance { get; set; } = 2;
    public int PremiumCreditsBalance { get; set; } = 1;
    public string? RazorpayCustomerId { get; set; }

    /// <summary>
    /// True if this user redeemed the launch "first 50 buyers get double credits" promo. Set on
    /// their first successful payment if total founding members at that moment was &lt; 50. Used
    /// to (a) gate future double-credit grants (we only apply it to the FIRST purchase per user),
    /// (b) drive a "Founding Member" badge on the dashboard.
    /// </summary>
    public bool IsFoundingMember { get; set; } = false;

    // --- Account lockout ---
    public int FailedLoginAttempts { get; set; } = 0;
    public DateTime? LockoutEnd { get; set; }
    public bool IsLocked => LockoutEnd.HasValue && LockoutEnd.Value > DateTime.UtcNow;
}
