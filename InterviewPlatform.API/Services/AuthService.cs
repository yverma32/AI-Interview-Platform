using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthService> _logger;

    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public AuthService(AppDbContext db, IConfiguration config, ILogger<AuthService> logger)
    {
        _db = db;
        _config = config;
        _logger = logger;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var emailNormalized = request.Email.Trim().ToLower();

        if (await _db.Users.AnyAsync(u => u.Email == emailNormalized))
        {
            return new AuthResponse { Success = false, Message = "An account with this email already exists." };
        }

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = emailNormalized,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 12),
            ExperienceLevel = request.ExperienceLevel,
            PreferredTechnologies = request.PreferredTechnologies,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        _logger.LogInformation("New user registered: {Email}", emailNormalized);

        return new AuthResponse
        {
            Success = true,
            User = MapToProfile(user)
        };
    }

    public async Task<(AuthResponse Response, string? AccessToken, string? RefreshToken)> LoginAsync(LoginRequest request)
    {
        var emailNormalized = request.Email.Trim().ToLower();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == emailNormalized);

        // Constant-time-ish response: don't reveal whether email exists
        if (user == null)
        {
            // Hash a dummy password to prevent timing attacks
            BCrypt.Net.BCrypt.HashPassword("dummy_password_to_prevent_timing_attack");
            return (new AuthResponse { Success = false, Message = "Invalid email or password." }, null, null);
        }

        // Check lockout
        if (user.IsLocked)
        {
            var remaining = (user.LockoutEnd!.Value - DateTime.UtcNow).Minutes + 1;
            _logger.LogWarning("Locked account login attempt: {Email}", emailNormalized);
            return (new AuthResponse
            {
                Success = false,
                Message = $"Account is temporarily locked. Please try again in {remaining} minute(s)."
            }, null, null);
        }

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            user.FailedLoginAttempts++;

            if (user.FailedLoginAttempts >= MaxFailedAttempts)
            {
                user.LockoutEnd = DateTime.UtcNow.Add(LockoutDuration);
                _logger.LogWarning("Account locked after {Attempts} failed attempts: {Email}", user.FailedLoginAttempts, emailNormalized);
            }

            await _db.SaveChangesAsync();
            var attemptsLeft = MaxFailedAttempts - user.FailedLoginAttempts;
            var msg = attemptsLeft > 0
                ? $"Invalid email or password. {attemptsLeft} attempt(s) remaining before account lock."
                : "Account has been temporarily locked due to too many failed attempts.";
            return (new AuthResponse { Success = false, Message = msg }, null, null);
        }

        // Successful login — reset lockout
        user.FailedLoginAttempts = 0;
        user.LockoutEnd = null;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var accessToken = GenerateJwtToken(user);
        var refreshToken = await GenerateRefreshToken(user.Id);

        _logger.LogInformation("User logged in: {Email}", emailNormalized);

        return (new AuthResponse { Success = true, User = MapToProfile(user) }, accessToken, refreshToken);
    }

    public async Task<(AuthResponse Response, string? AccessToken, string? NewRefreshToken)> RefreshTokenAsync(string refreshToken)
    {
        var storedToken = await _db.RefreshTokens
            .Include(rt => rt.User)
            .FirstOrDefaultAsync(rt => rt.Token == refreshToken && !rt.IsRevoked);

        if (storedToken == null || storedToken.ExpiresAt < DateTime.UtcNow)
        {
            // If token was already used (revoked), it may be a token replay attack — revoke all user tokens
            var usedToken = await _db.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == refreshToken && rt.IsRevoked);

            if (usedToken != null)
            {
                _logger.LogWarning("Potential token replay attack detected for user {UserId}", usedToken.UserId);
                await RevokeAllUserTokensAsync(usedToken.UserId);
            }

            return (new AuthResponse { Success = false, Message = "Invalid or expired session. Please sign in again." }, null, null);
        }

        // Rotate: revoke old, issue new
        storedToken.IsRevoked = true;
        await _db.SaveChangesAsync();

        var accessToken = GenerateJwtToken(storedToken.User);
        var newRefreshToken = await GenerateRefreshToken(storedToken.User.Id);

        return (new AuthResponse { Success = true, User = MapToProfile(storedToken.User) }, accessToken, newRefreshToken);
    }

    public async Task<bool> RevokeAllUserTokensAsync(int userId)
    {
        var tokens = await _db.RefreshTokens
            .Where(rt => rt.UserId == userId && !rt.IsRevoked)
            .ToListAsync();

        foreach (var token in tokens)
            token.IsRevoked = true;

        await _db.SaveChangesAsync();
        _logger.LogInformation("Revoked all refresh tokens for user {UserId}", userId);
        return tokens.Count > 0;
    }

    public async Task<UserProfile?> GetProfileAsync(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        return user == null ? null : MapToProfile(user);
    }

    // ---------- Private helpers ----------

    private static UserProfile MapToProfile(User user) => new()
    {
        Id = user.Id,
        FullName = user.FullName,
        Email = user.Email,
        Role = user.Role,
        ExperienceLevel = user.ExperienceLevel,
        PreferredTechnologies = user.PreferredTechnologies
    };

    private string GenerateJwtToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured")));

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("experience_level", user.ExperienceLevel ?? ""),
        };

        var expirationMinutes = double.Parse(_config["Jwt:ExpirationInMinutes"] ?? "15");

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            audience: _config["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private async Task<string> GenerateRefreshToken(int userId)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

        var refreshToken = new RefreshToken
        {
            Token = token,
            UserId = userId,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow
        };

        _db.RefreshTokens.Add(refreshToken);
        await _db.SaveChangesAsync();

        return token;
    }
}
