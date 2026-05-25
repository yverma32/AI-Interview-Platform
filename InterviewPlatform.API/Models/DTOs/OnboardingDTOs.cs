using System.ComponentModel.DataAnnotations;

namespace InterviewPlatform.API.Models.DTOs;

public class AssessmentQuestion
{
    public int Id { get; set; }
    public string Question { get; set; } = string.Empty;
    public List<string> Options { get; set; } = new();
    public string Topic { get; set; } = string.Empty;
}

/// <summary>Server-side persisted alongside the question set so we can score without trusting the client.</summary>
public class AssessmentQuestionWithAnswer : AssessmentQuestion
{
    public int CorrectIndex { get; set; }
}

public class AssessmentSetResponse
{
    public string AssessmentId { get; set; } = string.Empty;
    public List<AssessmentQuestion> Questions { get; set; } = new();
}

public class AssessmentAnswer
{
    public int QuestionId { get; set; }
    public int SelectedIndex { get; set; }
}

public class SubmitAssessmentRequest
{
    [Required]
    public string AssessmentId { get; set; } = string.Empty;
    [Required, MinLength(1)]
    public List<AssessmentAnswer> Answers { get; set; } = new();
}

public class AssessmentResult
{
    public int Score { get; set; }
    public int Total { get; set; }
    /// <summary>beginner | intermediate | advanced</summary>
    public string SkillLevel { get; set; } = string.Empty;
    /// <summary>service | startup | faang</summary>
    public string RecommendedCompanyTrack { get; set; } = string.Empty;
    public List<string> StrongTopics { get; set; } = new();
    public List<string> WeakTopics { get; set; } = new();
}

public class CompanyTrackDto
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string[] Examples { get; set; } = Array.Empty<string>();
    public string DSADifficulty { get; set; } = string.Empty;
    public string[] FocusAreas { get; set; } = Array.Empty<string>();
    public int QuestionCount { get; set; }
}
