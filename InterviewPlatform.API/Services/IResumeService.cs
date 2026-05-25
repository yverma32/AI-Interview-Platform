using InterviewPlatform.API.Models.DTOs;
using Microsoft.AspNetCore.Http;

namespace InterviewPlatform.API.Services;

public interface IResumeService
{
    Task<ResumeResponse> UploadAsync(int userId, IFormFile file);
    Task<ResumeResponse?> GetLatestAsync(int userId);
    Task<string?> GetRawTextAsync(int userId);
}
