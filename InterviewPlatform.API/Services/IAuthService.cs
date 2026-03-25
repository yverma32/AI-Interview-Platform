using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    /// <summary>
    /// Returns AuthResponse + generated JWT + refresh token string.
    /// The controller is responsible for setting cookies.
    /// </summary>
    Task<(AuthResponse Response, string? AccessToken, string? RefreshToken)> LoginAsync(LoginRequest request);

    /// <summary>
    /// Validates a refresh token and returns new tokens.
    /// </summary>
    Task<(AuthResponse Response, string? AccessToken, string? NewRefreshToken)> RefreshTokenAsync(string refreshToken);

    Task<bool> RevokeAllUserTokensAsync(int userId);

    Task<UserProfile?> GetProfileAsync(int userId);
}
