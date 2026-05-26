using InterviewPlatform.API.Models;

namespace InterviewPlatform.API.Data;

/// <summary>
/// Static catalog of credit packs sold through Razorpay. Edit here to change prices/credit counts —
/// no DB migration needed. The catalog is referenced by PaymentService (order creation) and
/// PricingController (public listing).
/// </summary>
public static class CreditPacks
{
    public static readonly IReadOnlyList<CreditPack> All = new List<CreditPack>
    {
        new()
        {
            Id = "starter",
            Name = "Starter Pack",
            PriceInPaise = 19900,
            PriceInCents = 299,
            BasicCredits = 5,
            PremiumCredits = 0,
            Description = "5 text interviews — perfect to get started"
        },
        new()
        {
            Id = "basic",
            Name = "Basic Pack",
            PriceInPaise = 49900,
            PriceInCents = 599,
            BasicCredits = 15,
            PremiumCredits = 0,
            Description = "15 text interviews — best for regular practice"
        },
        new()
        {
            Id = "premium",
            Name = "Premium Pack",
            PriceInPaise = 149900,
            PriceInCents = 1799,
            BasicCredits = 10,
            PremiumCredits = 5,
            Description = "10 text + 5 voice interviews — serious prep"
        },
        new()
        {
            Id = "pro",
            Name = "Pro Pack",
            PriceInPaise = 299900,
            PriceInCents = 3499,
            BasicCredits = 20,
            PremiumCredits = 10,
            Description = "20 text + 10 voice interviews — active job seekers"
        },
    };

    public static CreditPack? GetById(string id) =>
        All.FirstOrDefault(p => p.Id == id);
}
