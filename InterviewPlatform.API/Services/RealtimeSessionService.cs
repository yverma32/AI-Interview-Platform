using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace InterviewPlatform.API.Services;

public class RealtimeSessionService : IRealtimeSessionService
{
    private readonly AppDbContext _db;
    private readonly IInterviewService _interviewService;
    private readonly IResumeService _resumeService;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private readonly ILogger<RealtimeSessionService> _logger;

    public RealtimeSessionService(
        AppDbContext db,
        IInterviewService interviewService,
        IResumeService resumeService,
        IConfiguration config,
        IHttpClientFactory httpFactory,
        ILogger<RealtimeSessionService> logger)
    {
        _db = db;
        _interviewService = interviewService;
        _resumeService = resumeService;
        _config = config;
        _httpFactory = httpFactory;
        _logger = logger;
    }

    public async Task<bool> CanUserStartInterviewAsync(int userId)
    {
        var balance = await _interviewService.GetCreditBalanceAsync(userId);
        return balance.PremiumCredits > 0;
    }

    public async Task<CreateRealtimeSessionResponse> CreateSessionAsync(int userId, CreateRealtimeSessionRequest request)
    {
        // Premium credit gate. Deduct atomically before any OpenAI side-effects so a successful
        // call always implies a credit was spent — and if OpenAI fails below, we refund.
        var check = await _interviewService.CheckCreditsAsync(userId, "premium");
        if (!check.HasCredits)
            throw new InvalidOperationException(check.Reason ?? "No premium credits remaining.");

        var deducted = await _interviewService.DeductCreditAsync(userId, "premium");
        if (!deducted)
            throw new InvalidOperationException("Failed to deduct premium credit. Please try again.");

        var apiKey = _config["OpenAI:ApiKey"]
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? throw new InvalidOperationException("OpenAI API key not configured.");

        var realtimeModel = _config["OpenAI:RealtimeModel"] ?? "gpt-realtime";

        // For resume round: if the client didn't pass ResumeContext, pull the user's most recent.
        var resumeContext = request.ResumeContext;
        if (request.RoundType == "resume" && string.IsNullOrWhiteSpace(resumeContext))
        {
            resumeContext = await _resumeService.GetRawTextAsync(userId);
            if (string.IsNullOrWhiteSpace(resumeContext))
                throw new InvalidOperationException("No resume on file. Please upload a resume before starting a resume round.");
        }

        var ctx = new InterviewerPersonas.PersonaContext(
            request.Technology,
            request.ExperienceLevel,
            request.TotalQuestions,
            request.CompanyTrack,
            resumeContext,
            request.FocusTopics);
        var (persona, voice, instructions) = InterviewerPersonas.Build(request.RoundType, ctx);

        // Persist the InterviewSession first so we have a real sessionId before contacting OpenAI.
        var session = new InterviewSession
        {
            UserId = userId,
            Technology = request.Technology,
            ExperienceLevel = request.ExperienceLevel,
            TotalQuestions = request.TotalQuestions,
            CurrentQuestionNumber = 1,
            Status = "InProgress",
            InterviewMode = "premium",
            CreditsConsumed = 1,
            RoundType = request.RoundType,
            PersonaName = persona,
            CompanyTrack = request.CompanyTrack,
            UsedRealtimeAPI = true,
            FocusTopics = request.FocusTopics is { Count: > 0 }
                ? JsonSerializer.Serialize(request.FocusTopics) : null,
            StartedAt = DateTime.UtcNow
        };
        _db.InterviewSessions.Add(session);
        await _db.SaveChangesAsync();

        // GA shape (May 2026): config goes inside a `session` envelope, audio is nested,
        // tools live at session level, endpoint is /v1/realtime/client_secrets.
        var requestBody = new
        {
            session = new
            {
                type = "realtime",
                model = realtimeModel,
                instructions,
                audio = new
                {
                    input = new
                    {
                        format = new { type = "audio/pcm", rate = 24000 },
                        turn_detection = new
                        {
                            type = "semantic_vad",
                            eagerness = "low",
                            create_response = true,
                            interrupt_response = true
                        },
                        transcription = new { model = "whisper-1" }
                    },
                    output = new { voice, speed = 1.0 }
                },
                output_modalities = new[] { "audio" },
                tools = BuildInterviewTools(),
                tool_choice = "auto",
                max_output_tokens = 500
            }
        };

        var http = _httpFactory.CreateClient("OpenAIRealtime");
        var http_request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/realtime/client_secrets")
        {
            Content = new StringContent(JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json")
        };
        http_request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var response = await http.SendAsync(http_request);
        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("OpenAI Realtime session creation failed: {Status} {Body}", response.StatusCode, body);
            // Rollback: drop the DB row and refund the premium credit so the user isn't charged for a session they can't connect to.
            _db.InterviewSessions.Remove(session);
            var user = await _db.Users.FindAsync(userId);
            if (user != null) user.PremiumCreditsBalance++;
            await _db.SaveChangesAsync();
            throw new InvalidOperationException("Failed to create Realtime session. Please try again.");
        }

        // The GA response shape has shifted between revisions: sometimes the ephemeral key sits at
        // `client_secret.value`, sometimes at `value` directly (when the response IS the client
        // secret object). Probe both, and log the top-level keys if neither hits so we can iterate.
        string? clientSecret = null;
        long expiresAtUnix = 0;
        using (var doc = JsonDocument.Parse(body))
        {
            var root = doc.RootElement;

            if (root.TryGetProperty("client_secret", out var cs) && cs.ValueKind == JsonValueKind.Object)
            {
                if (cs.TryGetProperty("value", out var v)) clientSecret = v.GetString();
                if (cs.TryGetProperty("expires_at", out var e)) expiresAtUnix = e.GetInt64();
            }
            else if (root.TryGetProperty("value", out var v))
            {
                clientSecret = v.GetString();
                if (root.TryGetProperty("expires_at", out var e)) expiresAtUnix = e.GetInt64();
            }

            if (string.IsNullOrWhiteSpace(clientSecret))
            {
                var keys = string.Join(",", root.EnumerateObject().Select(p => p.Name));
                _logger.LogError("Realtime client_secret missing. Top-level keys: [{Keys}]", keys);
                throw new InvalidOperationException("Realtime session response missing client_secret.");
            }
        }

        var expiresAt = expiresAtUnix > 0
            ? DateTimeOffset.FromUnixTimeSeconds(expiresAtUnix).UtcDateTime
            : DateTime.UtcNow.AddMinutes(1);

        _logger.LogInformation("Realtime session {SessionId} created for user {UserId} ({Persona}/{RoundType})",
            session.Id, userId, persona, request.RoundType);

        // Never log the client secret. Only persona/voice/expiry.
        return new CreateRealtimeSessionResponse
        {
            ClientSecret = clientSecret,
            SessionId = session.Id,
            ExpiresAt = expiresAt,
            PersonaName = persona,
            Voice = voice,
            RealtimeModel = realtimeModel
        };
    }

