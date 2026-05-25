using System.Text.Json;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace InterviewPlatform.API.Services;

public class InterviewService : IInterviewService
{
    private readonly AppDbContext _db;
    private readonly IAIService _ai;
    private readonly ILogger<InterviewService> _logger;

    public InterviewService(AppDbContext db, IAIService ai, ILogger<InterviewService> logger)
    {
        _db = db;
        _ai = ai;
        _logger = logger;
    }

    public async Task<InterviewStartResponse> StartInterviewAsync(int userId, StartInterviewRequest request)
    {
        // Credit gate: verify and atomically deduct the right credit type for the chosen mode.
        var creditCheck = await CheckCreditsAsync(userId, request.InterviewMode);
        if (!creditCheck.HasCredits)
            throw new InvalidOperationException(creditCheck.Reason ?? "Insufficient credits.");

        var deducted = await DeductCreditAsync(userId, request.InterviewMode);
        if (!deducted)
            throw new InvalidOperationException("Failed to deduct credit. Please try again.");

        // Query past interview sessions for this user + technology to get previously asked first-question topics
        var previousTopics = await _db.InterviewMessages
            .Where(m => m.Session.UserId == userId
                     && m.Session.Technology == request.Technology
                     && m.Role == "interviewer"
                     && m.QuestionNumber == 1
                     && m.QuestionTopic != null)
            .OrderByDescending(m => m.CreatedAt)
            .Select(m => m.QuestionTopic!)
            .Take(20) // Keep last 20 to avoid prompt bloat
            .ToListAsync();

        var session = new InterviewSession
        {
            UserId = userId,
            Technology = request.Technology,
            ExperienceLevel = request.ExperienceLevel,
            TotalQuestions = request.TotalQuestions,
            CurrentQuestionNumber = 1,
            Status = "InProgress",
            InterviewMode = request.InterviewMode,
            CreditsConsumed = 1,
            FocusTopics = request.FocusTopics != null && request.FocusTopics.Count > 0
                ? JsonSerializer.Serialize(request.FocusTopics) : null,
            StartedAt = DateTime.UtcNow
        };

        _db.InterviewSessions.Add(session);
        await _db.SaveChangesAsync();

        // Ask AI for the first question (empty conversation history, with past topic history for variety)
        var aiResponse = await _ai.GetInterviewResponseAsync(
            session.Technology,
            session.ExperienceLevel,
            session.TotalQuestions,
            1,
            new List<ChatMessage>(),
            previousTopics.Count > 0 ? previousTopics : null,
            request.FocusTopics);

        // Store the interviewer's opening message
        var interviewerMessage = new InterviewMessage
        {
            SessionId = session.Id,
            Role = "interviewer",
            Content = aiResponse.Message,
            QuestionTopic = aiResponse.Topic,
            QuestionNumber = aiResponse.QuestionNumber ?? 1,
            CreatedAt = DateTime.UtcNow
        };

        _db.InterviewMessages.Add(interviewerMessage);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Interview {SessionId} started for user {UserId}: {Tech}/{Level}, {Total}Q",
            session.Id, userId, session.Technology, session.ExperienceLevel, session.TotalQuestions);

