namespace InterviewPlatform.API.Models;

public class UserResume
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>Full extracted plain text from the uploaded file.</summary>
    public string RawText { get; set; } = string.Empty;
    /// <summary>GPT-structured JSON: { name, currentRole, skills[], projects[], companies[], education[] }</summary>
    public string ParsedJson { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}
