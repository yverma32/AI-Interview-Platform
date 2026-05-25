using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IInterviewService
{
    Task<InterviewStartResponse> StartInterviewAsync(int userId, StartInterviewRequest request);
    Task<AnswerResponse> SubmitAnswerAsync(int userId, int sessionId, SubmitAnswerRequest request);
    Task<List<InterviewHistoryItem>> GetHistoryAsync(int userId);
    Task<InterviewDetailResponse?> GetInterviewDetailAsync(int userId, int sessionId);
    Task<List<WeakTopicItem>> GetWeakTopicsAsync(int userId, string? technology = null);
    Task AbandonInterviewAsync(int userId, int sessionId);

    /// <summary>Check whether the user has at least one credit of the kind required for the chosen mode.</summary>
    Task<CreditCheckResult> CheckCreditsAsync(int userId, string interviewMode);

    /// <summary>Atomically decrement the credit balance for the given mode. Returns false if balance was insufficient.</summary>
    Task<bool> DeductCreditAsync(int userId, string interviewMode);

    Task<CreditBalanceDto> GetCreditBalanceAsync(int userId);
}
