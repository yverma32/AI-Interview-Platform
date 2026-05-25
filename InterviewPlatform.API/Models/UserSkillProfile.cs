namespace InterviewPlatform.API.Models;

/// <summary>
/// Per-user onboarding profile: skill level (from assessment), target company track, and the
/// auto-generated study plan. One row per user, created after onboarding.
/// </summary>
public class UserSkillProfile
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>beginner | intermediate | advanced — from the onboarding assessment.</summary>
    public string SkillLevel { get; set; } = "intermediate";
    /// <summary>service | startup | faang</summary>
    public string CompanyTarget { get; set; } = "startup";
    public int AssessmentScore { get; set; }
    /// <summary>JSON serialized day-by-day plan generated post-assessment.</summary>
    public string? DayPlanJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