    public async Task SaveQuestionScoreAsync(int userId, int sessionId, ScoreAnswerRequest request)
    {
        var session = await _db.InterviewSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new KeyNotFoundException("Session not found.");

        if (session.Status != "InProgress")
            throw new InvalidOperationException("Session is no longer active.");

        // Write the question + answer as two messages so existing history rendering works unchanged.
        var now = DateTime.UtcNow;
        _db.InterviewMessages.Add(new InterviewMessage
        {
            SessionId = session.Id,
            Role = "interviewer",
            Content = request.Question,
            QuestionTopic = request.Topic,
            QuestionNumber = request.QuestionNumber,
            CreatedAt = now
        });
        _db.InterviewMessages.Add(new InterviewMessage
        {
            SessionId = session.Id,
            Role = "candidate",
            Content = request.Answer,
            CreatedAt = now.AddMilliseconds(1)
        });
        // The score belongs to the candidate's answer, but the existing schema attaches Score/Feedback
        // to the interviewer message (since that's where the AI's evaluation lives in the legacy flow).
        _db.InterviewMessages.Add(new InterviewMessage
        {
            SessionId = session.Id,
            Role = "interviewer",
            Content = request.Feedback,
            Score = request.Score,
            Feedback = request.Feedback,
            QuestionTopic = request.Topic,
            QuestionNumber = request.QuestionNumber,
            CreatedAt = now.AddMilliseconds(2)
        });

        session.CurrentQuestionNumber = Math.Max(session.CurrentQuestionNumber, request.QuestionNumber);
        await _db.SaveChangesAsync();
    }

    public async Task CompleteSessionAsync(int userId, int sessionId, CompleteSessionRequest request)
    {
        var session = await _db.InterviewSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.UserId == userId)
            ?? throw new KeyNotFoundException("Session not found.");

