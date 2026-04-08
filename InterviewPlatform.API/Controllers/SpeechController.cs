using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SpeechController : ControllerBase
{
    private readonly string _deepgramKey;

    public SpeechController(IConfiguration config)
    {
        _deepgramKey = config["Deepgram:ApiKey"]
            ?? Environment.GetEnvironmentVariable("DEEPGRAM_API_KEY")
            ?? string.Empty;
    }

    /// <summary>
    /// Returns Deepgram API key for authenticated users to use for real-time STT.
    /// In production, use Deepgram's temporary key API for scoped, short-lived keys.
    /// </summary>
    [HttpGet("token")]
    [EnableRateLimiting("api")]
    public IActionResult GetSpeechToken()
    {
        if (string.IsNullOrWhiteSpace(_deepgramKey))
        {
            return Ok(new { available = false });
        }

        return Ok(new { available = true, key = _deepgramKey });
    }
}
