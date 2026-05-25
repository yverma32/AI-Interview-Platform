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
    private readonly IConfiguration _config;
    private readonly IHostEnvironment _env;

    public CsrfController(IConfiguration config, IHostEnvironment env)
    {
        _config = config;
        _env = env;
    }

    [HttpGet("token")]
    public IActionResult GetToken()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        // Mirror AuthController's cookie policy so CSRF + auth cookies behave consistently
        // across same-site (Strict) and cross-site (Vercel ⇄ Railway: None+Secure) deployments.
        var crossSite = _config.GetValue<bool>("Cookies:CrossSite");
        var isDev = _env.IsDevelopment();
        var secure = !isDev;
        var sameSite = isDev
            ? SameSiteMode.Lax
            : crossSite ? SameSiteMode.None : SameSiteMode.Strict;

        Response.Cookies.Append("XSRF-TOKEN", token, new CookieOptions
        {
            HttpOnly = false, // Must be readable by JS to copy into the X-XSRF-TOKEN header
            Secure = secure,
            SameSite = sameSite,
            Path = "/",
            MaxAge = TimeSpan.FromHours(2)
        });

        return Ok(new { success = true });
    }
}
