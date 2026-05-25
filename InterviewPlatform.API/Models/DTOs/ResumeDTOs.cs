namespace InterviewPlatform.API.Models.DTOs;

public class ResumeResponse
{
    public int Id { get; set; }
    public string FileName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public ParsedResume? Parsed { get; set; }
    /// <summary>Truncated raw text for preview; full text lives server-side.</summary>
    public string? Snippet { get; set; }
}

public class ParsedResume
{
    public string? Name { get; set; }
    public string? CurrentRole { get; set; }
    public string? TotalExperience { get; set; }
    public List<string> Skills { get; set; } = new();
    public List<ResumeProject> Projects { get; set; } = new();
    public List<ResumeCompany> Companies { get; set; } = new();
    public List<ResumeEducation> Education { get; set; } = new();
}

public class ResumeProject
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Technologies { get; set; } = new();
    public string? Impact { get; set; }
}

public class ResumeCompany
{
    public string Name { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? Duration { get; set; }
    public List<string> Highlights { get; set; } = new();
}

public class ResumeEducation
{
    public string Degree { get; set; } = string.Empty;
    public string? Institution { get; set; }
    public string? Year { get; set; }
}
