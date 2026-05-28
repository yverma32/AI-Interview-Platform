using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IConfiguration _config;

    public AuthController(IAuthService authService, IConfiguration config)
    {
        _authService = authService;
        _config = config;
    }

    /// <summary>
    /// Register a new user. Does NOT auto-login (no cookies set).
    /// </summary>
    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);

        if (!result.Success)
            return BadRequest(result);

        return Ok(result);
    }

    /// <summary>
    /// Login — sets HttpOnly cookies for access + refresh tokens.
    /// Also includes refresh token in response body for mobile clients.
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var (response, accessToken, refreshToken) = await _authService.LoginAsync(request);

        if (!response.Success)
            return Unauthorized(response);

        SetAuthCookies(accessToken!, refreshToken!);

        // Include both tokens in the response body so mobile clients (iOS Safari / Chrome iOS)
        // can store them and use Authorization: Bearer + X-Refresh-Token header fallbacks when
        // ITP blocks the cross-site cookies on subsequent requests.
        response.AccessToken = accessToken;
        response.RefreshToken = refreshToken;

        return Ok(response);
    }

    /// <summary>
    /// Refresh — reads refresh token from cookie (primary) or X-Refresh-Token header (fallback).
    /// The header fallback is needed for mobile browsers with strict third-party cookie policies.
    /// </summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        // Try cookie first (works on desktop)
        var refreshToken = Request.Cookies["refresh_token"];

        // Fallback to header for mobile browsers where cookies might be blocked
        if (string.IsNullOrEmpty(refreshToken))
        {
            refreshToken = Request.Headers["X-Refresh-Token"].FirstOrDefault();
        }

        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new AuthResponse { Success = false, Message = "No session found. Please sign in." });

        var (response, newAccessToken, newRefreshToken) = await _authService.RefreshTokenAsync(refreshToken);

        if (!response.Success)
        {
            ClearAuthCookies();
            return Unauthorized(response);
        }

        SetAuthCookies(newAccessToken!, newRefreshToken!);

        // Return both tokens in body for mobile ITP fallback (same as login endpoint).
        response.AccessToken = newAccessToken;
        response.RefreshToken = newRefreshToken;

        return Ok(response);
    }

    /// <summary>
    /// Logout — revokes all user tokens and clears cookies.
    /// </summary>
    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && int.TryParse(userIdClaim, out var userId))
        {
            await _authService.RevokeAllUserTokensAsync(userId);
        }

        ClearAuthCookies();
        return Ok(new { success = true, message = "Logged out successfully." });
    }

    /// <summary>
    /// Get current user profile (requires valid access token cookie).
    /// </summary>
    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<UserProfile>> GetProfile()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !int.TryParse(userIdClaim, out var userId))
            return Unauthorized();

        var profile = await _authService.GetProfileAsync(userId);
        return profile == null ? NotFound() : Ok(profile);
    }

    // ---------- Cookie helpers ----------

    private void SetAuthCookies(string accessToken, string refreshToken)
    {
        var (secure, sameSite) = ResolveCookiePolicy(HttpContext, _config);
        var expirationMinutes = double.Parse(_config["Jwt:ExpirationInMinutes"] ?? "15");

        Response.Cookies.Append("access_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            Path = "/",
            MaxAge = TimeSpan.FromMinutes(expirationMinutes)
        });

        Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            // Path = "/" (not "/api/auth") because some mobile browsers — particularly Safari iOS
            // and Chrome Android in private mode — handle path-scoped cross-site cookies
            // inconsistently, leading to 401s on mobile while desktop works fine. The cookie is
            // still HttpOnly so JS can't read it; only refresh code reads it server-side.
            Path = "/",
            MaxAge = TimeSpan.FromDays(7)
        });
    }

    private void ClearAuthCookies()
    {
        var (secure, sameSite) = ResolveCookiePolicy(HttpContext, _config);
        Response.Cookies.Delete("access_token", new CookieOptions { Path = "/", Secure = secure, SameSite = sameSite });
        Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/", Secure = secure, SameSite = sameSite });
        // Also clear the legacy /api/auth-scoped cookie for users who logged in before this change,
        // otherwise their old cookie lingers and could conflict with the new one.
        Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/api/auth", Secure = secure, SameSite = sameSite });
    }

    /// <summary>
    /// Picks cookie attributes based on environment + deployment topology.
    /// - Local dev (HTTP): Secure=false, SameSite=Lax so cookies work without TLS.
    /// - Same-site prod: Secure=true, SameSite=Strict (the strictest viable default).
    /// - Cross-site prod (frontend on different domain than API, e.g. Vercel ⇄ Railway): Secure=true, SameSite=None.
    ///   Triggered by setting Cookies:CrossSite=true in config / env (COOKIES__CROSSSITE=true).
    /// </summary>
    internal static (bool secure, SameSiteMode sameSite) ResolveCookiePolicy(HttpContext ctx, IConfiguration config)
    {
        var isDev = ctx.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment();
        var crossSite = config.GetValue<bool>("Cookies:CrossSite");

        if (isDev) return (false, SameSiteMode.Lax);
        if (crossSite) return (true, SameSiteMode.None);
        return (true, SameSiteMode.Strict);
    }
}
