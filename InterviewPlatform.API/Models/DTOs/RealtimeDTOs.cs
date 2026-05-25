using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace InterviewPlatform.API.Models.DTOs;

// ───────────── Realtime Session Requests ─────────────

public class CreateRealtimeSessionRequest
{
    [Required, StringLength(50)]
    public string Technology { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Junior|Mid-Level|Senior|Lead)$")]
    public string ExperienceLevel { get; set; } = string.Empty;

    /// <summary>dsa | system_design | hr | tech | resume. Defaults to "tech" if unspecified.
    /// The "tech" round covers any technology stack — frontend, backend, data, mobile, cloud, etc.</summary>
    [Required]
    [RegularExpression("^(dsa|system_design|hr|tech|resume)$")]
    public string RoundType { get; set; } = "tech";

    /// <summary>service | startup | faang — optional today, used by personas in Phase 4/7.</summary>
    public string? CompanyTrack { get; set; }

    /// <summary>Free-text resume context for "resume" round. Wired up properly in Phase 5.</summary>
    public string? ResumeContext { get; set; }

    [MaxLength(10)]
    public List<string>? FocusTopics { get; set; }

    [Range(3, 20)]
    public int TotalQuestions { get; set; } = 10;
}

public class CreateRealtimeSessionResponse
{
    public string ClientSecret { get; set; } = string.Empty;
    public int SessionId { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string PersonaName { get; set; } = string.Empty;
    public string Voice { get; set; } = string.Empty;
    public string RealtimeModel { get; set; } = string.Empty;
}

public class ScoreAnswerRequest
{
    [Required] public string Question { get; set; } = string.Empty;
    [Required] public string Answer { get; set; } = string.Empty;
    [Required] public string Topic { get; set; } = string.Empty;
    [Range(1, 10)] public int Score { get; set; }
    [Required] public string Feedback { get; set; } = string.Empty;
    public bool FollowUpAsked { get; set; }
    [Range(1, 50)] public int QuestionNumber { get; set; }
}

public class CompleteSessionRequest
{
    public List<TranscriptEntry> Transcript { get; set; } = new();

    /// <summary>Optional — if the end_interview tool fired, populate from its args.</summary>
    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public List<string>? Strengths { get; set; }
    public List<string>? Improvements { get; set; }
    public string? HiringRecommendation { get; set; }

    public int DurationSeconds { get; set; }
}

public class TranscriptEntry
{
    /// <summary>"interviewer" or "candidate"</summary>
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

// ───────────── OpenAI Realtime API response shape ─────────────

/// <summary>Shape of POST /v1/realtime/sessions response (subset we care about).</summary>
public class OpenAIRealtimeSessionResponse
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("model")] public string? Model { get; set; }
    [JsonPropertyName("client_secret")] public OpenAIClientSecret? ClientSecret { get; set; }
}

public class OpenAIClientSecret
{
    [JsonPropertyName("value")] public string Value { get; set; } = string.Empty;
    [JsonPropertyName("expires_at")] public long ExpiresAt { get; set; }
}
