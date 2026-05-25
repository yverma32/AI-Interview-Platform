using System.Security.Claims;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/realtime")]
[Authorize]
public class RealtimeController : ControllerBase
{
    private readonly IRealtimeSessionService _service;

    public RealtimeController(IRealtimeSessionService service) => _service = service;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token."));

    /// <summary>
    /// Mint an ephemeral OpenAI Realtime session token. The token is valid for ~60s — the client
    /// must immediately use it to establish a WebRTC connection straight to OpenAI.
    /// Tight rate limit ("realtime" policy: 5/hr/IP) to prevent ephemeral-key farming.
    /// </summary>
    [HttpPost("session")]
    [EnableRateLimiting("realtime")]
    public async Task<IActionResult> CreateSession([FromBody] CreateRealtimeSessionRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem();

        try
        {
            var result = await _service.CreateSessionAsync(GetUserId(), request);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            // Credit shortfall or config error — return a clean 4xx without leaking internals.
            var isCreditShortfall = ex.Message.Contains("credits remaining", StringComparison.OrdinalIgnoreCase);
            return StatusCode(
                isCreditShortfall ? StatusCodes.Status402PaymentRequired : StatusCodes.Status400BadRequest,
                new { success = false, message = ex.Message });
        }
    }

    /// <summary>
    /// Persist a single question + score from a score_answer function call. The client forwards
    /// these mid-session so per-question scores are durable even if the connection drops.
    /// </summary>
    [HttpPost("session/{sessionId:int}/score")]
    [EnableRateLimiting("api")]
    public async Task<IActionResult> ScoreAnswer(int sessionId, [FromBody] ScoreAnswerRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem();

        try
        {
            await _service.SaveQuestionScoreAsync(GetUserId(), sessionId, request);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = "Session not found." });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>
    /// Finalize the session: overall score, hiring recommendation, duration. Called once by the
    /// client when end_interview fires or when the user explicitly ends the session.
    /// </summary>
    [HttpPost("session/{sessionId:int}/complete")]
    [EnableRateLimiting("api")]
    public async Task<IActionResult> CompleteSession(int sessionId, [FromBody] CompleteSessionRequest request)
    {
        try
        {
            await _service.CompleteSessionAsync(GetUserId(), sessionId, request);
            return Ok(new { success = true });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { success = false, message = "Session not found." });
        }
    }
}
