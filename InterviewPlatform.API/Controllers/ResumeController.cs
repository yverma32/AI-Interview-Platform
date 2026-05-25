using System.Security.Claims;
using InterviewPlatform.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/resume")]
[Authorize]
public class ResumeController : ControllerBase
{
    private readonly IResumeService _service;

    public ResumeController(IResumeService service) => _service = service;

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException());

    /// <summary>Upload a PDF or DOCX resume. The file is extracted, parsed via GPT, and stored.</summary>
    [HttpPost("upload")]
    [EnableRateLimiting("api")]
    [RequestSizeLimit(6 * 1024 * 1024)] // 6 MB hard cap above our 5 MB business limit
    public async Task<IActionResult> Upload(IFormFile file)
    {
        try
        {
            var result = await _service.UploadAsync(GetUserId(), file);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    /// <summary>Get the user's most recently uploaded resume (parsed + snippet).</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var result = await _service.GetLatestAsync(GetUserId());
        return result is null
            ? NotFound(new { success = false, message = "No resume uploaded yet." })
            : Ok(result);
    }
}
