using System.ComponentModel.DataAnnotations;

namespace InterviewPlatform.API.Models.DTOs;

public class RegisterRequest
{
    [Required(ErrorMessage = "Full name is required.")]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be between 2 and 100 characters.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
    [StringLength(256, ErrorMessage = "Email must not exceed 256 characters.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 100 characters.")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{8,}$",
        ErrorMessage = "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.")]
    public string Password { get; set; } = string.Empty;

    public string? ExperienceLevel { get; set; }
    public string? PreferredTechnologies { get; set; }
}

public class LoginRequest
{
    [Required(ErrorMessage = "Email is required.")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required.")]
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Auth response sent in the body. Tokens are set as HttpOnly cookies instead.
/// </summary>
public class AuthResponse
{
    public bool Success { get; set; }
    public UserProfile? User { get; set; }
    public string? Message { get; set; }
}

public class UserProfile
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string? ExperienceLevel { get; set; }
    public string? PreferredTechnologies { get; set; }
    public int BasicCredits { get; set; }
    public int PremiumCredits { get; set; }
}
