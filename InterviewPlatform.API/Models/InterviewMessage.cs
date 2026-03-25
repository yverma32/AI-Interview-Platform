namespace InterviewPlatform.API.Models;

public class InterviewMessage
{
    public int Id { get; set; }

    public int SessionId { get; set; }
    public InterviewSession Session { get; set; } = null!;

    /// <summary>"interviewer" or "candidate"</summary>
    public string Role { get; set; } = string.Empty;

    /// <summary>The spoken/written text content</summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>AI's score for the candidate's previous answer (1-10). Set on interviewer messages.</summary>
    public int? Score { get; set; }

    /// <summary>AI's feedback on the candidate's previous answer. Set on interviewer messages.</summary>
    public string? Feedback { get; set; }

    /// <summary>Topic of the question being asked (e.g., "React Hooks")</summary>
    public string? QuestionTopic { get; set; }

    /// <summary>Which question number this message corresponds to</summary>
    public int? QuestionNumber { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
