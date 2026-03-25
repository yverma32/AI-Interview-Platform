using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProgressController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProgressController(AppDbContext db)
    {
        _db = db;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("User ID not found in token."));

    /// <summary>Get aggregated progress stats for the current user</summary>
    [HttpGet]
    public async Task<ActionResult<ProgressResponse>> GetProgress()
    {
        var userId = GetUserId();

        var sessions = await _db.InterviewSessions
            .Where(s => s.UserId == userId)
            .Include(s => s.Messages)
            .OrderByDescending(s => s.StartedAt)
            .ToListAsync();

        var completed = sessions.Where(s => s.Status == "Completed").ToList();

        // ── Overall Stats ──
        var stats = new OverallStats
        {
            TotalInterviews = sessions.Count,
            CompletedInterviews = completed.Count,
            AverageScore = completed.Any(c => c.OverallScore.HasValue)
                ? Math.Round(completed.Where(c => c.OverallScore.HasValue).Average(c => c.OverallScore!.Value), 1)
                : null,
            BestScore = completed.Any(c => c.OverallScore.HasValue)
                ? completed.Where(c => c.OverallScore.HasValue).Max(c => c.OverallScore!.Value)
                : null,
            TotalQuestionsAnswered = completed.Sum(c => c.TotalQuestions),
            TotalPracticeMinutes = (int)completed
                .Where(c => c.CompletedAt.HasValue)
                .Sum(c => (c.CompletedAt!.Value - c.StartedAt).TotalMinutes),
        };

        // ── Score over time (last 20 completed) ──
        var scoreHistory = completed
            .Where(c => c.OverallScore.HasValue)
            .OrderBy(c => c.CompletedAt)
            .TakeLast(20)
            .Select(c => new ScorePoint
            {
                Date = (c.CompletedAt ?? c.StartedAt).ToString("MMM dd"),
                Score = Math.Round(c.OverallScore!.Value, 1),
                Technology = c.Technology,
            })
            .ToList();

        // ── Per-technology breakdown ──
        var techBreakdown = completed
            .GroupBy(c => c.Technology)
            .Select(g => new TechnologyStats
            {
                Technology = g.Key,
                InterviewCount = g.Count(),
                AverageScore = g.Any(s => s.OverallScore.HasValue)
                    ? Math.Round(g.Where(s => s.OverallScore.HasValue).Average(s => s.OverallScore!.Value), 1)
                    : null,
                BestScore = g.Any(s => s.OverallScore.HasValue)
                    ? g.Where(s => s.OverallScore.HasValue).Max(s => s.OverallScore!.Value)
                    : null,
                LastPracticed = (g.Max(s => s.CompletedAt) ?? g.Max(s => s.StartedAt)).ToString("MMM dd, yyyy"),
            })
            .OrderByDescending(t => t.InterviewCount)
            .ToList();

        // ── Topic-level scores from messages ──
        var topicScores = completed
            .SelectMany(c => c.Messages)
            .Where(m => m.Role == "interviewer" && m.Score.HasValue && !string.IsNullOrWhiteSpace(m.QuestionTopic))
            .GroupBy(m => m.QuestionTopic!)
            .Select(g => new TopicScore
            {
                Topic = g.Key,
                AverageScore = Math.Round(g.Average(m => m.Score!.Value), 1),
                QuestionCount = g.Count(),
            })
            .OrderByDescending(t => t.QuestionCount)
            .Take(15)
            .ToList();

        // ── Strengths & Improvements aggregated ──
        var allStrengths = completed
            .Where(c => !string.IsNullOrWhiteSpace(c.Strengths))
            .SelectMany(c =>
            {
                try { return JsonSerializer.Deserialize<List<string>>(c.Strengths!) ?? new(); }
                catch { return new List<string>(); }
            })
            .GroupBy(s => s)
            .OrderByDescending(g => g.Count())
            .Take(5)
            .Select(g => g.Key)
            .ToList();

        var allImprovements = completed
            .Where(c => !string.IsNullOrWhiteSpace(c.Improvements))
            .SelectMany(c =>
            {
                try { return JsonSerializer.Deserialize<List<string>>(c.Improvements!) ?? new(); }
                catch { return new List<string>(); }
            })
            .GroupBy(s => s)
            .OrderByDescending(g => g.Count())
            .Take(5)
            .Select(g => g.Key)
            .ToList();

        // ── Recent sessions ──
        var recentSessions = sessions
            .Take(10)
            .Select(s => new RecentSession
            {
                Id = s.Id,
                Technology = s.Technology,
                ExperienceLevel = s.ExperienceLevel,
                TotalQuestions = s.TotalQuestions,
                Status = s.Status,
                OverallScore = s.OverallScore.HasValue ? Math.Round(s.OverallScore.Value, 1) : null,
                StartedAt = s.StartedAt.ToString("MMM dd, yyyy"),
                Duration = s.CompletedAt.HasValue
                    ? $"{(int)(s.CompletedAt.Value - s.StartedAt).TotalMinutes} min"
                    : null,
            })
            .ToList();

        return Ok(new ProgressResponse
        {
            Stats = stats,
            ScoreHistory = scoreHistory,
            TechnologyBreakdown = techBreakdown,
            TopicScores = topicScores,
            Strengths = allStrengths,
            Improvements = allImprovements,
            RecentSessions = recentSessions,
        });
    }
}
