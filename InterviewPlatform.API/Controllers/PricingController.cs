using InterviewPlatform.API.Data;
using Microsoft.AspNetCore.Mvc;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PricingController : ControllerBase
{
    /// <summary>
    /// Public list of credit packs. Returns per-pack pricing plus a per-credit breakdown so the
    /// pricing page can render "₹X per interview" without doing the math itself.
    /// </summary>
    [HttpGet("packs")]
    public IActionResult GetPacks()
    {
        var packs = CreditPacks.All.Select(p =>
        {
            var priceRupees = p.PriceInPaise / 100m;
            return new
            {
                p.Id,
                p.Name,
                Price = priceRupees,
                Currency = "INR",
                p.BasicCredits,
                p.PremiumCredits,
                p.Description,
                PerBasicCredit = p.BasicCredits > 0 ? Math.Round(priceRupees / p.BasicCredits, 2) : (decimal?)null,
                PerPremiumCredit = p.PremiumCredits > 0 ? Math.Round(priceRupees / p.PremiumCredits, 2) : (decimal?)null,
                Highlight = p.Id == "premium"
            };
        });
        return Ok(new { packs });
    }
}
