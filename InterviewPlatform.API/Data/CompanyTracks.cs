namespace InterviewPlatform.API.Data;

public record CompanyTrack(
    string Id,
    string Name,
    string[] Examples,
    string DSADifficulty,
    string[] FocusAreas,
    int QuestionCount);

public static class CompanyTracks
{
    public static readonly CompanyTrack Service = new(
        Id: "service",
        Name: "Service Companies",
        Examples: new[] { "TCS", "Infosys", "Wipro", "Capgemini", "Accenture" },
        DSADifficulty: "easy-medium",
        FocusAreas: new[] { "Basic DSA", "OOPs", "SQL", "HR", "Aptitude" },
        QuestionCount: 5);

    public static readonly CompanyTrack Startup = new(
        Id: "startup",
        Name: "Indian Product Startups",
        Examples: new[] { "Razorpay", "Zepto", "Swiggy", "CRED", "Meesho" },
        DSADifficulty: "medium",
        FocusAreas: new[] { "DSA Medium", "System Design Basic", "Frontend Depth", "Product Thinking" },
        QuestionCount: 7);

    public static readonly CompanyTrack FAANG = new(
        Id: "faang",
        Name: "FAANG India",
        Examples: new[] { "Google", "Microsoft", "Amazon", "Meta", "Adobe" },
        DSADifficulty: "medium-hard",
        FocusAreas: new[] { "DSA Hard", "System Design", "Behavioural (LP)", "Domain Depth" },
        QuestionCount: 10);

    public static readonly IReadOnlyList<CompanyTrack> All = new[] { Service, Startup, FAANG };

    public static CompanyTrack? Get(string? id) =>
        id is null ? null : All.FirstOrDefault(t => t.Id == id);
}
