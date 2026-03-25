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
    /// </summary>
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var (response, accessToken, refreshToken) = await _authService.LoginAsync(request);

        if (!response.Success)
            return Unauthorized(response);

        SetAuthCookies(accessToken!, refreshToken!);
        return Ok(response);
    }

    /// <summary>
    /// Refresh — reads refresh token from cookie, rotates both tokens.
    /// </summary>
    [HttpPost("refresh")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<AuthResponse>> Refresh()
    {
        var refreshToken = Request.Cookies["refresh_token"];

        if (string.IsNullOrEmpty(refreshToken))
            return Unauthorized(new AuthResponse { Success = false, Message = "No session found. Please sign in." });

        var (response, newAccessToken, newRefreshToken) = await _authService.RefreshTokenAsync(refreshToken);

        if (!response.Success)
        {
            ClearAuthCookies();
            return Unauthorized(response);
        }

        SetAuthCookies(newAccessToken!, newRefreshToken!);
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
        var isProduction = !HttpContext.RequestServices.GetRequiredService<IHostEnvironment>().IsDevelopment();
        var expirationMinutes = double.Parse(_config["Jwt:ExpirationInMinutes"] ?? "15");

        Response.Cookies.Append("access_token", accessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            MaxAge = TimeSpan.FromMinutes(expirationMinutes)
        });

        Response.Cookies.Append("refresh_token", refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = isProduction,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth", // Only sent to auth endpoints
            MaxAge = TimeSpan.FromDays(7)
        });
    }

    private void ClearAuthCookies()
    {
        Response.Cookies.Delete("access_token", new CookieOptions { Path = "/" });
        Response.Cookies.Delete("refresh_token", new CookieOptions { Path = "/api/auth" });
    }
}
