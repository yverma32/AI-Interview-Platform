using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class InterviewController : ControllerBase
{
    private readonly IInterviewService _interviewService;

    public InterviewController(IInterviewService interviewService)
    {
        _interviewService = interviewService;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token."));

    /// <summary>Start a new interview session. Returns the first AI question.</summary>
    [HttpPost("start")]
    [EnableRateLimiting("api")]
    public async Task<IActionResult> StartInterview([FromBody] StartInterviewRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem();

        try
        {
            var result = await _interviewService.StartInterviewAsync(GetUserId(), request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            // E.g., OpenAI key not configured
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>Submit an answer and get the AI's evaluation + next question.</summary>
    [HttpPost("{sessionId}/answer")]
    [EnableRateLimiting("api")]
    public async Task<IActionResult> SubmitAnswer(int sessionId, [FromBody] SubmitAnswerRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem();

        try
        {
            var result = await _interviewService.SubmitAnswerAsync(GetUserId(), sessionId, request);
            return Ok(result);
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = "Interview session not found." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>Get the current user's interview history.</summary>
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory()
    {
        var history = await _interviewService.GetHistoryAsync(GetUserId());
        return Ok(history);
    }

    /// <summary>Get full details of a specific interview session including all messages.</summary>
    [HttpGet("{sessionId}")]
    public async Task<IActionResult> GetInterviewDetail(int sessionId)
    {
        var detail = await _interviewService.GetInterviewDetailAsync(GetUserId(), sessionId);
        if (detail == null) return NotFound(new { success = false, message = "Interview not found." });
        return Ok(detail);
    }
}
