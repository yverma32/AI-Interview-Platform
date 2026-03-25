using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public interface IAIService
{
    /// <summary>
    /// Send the conversation so far to OpenAI and get the interviewer's next response.
    /// </summary>
    Task<AIInterviewResponse> GetInterviewResponseAsync(
        string technology,
        string experienceLevel,
        int totalQuestions,
        int currentQuestion,
        List<ChatMessage> conversationHistory);

    /// <summary>
    /// Generate interview questions for a given technology/topic (no answers).
    /// </summary>
    Task<List<GeneratedQuestion>> GenerateQuestionsAsync(string technology, string? topic, int count);

    /// <summary>
    /// Generate answers for a batch of questions.
    /// </summary>
    Task<List<QuestionAnswer>> GenerateBatchAnswersAsync(string technology, List<QuestionItem> questions);
}
