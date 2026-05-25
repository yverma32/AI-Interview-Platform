namespace InterviewPlatform.API.Models;

/// <summary>
/// In-memory definition of a credit pack. Not persisted as a DB entity — the catalog lives in
/// <see cref="Data.CreditPacks"/>. Treated as a value object passed around inside the API.
/// </summary>
public class CreditPack
{
    public string Id { get; set; } = string.Empty;       // starter | basic | premium | pro
    public string Name { get; set; } = string.Empty;
    public int PriceInPaise { get; set; }
    public int BasicCredits { get; set; }
    public int PremiumCredits { get; set; }
    public string Description { get; set; } = string.Empty;
}
