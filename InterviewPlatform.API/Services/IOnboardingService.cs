using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IOnboardingService
{
    Task<AssessmentSetResponse> GenerateAssessmentAsync(int userId);
    Task<AssessmentResult> SubmitAssessmentAsync(int userId, SubmitAssessmentRequest request);
    Task<AssessmentResult?> GetCurrentProfileAsync(int userId);
}
