namespace InterviewPlatform.API.Models;

/// <summary>
/// In-memory definition of a credit pack. Not persisted as a DB entity — the catalog lives in
/// <see cref="Data.CreditPacks"/>. Treated as a value object passed around inside the API.
/// </summary>
public class CreditPack
{
    public string Id { get; set; } = string.Empty;       // starter | basic | premium | pro
    public string Name { get; set; } = string.Empty;
    public int PriceInPaise { get; set; }                // INR price in paise (e.g., 19900 = ₹199)
    public int PriceInCents { get; set; }                // USD price in cents (e.g., 299 = $2.99)
    public int BasicCredits { get; set; }
    public int PremiumCredits { get; set; }
    public string Description { get; set; } = string.Empty;
}
