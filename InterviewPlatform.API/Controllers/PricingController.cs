using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
// Public endpoints — apply the "api" rate-limit (60/min/IP) so an attacker can't hammer
// the founding-status counter or the pack catalog to drive up Postgres connection pressure.
[EnableRateLimiting("api")]
public class PricingController : ControllerBase
{
    private readonly AppDbContext _db;

    public PricingController(AppDbContext db) => _db = db;

    /// <summary>
    /// Public list of credit packs. Returns per-pack pricing plus a per-credit breakdown so the
    /// pricing page can render "₹X per interview" without doing the math itself.
    /// </summary>
    [HttpGet("packs")]
    public IActionResult GetPacks()
    {
        var packs = CreditPacks.All.Select(p =>
        {
            var priceINR = p.PriceInPaise / 100m;
            var priceUSD = p.PriceInCents / 100m;
            return new
            {
                p.Id,
                p.Name,
                PriceINR = priceINR,
                PriceUSD = priceUSD,
                p.BasicCredits,
                p.PremiumCredits,
                p.Description,
                PerBasicCreditINR = p.BasicCredits > 0 ? Math.Round(priceINR / p.BasicCredits, 2) : (decimal?)null,
                PerBasicCreditUSD = p.BasicCredits > 0 ? Math.Round(priceUSD / p.BasicCredits, 2) : (decimal?)null,
                PerPremiumCreditINR = p.PremiumCredits > 0 ? Math.Round(priceINR / p.PremiumCredits, 2) : (decimal?)null,
                PerPremiumCreditUSD = p.PremiumCredits > 0 ? Math.Round(priceUSD / p.PremiumCredits, 2) : (decimal?)null,
                Highlight = p.Id == "premium"
            };
        });
        return Ok(new { packs });
    }

    /// <summary>
    /// Public status of the launch "first 50 buyers get double credits" promo. Drives the
    /// urgency banner on the pricing page. Updates live as users redeem.
    /// </summary>
    [HttpGet("founding-status")]
    public async Task<ActionResult<FoundingStatusDto>> GetFoundingStatus()
    {
        var taken = await _db.Users.CountAsync(u => u.IsFoundingMember);
        var total = PaymentService.FoundingMemberCap;
        return Ok(new FoundingStatusDto
        {
            TotalSpots = total,
            SpotsRemaining = Math.Max(0, total - taken)
        });
    }
}
