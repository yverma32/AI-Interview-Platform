using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IRealtimeSessionService
{
    /// <summary>Returns true if the user has interview quota remaining this month.</summary>
    Task<bool> CanUserStartInterviewAsync(int userId);

    /// <summary>
    /// Creates a DB-backed InterviewSession, mints an ephemeral OpenAI Realtime key, and returns both
    /// to the client so it can connect directly to the Realtime WebSocket/WebRTC endpoint.
    /// </summary>
    Task<CreateRealtimeSessionResponse> CreateSessionAsync(int userId, CreateRealtimeSessionRequest request);

    /// <summary>
    /// Persists a single question + score from a score_answer function call. Writes both the
    /// interviewer-question and candidate-answer messages so existing history/results pages can render.
    /// </summary>
    Task SaveQuestionScoreAsync(int userId, int sessionId, ScoreAnswerRequest request);

    /// <summary>
    /// Finalizes a session: writes overall score/feedback/hiring recommendation, computes duration,
    /// stores any transcript entries the client batched up that weren't already saved.
    /// </summary>
    Task CompleteSessionAsync(int userId, int sessionId, CompleteSessionRequest request);
}
