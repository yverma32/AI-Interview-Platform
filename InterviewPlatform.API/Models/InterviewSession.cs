namespace InterviewPlatform.API.Models;

public class InterviewSession
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User User { get; set; } = null!;

    public string Technology { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty; // Junior, Mid, Senior, Lead
    public int TotalQuestions { get; set; }
    public int CurrentQuestionNumber { get; set; }

    /// <summary>InProgress, Completed, Abandoned</summary>
    public string Status { get; set; } = "InProgress";

    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public string? Strengths { get; set; }     // JSON array string
    public string? Improvements { get; set; }  // JSON array string

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public ICollection<InterviewMessage> Messages { get; set; } = new List<InterviewMessage>();
}
