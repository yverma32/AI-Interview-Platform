using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Mvc;
using InterviewPlatform.API.Middleware;

namespace InterviewPlatform.API.Controllers;

/// <summary>
/// Issues a CSRF token for the current user. The frontend caches the token in JS memory and
/// replays it as the X-XSRF-TOKEN header on every state-changing request.
///
/// Token shape depends on auth state:
///   - Authenticated: HMAC-signed "<userId>|<expiry>|<nonce>" so the middleware can validate
///     without reading any cookie. This is the path that fixes mobile-Safari/cross-site setups
///     where third-party cookies get dropped.
///   - Anonymous: a random opaque blob also written to the XSRF-TOKEN cookie (legacy double-
///     submit). Anonymous state-changing endpoints (login, register, refresh) are CSRF-exempt
///     anyway, but we still issue this so the existing fetchCsrfTokenInternal() call returns
///     something usable for users who haven't logged in yet.
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
        var userId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var jwtSecret = _config["Jwt:Secret"];

        string token;
        if (!string.IsNullOrEmpty(userId) && !string.IsNullOrWhiteSpace(jwtSecret))
        {
            // Authenticated user: issue a signed token bound to their userId. Validated
            // statelessly by CsrfMiddleware — no cookie needed.
            token = CsrfMiddleware.IssueSignedToken(userId, jwtSecret, TimeSpan.FromHours(2));
        }
        else
        {
            // Anonymous: random opaque token. Set as cookie for legacy double-submit fallback;
            // CSRF-exempt endpoints (login/register/refresh) don't validate it anyway.
            token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        }

        // Mirror AuthController's cookie policy so CSRF + auth cookies behave consistently.
        // The cookie is now optional (the signed token doesn't need it) but we keep writing it
        // so old clients still working on the double-submit path don't break.
        var crossSite = _config.GetValue<bool>("Cookies:CrossSite");
        var isDev = _env.IsDevelopment();
        var secure = !isDev;
        var sameSite = isDev
            ? SameSiteMode.Lax
            : crossSite ? SameSiteMode.None : SameSiteMode.Strict;

        Response.Cookies.Append("XSRF-TOKEN", token, new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = sameSite,
            Path = "/",
            MaxAge = TimeSpan.FromHours(2)
        });

        return Ok(new { success = true, token });
    }
}
