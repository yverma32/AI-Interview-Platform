using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace InterviewPlatform.API.Services;

public class OnboardingService : IOnboardingService
{
    private const int QuestionCount = 10;
    private static readonly TimeSpan AssessmentTtl = TimeSpan.FromMinutes(20);

    private readonly AppDbContext _db;
    private readonly ICacheService _cache;
    private readonly IConfiguration _config;
    private readonly ILogger<OnboardingService> _logger;

    public OnboardingService(AppDbContext db, ICacheService cache, IConfiguration config, ILogger<OnboardingService> logger)
    {
        _db = db;
        _cache = cache;
        _config = config;
        _logger = logger;
    }

    public async Task<AssessmentSetResponse> GenerateAssessmentAsync(int userId)
    {
        var questions = await GenerateViaOpenAIAsync();

        var assessmentId = Guid.NewGuid().ToString("N");
        await _cache.SetAsync($"assessment:{userId}:{assessmentId}",
            new AssessmentEnvelope { Questions = questions, CreatedAt = DateTime.UtcNow },
            AssessmentTtl);

        return new AssessmentSetResponse
        {
            AssessmentId = assessmentId,
            Questions = questions.Select(q => new AssessmentQuestion
            {
                Id = q.Id,
                Question = q.Question,
                Options = q.Options,
                Topic = q.Topic
            }).ToList()
        };
    }

    public async Task<AssessmentResult> SubmitAssessmentAsync(int userId, SubmitAssessmentRequest request)
    {
        var envelope = await _cache.GetAsync<AssessmentEnvelope>($"assessment:{userId}:{request.AssessmentId}");
        if (envelope is null)
            throw new InvalidOperationException("Assessment expired or not found. Please start again.");

        var byId = envelope.Questions.ToDictionary(q => q.Id);
        var correctTopics = new List<string>();
        var wrongTopics = new List<string>();
        var score = 0;

        foreach (var ans in request.Answers)
        {
            if (!byId.TryGetValue(ans.QuestionId, out var q)) continue;
            if (ans.SelectedIndex == q.CorrectIndex)
            {
                score++;
                correctTopics.Add(q.Topic);
            }
            else
            {
                wrongTopics.Add(q.Topic);
            }
        }

        var total = envelope.Questions.Count;
        var (level, track) = Classify(score, total);

        // Upsert UserSkillProfile
        var profile = await _db.UserSkillProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (profile is null)
        {
            profile = new UserSkillProfile { UserId = userId, CreatedAt = DateTime.UtcNow };
            _db.UserSkillProfiles.Add(profile);
        }
        profile.SkillLevel = level;
        profile.CompanyTarget = track;
        profile.AssessmentScore = score;
        profile.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _cache.RemoveAsync($"assessment:{userId}:{request.AssessmentId}");

        _logger.LogInformation("Onboarding complete for user {UserId}: {Score}/{Total} → {Level}/{Track}",
            userId, score, total, level, track);

        return new AssessmentResult
        {
            Score = score,
            Total = total,
            SkillLevel = level,
            RecommendedCompanyTrack = track,
            StrongTopics = correctTopics.Distinct().Take(5).ToList(),
            WeakTopics = wrongTopics.Distinct().Take(5).ToList()
        };
    }

    public async Task<AssessmentResult?> GetCurrentProfileAsync(int userId)
    {
        var p = await _db.UserSkillProfiles.FirstOrDefaultAsync(p => p.UserId == userId);
        if (p is null) return null;
        return new AssessmentResult
        {
            Score = p.AssessmentScore,
            Total = QuestionCount,
            SkillLevel = p.SkillLevel,
            RecommendedCompanyTrack = p.CompanyTarget
        };
    }

    private static (string Level, string Track) Classify(int score, int total)
    {
        var pct = total == 0 ? 0 : (double)score / total;
        return pct switch
        {
            >= 0.8 => ("advanced", "faang"),
            >= 0.5 => ("intermediate", "startup"),
            _      => ("beginner", "service")
        };
    }

    // ───────────── OpenAI generator ─────────────

    private async Task<List<AssessmentQuestionWithAnswer>> GenerateViaOpenAIAsync()
    {
        var apiKey = _config["OpenAI:ApiKey"]
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? throw new InvalidOperationException("OpenAI API key not configured.");
        var model = _config["OpenAI:BulkModel"] ?? _config["OpenAI:Model"] ?? "gpt-4o-mini";

        var systemPrompt = $$"""
            Generate exactly {{QuestionCount}} multiple-choice questions to assess a software engineer's general skill level.
            Mix difficulty across easy, medium, and hard. Cover: DSA basics, JavaScript/React, system design concepts, SQL, OOPs.

            Return ONLY valid JSON, no markdown:
            {
              "questions": [
                { "id": 1, "question": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "topic": "DSA - Arrays" }
              ]
            }

            Rules:
            - Each question MUST have exactly 4 options.
            - correctIndex is 0-3.
            - Topic should be specific (e.g., "React Hooks", "SQL Joins", "Big-O").
            """;

        var body = JsonSerializer.Serialize(new
        {
            model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = "Generate the assessment now." }
            },
            temperature = 0.8,
            max_tokens = 2500,
            response_format = new { type = "json_object" }
        });

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        var req = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        var resp = await http.SendAsync(req);
        var raw = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"OpenAI returned {(int)resp.StatusCode}.");

        using var outer = JsonDocument.Parse(raw);
        var content = outer.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString()
            ?? throw new InvalidOperationException("Empty assessment response.");

        using var inner = JsonDocument.Parse(content);
        var arr = inner.RootElement.GetProperty("questions");
        var list = new List<AssessmentQuestionWithAnswer>();
        var nextId = 1;
        foreach (var q in arr.EnumerateArray())
        {
            list.Add(new AssessmentQuestionWithAnswer
            {
                Id = q.TryGetProperty("id", out var idEl) ? idEl.GetInt32() : nextId++,
                Question = q.GetProperty("question").GetString() ?? "",
                Options = q.GetProperty("options").EnumerateArray().Select(o => o.GetString() ?? "").ToList(),
                CorrectIndex = q.GetProperty("correctIndex").GetInt32(),
                Topic = q.TryGetProperty("topic", out var tEl) ? tEl.GetString() ?? "" : ""
            });
        }
        return list;
    }

    private class AssessmentEnvelope
    {
        public List<AssessmentQuestionWithAnswer> Questions { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }
}
