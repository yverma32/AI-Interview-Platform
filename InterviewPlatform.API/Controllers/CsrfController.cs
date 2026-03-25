using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;

namespace InterviewPlatform.API.Controllers;

/// <summary>
/// Issues a CSRF token cookie. The frontend reads this cookie and sends it
/// back in the X-XSRF-TOKEN header on state-changing requests.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class CsrfController : ControllerBase
{
    [HttpGet("token")]
    public IActionResult GetToken()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        Response.Cookies.Append("XSRF-TOKEN", token, new CookieOptions
        {
            HttpOnly = false, // Must be readable by JS
            Secure = false,   // Set to true in production with HTTPS
            SameSite = SameSiteMode.Strict,
            Path = "/",
            MaxAge = TimeSpan.FromHours(2)
        });

        return Ok(new { success = true });
    }
}
