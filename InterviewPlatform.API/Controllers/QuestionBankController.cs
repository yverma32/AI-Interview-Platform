using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[EnableRateLimiting("api")]
public class QuestionBankController : ControllerBase
{
    private readonly IAIService _aiService;

    public QuestionBankController(IAIService aiService)
    {
        _aiService = aiService;
    }

    /// <summary>Generate interview questions using AI</summary>
    [HttpPost("generate")]
    public async Task<ActionResult<List<GeneratedQuestion>>> GenerateQuestions([FromBody] GenerateQuestionsRequest request)
    {
        try
        {
            var questions = await _aiService.GenerateQuestionsAsync(
                request.Technology,
                request.Topic,
                request.Count);

            return Ok(questions);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }
    }

    /// <summary>Generate answers for a batch of questions</summary>
    [HttpPost("answers")]
    public async Task<ActionResult<List<QuestionAnswer>>> GetBatchAnswers([FromBody] BatchAnswersRequest request)
    {
        try
        {
            var answers = await _aiService.GenerateBatchAnswersAsync(
                request.Technology,
                request.Questions);

            return Ok(answers);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            return StatusCode(502, new { message = ex.Message });
        }
    }


}
