using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IInterviewService
{
    Task<InterviewStartResponse> StartInterviewAsync(int userId, StartInterviewRequest request);
    Task<AnswerResponse> SubmitAnswerAsync(int userId, int sessionId, SubmitAnswerRequest request);
    Task<List<InterviewHistoryItem>> GetHistoryAsync(int userId);
    Task<InterviewDetailResponse?> GetInterviewDetailAsync(int userId, int sessionId);
}
