using System.Text;
using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Models;
using InterviewPlatform.API.Models.DTOs;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace InterviewPlatform.API.Services;

public class ResumeService : IResumeService
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB
    private static readonly string[] AllowedContentTypes =
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    };

    private readonly AppDbContext _db;
    private readonly IAIService _ai;
    private readonly ILogger<ResumeService> _logger;

    public ResumeService(AppDbContext db, IAIService ai, ILogger<ResumeService> logger)
    {
        _db = db;
        _ai = ai;
        _logger = logger;
    }

    public async Task<ResumeResponse> UploadAsync(int userId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            throw new ArgumentException("No file uploaded.");
        if (file.Length > MaxBytes)
            throw new ArgumentException("File exceeds 5 MB limit.");
        if (!AllowedContentTypes.Contains(file.ContentType))
            throw new ArgumentException("Only PDF or DOCX files are accepted.");

        await using var stream = file.OpenReadStream();
        var rawText = file.ContentType == "application/pdf"
            ? ExtractPdfText(stream)
            : ExtractDocxText(stream);

        if (string.IsNullOrWhiteSpace(rawText))
            throw new InvalidOperationException("Could not extract any text from the file.");

        var parsedJson = await _ai.ParseResumeAsync(rawText);

        var entity = new UserResume
        {
            UserId = userId,
            FileName = file.FileName,
            RawText = rawText,
            ParsedJson = parsedJson,
            UploadedAt = DateTime.UtcNow
        };
        _db.UserResumes.Add(entity);
        await _db.SaveChangesAsync();

        _logger.LogInformation("Resume uploaded by user {UserId}: {File} ({Bytes} bytes, {Chars} chars text)",
            userId, file.FileName, file.Length, rawText.Length);

        return ToResponse(entity);
    }

    public async Task<ResumeResponse?> GetLatestAsync(int userId)
    {
        var entity = await _db.UserResumes
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UploadedAt)
            .FirstOrDefaultAsync();
        return entity is null ? null : ToResponse(entity);
    }

    public async Task<string?> GetRawTextAsync(int userId)
    {
        return await _db.UserResumes
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.UploadedAt)
            .Select(r => r.RawText)
            .FirstOrDefaultAsync();
    }

    // ───────────── Text extractors ─────────────

    private static string ExtractPdfText(Stream stream)
    {
        var sb = new StringBuilder();
        using var pdf = PdfDocument.Open(stream);
        foreach (var page in pdf.GetPages())
        {
            sb.AppendLine(page.Text);
        }
        return sb.ToString().Trim();
    }

    private static string ExtractDocxText(Stream stream)
    {
        using var doc = WordprocessingDocument.Open(stream, false);
        var body = doc.MainDocumentPart?.Document?.Body;
        return body?.InnerText.Trim() ?? string.Empty;
    }

    private static ResumeResponse ToResponse(UserResume e)
    {
        ParsedResume? parsed = null;
        try
        {
            parsed = JsonSerializer.Deserialize<ParsedResume>(e.ParsedJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch { /* ignore — return raw without parsed structure */ }

        return new ResumeResponse
        {
            Id = e.Id,
            FileName = e.FileName,
            UploadedAt = e.UploadedAt,
            Parsed = parsed,
            Snippet = e.RawText.Length > 500 ? e.RawText[..500] + "…" : e.RawText
        };
    }
}
