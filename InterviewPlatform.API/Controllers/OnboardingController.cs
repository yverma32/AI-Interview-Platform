using System.Security.Claims;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/onboarding")]
[Authorize]
[EnableRateLimiting("api")]
public class OnboardingController : ControllerBase
{
    private readonly IOnboardingService _service;

    public OnboardingController(IOnboardingService service) => _service = service;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>Generate a 10-question MCQ assessment for the current user.</summary>
    [HttpPost("assessment")]
    public async Task<IActionResult> CreateAssessment()
    {
        try
        {
            var result = await _service.GenerateAssessmentAsync(GetUserId());
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>Submit answers, get classification + recommended company track.</summary>
    [HttpPost("assessment/submit")]
    public async Task<IActionResult> SubmitAssessment([FromBody] SubmitAssessmentRequest request)
    {
        try
        {
            var result = await _service.SubmitAssessmentAsync(GetUserId(), request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>Get the user's current onboarding profile (null if they haven't completed it).</summary>
    [HttpGet("profile")]
    [AllowAnonymous] // Reachable when logged out so the redirect logic can check
    public async Task<IActionResult> GetProfile()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (claim is null || !int.TryParse(claim, out var userId)) return Ok((object?)null);
        var result = await _service.GetCurrentProfileAsync(userId);
        return Ok(result);
    }

    /// <summary>Returns the static list of company tracks for the setup page.</summary>
    [HttpGet("tracks")]
    [AllowAnonymous]
    public IActionResult GetTracks() =>
        Ok(CompanyTracks.All.Select(t => new CompanyTrackDto
        {
            Id = t.Id,
            Name = t.Name,
            Examples = t.Examples,
            DSADifficulty = t.DSADifficulty,
            FocusAreas = t.FocusAreas,
            QuestionCount = t.QuestionCount
        }));
}
