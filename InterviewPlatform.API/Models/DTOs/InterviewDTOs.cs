using System.ComponentModel.DataAnnotations;

namespace InterviewPlatform.API.Models.DTOs;

// ───────────── Requests ─────────────

public class StartInterviewRequest
{
    [Required(ErrorMessage = "Technology is required.")]
    [StringLength(50)]
    public string Technology { get; set; } = string.Empty;

    [Required(ErrorMessage = "Experience level is required.")]
    [RegularExpression("^(Junior|Mid-Level|Senior|Lead)$", ErrorMessage = "Experience level must be Junior, Mid-Level, Senior, or Lead.")]
    public string ExperienceLevel { get; set; } = string.Empty;

    [Range(3, 20, ErrorMessage = "Number of questions must be between 3 and 20.")]
    public int TotalQuestions { get; set; } = 10;

    /// <summary>Optional list of weak topic areas to focus the interview on</summary>
    [MaxLength(10, ErrorMessage = "Cannot focus on more than 10 topics.")]
    public List<string>? FocusTopics { get; set; }
}

public class SubmitAnswerRequest
{
    [Required(ErrorMessage = "Answer is required.")]
    [StringLength(5000, ErrorMessage = "Answer must not exceed 5000 characters.")]
    public string Answer { get; set; } = string.Empty;
}

// ───────────── Responses ─────────────

public class InterviewStartResponse
{
    public int SessionId { get; set; }
    public string Message { get; set; } = string.Empty;
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public string? Topic { get; set; }
}

public class AnswerResponse
{
    public string Message { get; set; } = string.Empty;
    public int? Score { get; set; }
    public string? Feedback { get; set; }
    public int QuestionNumber { get; set; }
    public int TotalQuestions { get; set; }
    public string? Topic { get; set; }
    public bool IsComplete { get; set; }

    // When complete
    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public List<string>? Strengths { get; set; }
    public List<string>? Improvements { get; set; }
}

public class InterviewHistoryItem
{
    public int Id { get; set; }
    public string Technology { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public string Status { get; set; } = string.Empty;
    public double? OverallScore { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class InterviewDetailResponse
{
    public int Id { get; set; }
    public string Technology { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public string Status { get; set; } = string.Empty;
    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public List<string>? Strengths { get; set; }
    public List<string>? Improvements { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<MessageResponse> Messages { get; set; } = new();
}

public class MessageResponse
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int? Score { get; set; }
    public string? Feedback { get; set; }
    public string? QuestionTopic { get; set; }
    public int? QuestionNumber { get; set; }
    public DateTime CreatedAt { get; set; }
}

// ───────────── AI Internal Models ─────────────

/// <summary>Structured response parsed from OpenAI's JSON output</summary>
public class AIInterviewResponse
{
    public string Message { get; set; } = string.Empty;
    public int? Score { get; set; }
    public string? Feedback { get; set; }
    public string? Topic { get; set; }
    public int? QuestionNumber { get; set; }
    public bool IsComplete { get; set; }
    public double? OverallScore { get; set; }
    public string? OverallFeedback { get; set; }
    public List<string>? Strengths { get; set; }
    public List<string>? Improvements { get; set; }
}

/// <summary>Simple chat message for building OpenAI conversation history</summary>
public class ChatMessage
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

// ───────────── Question Bank DTOs ─────────────

public class GenerateQuestionsRequest
{
    [Required(ErrorMessage = "Technology is required.")]
    [StringLength(100)]
    public string Technology { get; set; } = string.Empty;

    [StringLength(200)]
    public string? Topic { get; set; }

    [Range(1, 20)]
    public int Count { get; set; } = 10;
}

public class GeneratedQuestion
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public string Difficulty { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
}

public class BatchAnswersRequest
{
    [Required(ErrorMessage = "Technology is required.")]
    public string Technology { get; set; } = string.Empty;

    [Required]
    public List<QuestionItem> Questions { get; set; } = new();
}

public class QuestionItem
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
}

public class QuestionAnswer
{
    public int Id { get; set; }
    public string Answer { get; set; } = string.Empty;
    public string? KeyPoints { get; set; }
    public string? Tips { get; set; }
}

// ───────────── Progress DTOs ─────────────

public class ProgressResponse
{
    public OverallStats Stats { get; set; } = new();
    public List<ScorePoint> ScoreHistory { get; set; } = new();
    public List<TechnologyStats> TechnologyBreakdown { get; set; } = new();
    public List<TopicScore> TopicScores { get; set; } = new();
    public List<string> Strengths { get; set; } = new();
    public List<string> Improvements { get; set; } = new();
    public List<RecentSession> RecentSessions { get; set; } = new();
}

public class OverallStats
{
    public int TotalInterviews { get; set; }
    public int CompletedInterviews { get; set; }
    public double? AverageScore { get; set; }
    public double? BestScore { get; set; }
    public int TotalQuestionsAnswered { get; set; }
    public int TotalPracticeMinutes { get; set; }
}

public class ScorePoint
{
    public string Date { get; set; } = string.Empty;
    public double Score { get; set; }
    public string Technology { get; set; } = string.Empty;
}

public class TechnologyStats
{
    public string Technology { get; set; } = string.Empty;
    public int InterviewCount { get; set; }
    public double? AverageScore { get; set; }
    public double? BestScore { get; set; }
    public string LastPracticed { get; set; } = string.Empty;
}

public class TopicScore
{
    public string Topic { get; set; } = string.Empty;
    public double AverageScore { get; set; }
    public int QuestionCount { get; set; }
}

public class RecentSession
{
    public int Id { get; set; }
    public string Technology { get; set; } = string.Empty;
    public string ExperienceLevel { get; set; } = string.Empty;
    public int TotalQuestions { get; set; }
    public string Status { get; set; } = string.Empty;
    public double? OverallScore { get; set; }
    public string StartedAt { get; set; } = string.Empty;
    public string? Duration { get; set; }
}

/// <summary>A topic where the user scored poorly and should practice more</summary>
public class WeakTopicItem
{
    public string Topic { get; set; } = string.Empty;
    public double AverageScore { get; set; }
    public int QuestionCount { get; set; }
    public string Technology { get; set; } = string.Empty;
}
