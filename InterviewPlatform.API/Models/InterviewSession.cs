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

    /// <summary>basic (text Q&amp;A) | premium (Realtime API voice). Defaults to basic.</summary>
    public string InterviewMode { get; set; } = "basic";

    /// <summary>Credits charged to start this session — always 1 today; column exists so future packs can scale cost per session.</summary>
    public int CreditsConsumed { get; set; } = 1;

    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public string? Strengths { get; set; }     // JSON array string
    public string? Improvements { get; set; }  // JSON array string
    public string? FocusTopics { get; set; }    // JSON array string — weak topics user chose to practice

    // --- Realtime API (Phase 3) ---
    /// <summary>dsa | system_design | hr | frontend | resume — null for legacy chat-completion sessions.</summary>
    public string? RoundType { get; set; }
    /// <summary>Alex / Priya / Rohan / Ananya / Vikram. Null for legacy sessions.</summary>
    public string? PersonaName { get; set; }
    /// <summary>service | startup | faang — added in Phase 7.</summary>
    public string? CompanyTrack { get; set; }
    /// <summary>True if this session ran through the OpenAI Realtime WebSocket pipeline.</summary>
    public bool UsedRealtimeAPI { get; set; }
    /// <summary>strong_yes | yes | no | strong_no — set by the end_interview tool call.</summary>
    public string? HiringRecommendation { get; set; }
    /// <summary>End-to-end interview duration in seconds, populated on completion.</summary>
    public int? DurationSeconds { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public ICollection<InterviewMessage> Messages { get; set; } = new List<InterviewMessage>();
}