        if (session.Status == "Completed") return; // idempotent

        session.Status = "Completed";
        session.CompletedAt = DateTime.UtcNow;
        session.DurationSeconds = request.DurationSeconds > 0
            ? request.DurationSeconds
            : (int)(session.CompletedAt.Value - session.StartedAt).TotalSeconds;
        session.OverallScore = request.OverallScore;
        session.OverallFeedback = request.OverallFeedback;
        session.HiringRecommendation = request.HiringRecommendation;
        session.Strengths = request.Strengths is { Count: > 0 }
            ? JsonSerializer.Serialize(request.Strengths) : session.Strengths;
        session.Improvements = request.Improvements is { Count: > 0 }
            ? JsonSerializer.Serialize(request.Improvements) : session.Improvements;

        await _db.SaveChangesAsync();

        _logger.LogInformation("Realtime session {SessionId} completed by user {UserId}. Score={Score}, Rec={Rec}, Duration={Dur}s",
            sessionId, userId, request.OverallScore, request.HiringRecommendation, session.DurationSeconds);
    }

    private static object[] BuildInterviewTools() => new object[]
    {
        new
        {
            type = "function",
            name = "score_answer",
            description = "Call this immediately after evaluating each candidate answer.",
            parameters = new
            {
                type = "object",
                properties = new Dictionary<string, object>
                {
                    ["question"] = new { type = "string", description = "The question that was asked" },
                    ["answer"] = new { type = "string", description = "Concise summary of the candidate's answer" },
                    ["topic"] = new { type = "string", description = "Topic area, e.g. 'React Hooks', 'Binary Search'" },
                    ["score"] = new { type = "integer", description = "Score 1-10" },
                    ["feedback"] = new { type = "string", description = "Brief evaluation, 1-2 sentences" },
                    ["question_number"] = new { type = "integer", description = "Which question this was (1-based)" },
                    ["follow_up_asked"] = new { type = "boolean", description = "Whether you asked a follow-up" }
                },
                required = new[] { "question", "answer", "topic", "score", "feedback", "question_number" }
            }
        },
        new
        {
            type = "function",
            name = "end_interview",
            description = "Call this exactly once when the interview is complete (all questions answered).",
            parameters = new
            {
                type = "object",
                properties = new Dictionary<string, object>
                {
                    ["overall_score"] = new { type = "number", description = "Overall score 1.0-10.0" },
                    ["overall_feedback"] = new { type = "string", description = "1-paragraph summary of the candidate's performance" },
                    ["strengths"] = new { type = "array", items = new { type = "string" }, description = "3 specific strengths" },
                    ["improvements"] = new { type = "array", items = new { type = "string" }, description = "3 areas to improve" },
                    ["hiring_recommendation"] = new
                    {
                        type = "string",
                        @enum = new[] { "strong_yes", "yes", "no", "strong_no" }
                    }
                },
                required = new[] { "overall_score", "strengths", "improvements", "hiring_recommendation" }
            }
        },
        new
        {
            type = "function",
            name = "flag_weak_topic",
            description = "Call when the candidate shows significant weakness in a specific topic.",
            parameters = new
            {
                type = "object",
                properties = new Dictionary<string, object>
                {
                    ["topic"] = new { type = "string" },
                    ["severity"] = new
                    {
                        type = "string",
                        @enum = new[] { "mild", "moderate", "severe" }
                    }
                },
                required = new[] { "topic", "severity" }
            }
        },
        new
        {
            type = "function",
            name = "request_code_input",
            description = "Call this when you want the candidate to write code (e.g. for a DSA problem, frontend implementation, or debugging exercise). A code editor will open on the candidate's screen. WAIT for their submission before proceeding — they will return their code as a message.",
            parameters = new
            {
                type = "object",
                properties = new Dictionary<string, object>
                {
                    ["language"] = new
                    {
                        type = "string",
                        description = "Programming language for syntax highlighting (e.g. javascript, typescript, python, java, csharp, cpp, go, rust, sql)"
                    },
                    ["prompt"] = new
                    {
                        type = "string",
                        description = "The problem statement / coding task to display above the editor. Be specific and complete — the candidate will write code based on this."
                    },
                    ["starter_code"] = new
                    {
                        type = "string",
                        description = "Optional function signature or boilerplate to pre-fill the editor (e.g. 'function reverseList(head) {\\n  // your code here\\n}')"
                    }
                },
                required = new[] { "language", "prompt" }
            }
        }
    };
}