        return new InterviewStartResponse
        {
            SessionId = session.Id,
            Message = aiResponse.Message,
            QuestionNumber = 1,
            TotalQuestions = session.TotalQuestions,
            Topic = aiResponse.Topic,
            InterviewMode = session.InterviewMode
        };
    }

    public async Task<AnswerResponse> SubmitAnswerAsync(int userId, int sessionId, SubmitAnswerRequest request)
    {
        var session = await _db.InterviewSessions
            .Include(s => s.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null)
            throw new KeyNotFoundException("Interview session not found.");
        if (session.Status != "InProgress")
            throw new InvalidOperationException("This interview has already been completed.");

        // 1. Store the candidate's answer
        var candidateMessage = new InterviewMessage
        {
            SessionId = session.Id,
            Role = "candidate",
            Content = request.Answer,
            CreatedAt = DateTime.UtcNow
        };
        _db.InterviewMessages.Add(candidateMessage);

        // 2. Build full conversation history for AI context
        var conversationHistory = BuildConversationHistory(session.Messages.ToList());
        conversationHistory.Add(new ChatMessage { Role = "user", Content = request.Answer });

        // 3. Determine which question the AI should handle next
        var nextQuestion = session.CurrentQuestionNumber + 1;
        var isLastAnswer = session.CurrentQuestionNumber >= session.TotalQuestions;

        // 4. Get AI evaluation + next question (or summary)
        // Restore focus topics from session so the AI stays on-topic throughout
        var focusTopics = !string.IsNullOrWhiteSpace(session.FocusTopics)
            ? JsonSerializer.Deserialize<List<string>>(session.FocusTopics) : null;

        var aiResponse = await _ai.GetInterviewResponseAsync(
            session.Technology,
            session.ExperienceLevel,
            session.TotalQuestions,
            isLastAnswer ? session.TotalQuestions : nextQuestion,
            conversationHistory,
            focusTopics: focusTopics);

        // 5. Store the AI's response as an interviewer message
        var interviewerMessage = new InterviewMessage
        {
            SessionId = session.Id,
            Role = "interviewer",
            Content = aiResponse.Message,
            Score = aiResponse.Score,
            Feedback = aiResponse.Feedback,
            QuestionTopic = aiResponse.IsComplete ? null : aiResponse.Topic,
            QuestionNumber = aiResponse.IsComplete ? null : (aiResponse.QuestionNumber ?? nextQuestion),
            CreatedAt = DateTime.UtcNow.AddMilliseconds(1) // Ensure ordering after candidate message
        };
        _db.InterviewMessages.Add(interviewerMessage);

        // 6. Update session state
        if (aiResponse.IsComplete || isLastAnswer)
        {
            session.Status = "Completed";
            session.OverallScore = aiResponse.OverallScore;
            session.OverallFeedback = aiResponse.OverallFeedback;
            session.Strengths = aiResponse.Strengths != null
                ? JsonSerializer.Serialize(aiResponse.Strengths) : null;
            session.Improvements = aiResponse.Improvements != null
                ? JsonSerializer.Serialize(aiResponse.Improvements) : null;
            session.CompletedAt = DateTime.UtcNow;

            _logger.LogInformation("Interview {SessionId} completed. Score: {Score}",
                session.Id, aiResponse.OverallScore);
        }
        else
        {
            session.CurrentQuestionNumber = nextQuestion;
        }

        await _db.SaveChangesAsync();

        return new AnswerResponse
        {
            Message = aiResponse.Message,
            Score = aiResponse.Score,
            Feedback = aiResponse.Feedback,
            QuestionNumber = aiResponse.IsComplete
                ? session.TotalQuestions
                : (aiResponse.QuestionNumber ?? nextQuestion),
            TotalQuestions = session.TotalQuestions,
            Topic = aiResponse.Topic,
            IsComplete = aiResponse.IsComplete || isLastAnswer,
            OverallScore = aiResponse.OverallScore,
            OverallFeedback = aiResponse.OverallFeedback,
            Strengths = aiResponse.Strengths,
            Improvements = aiResponse.Improvements
        };
    }

    public async Task<List<InterviewHistoryItem>> GetHistoryAsync(int userId)
    {
        return await _db.InterviewSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.StartedAt)
            .Select(s => new InterviewHistoryItem
            {
                Id = s.Id,
                Technology = s.Technology,
                ExperienceLevel = s.ExperienceLevel,
                TotalQuestions = s.TotalQuestions,
                Status = s.Status,
                OverallScore = s.OverallScore,
                StartedAt = s.StartedAt,
                CompletedAt = s.CompletedAt
            })
            .ToListAsync();
    }

    public async Task<InterviewDetailResponse?> GetInterviewDetailAsync(int userId, int sessionId)
    {
        var session = await _db.InterviewSessions
            .Include(s => s.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null) return null;

        return new InterviewDetailResponse
        {
            Id = session.Id,
            Technology = session.Technology,
            ExperienceLevel = session.ExperienceLevel,
            TotalQuestions = session.TotalQuestions,
            Status = session.Status,
            OverallScore = session.OverallScore,
            OverallFeedback = session.OverallFeedback,
            Strengths = session.Strengths != null
                ? JsonSerializer.Deserialize<List<string>>(session.Strengths) : null,
            Improvements = session.Improvements != null
                ? JsonSerializer.Deserialize<List<string>>(session.Improvements) : null,
            StartedAt = session.StartedAt,
            CompletedAt = session.CompletedAt,
            Messages = session.Messages.Select(m => new MessageResponse
            {
                Role = m.Role,
                Content = m.Content,
                Score = m.Score,
                Feedback = m.Feedback,
                QuestionTopic = m.QuestionTopic,
                QuestionNumber = m.QuestionNumber,
                CreatedAt = m.CreatedAt
            }).ToList()
        };
    }

    /// <summary>
    /// Reconstruct the conversation in OpenAI chat format from stored messages.
    /// </summary>
    private static List<ChatMessage> BuildConversationHistory(List<InterviewMessage> messages)
    {
        return messages.Select(m =>
        {
            if (m.Role == "interviewer")
            {
                // Reconstruct the JSON format the AI originally produced
                var json = JsonSerializer.Serialize(new
                {
                    message = m.Content,
                    score = m.Score,
                    feedback = m.Feedback,
                    topic = m.QuestionTopic,
                    questionNumber = m.QuestionNumber,
                    isComplete = false
                });
                return new ChatMessage { Role = "assistant", Content = json };
            }
            else
            {
                return new ChatMessage { Role = "user", Content = m.Content };
            }
        }).ToList();
    }

    public async Task<List<WeakTopicItem>> GetWeakTopicsAsync(int userId, string? technology = null)
    {
        var query = _db.InterviewMessages
            .Where(m => m.Session.UserId == userId
                     && m.Session.Status == "Completed"
                     && m.Role == "interviewer"
                     && m.Score.HasValue
                     && !string.IsNullOrWhiteSpace(m.QuestionTopic));

        if (!string.IsNullOrWhiteSpace(technology))
            query = query.Where(m => m.Session.Technology == technology);

        var weakTopics = await query
            .GroupBy(m => new { m.QuestionTopic, m.Session.Technology })
            .Select(g => new
            {
                Topic = g.Key.QuestionTopic!,
                Technology = g.Key.Technology,
                AverageScore = g.Average(m => m.Score!.Value),
                QuestionCount = g.Count()
            })
            .Where(t => t.AverageScore < 6 && t.QuestionCount >= 1)
            .OrderBy(t => t.AverageScore)
            .ThenByDescending(t => t.QuestionCount)
            .Take(15)
            .ToListAsync();

        return weakTopics.Select(t => new WeakTopicItem
        {
            Topic = t.Topic,
            Technology = t.Technology,
            AverageScore = Math.Round(t.AverageScore, 1),
            QuestionCount = t.QuestionCount
        }).ToList();
    }

    public async Task AbandonInterviewAsync(int userId, int sessionId)
    {
        var session = await _db.InterviewSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId);

        if (session == null) throw new KeyNotFoundException("Session not found.");
        if (session.Status == "Completed") return; // Already finished

        session.Status = "Abandoned";
        session.CompletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        _logger.LogInformation("Interview {SessionId} abandoned by user {UserId} at Q{Q}/{Total}",
            sessionId, userId, session.CurrentQuestionNumber, session.TotalQuestions);
    }

    public async Task<CreditCheckResult> CheckCreditsAsync(int userId, string interviewMode)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null)
            return new CreditCheckResult { HasCredits = false, Reason = "User not found." };

        var isPremium = interviewMode == "premium";
        var enough = isPremium ? user.PremiumCreditsBalance > 0 : user.BasicCreditsBalance > 0;

        return new CreditCheckResult
        {
            HasCredits = enough,
            BasicBalance = user.BasicCreditsBalance,
            PremiumBalance = user.PremiumCreditsBalance,
            Reason = enough
                ? null
                : isPremium
                    ? "No premium credits remaining. Buy a Premium or Pro pack to continue."
                    : "No basic credits remaining. Buy a credit pack to continue."
        };
    }

    public async Task<bool> DeductCreditAsync(int userId, string interviewMode)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return false;

        if (interviewMode == "premium")
        {
            if (user.PremiumCreditsBalance <= 0) return false;
            user.PremiumCreditsBalance--;
        }
        else
        {
            if (user.BasicCreditsBalance <= 0) return false;
            user.BasicCreditsBalance--;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CreditBalanceDto> GetCreditBalanceAsync(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        return new CreditBalanceDto
        {
            BasicCredits = user?.BasicCreditsBalance ?? 0,
            PremiumCredits = user?.PremiumCreditsBalance ?? 0
        };
    }
}
