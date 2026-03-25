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
        var session = new InterviewSession
        {
            UserId = userId,
            Technology = request.Technology,
            ExperienceLevel = request.ExperienceLevel,
            TotalQuestions = request.TotalQuestions,
            CurrentQuestionNumber = 1,
            Status = "InProgress",
            StartedAt = DateTime.UtcNow
        };

        _db.InterviewSessions.Add(session);
        await _db.SaveChangesAsync();

        // Ask AI for the first question (empty conversation history)
        var aiResponse = await _ai.GetInterviewResponseAsync(
            session.Technology,
            session.ExperienceLevel,
            session.TotalQuestions,
            1,
            new List<ChatMessage>());

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
            Topic = aiResponse.Topic
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
        var aiResponse = await _ai.GetInterviewResponseAsync(
            session.Technology,
            session.ExperienceLevel,
            session.TotalQuestions,
            isLastAnswer ? session.TotalQuestions : nextQuestion,
            conversationHistory);

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
}
