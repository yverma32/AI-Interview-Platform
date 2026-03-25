using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using InterviewPlatform.API.Models.DTOs;

namespace InterviewPlatform.API.Services;

public class AIService : IAIService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly ILogger<AIService> _logger;

    public AIService(IConfiguration config, ILogger<AIService> logger)
    {
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        _apiKey = config["OpenAI:ApiKey"]
            ?? Environment.GetEnvironmentVariable("OPENAI_API_KEY")
            ?? string.Empty;
        _model = config["OpenAI:Model"] ?? "gpt-4o-mini";
        _logger = logger;
    }

    public async Task<AIInterviewResponse> GetInterviewResponseAsync(
        string technology,
        string experienceLevel,
        int totalQuestions,
        int currentQuestion,
        List<ChatMessage> conversationHistory)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json or OPENAI_API_KEY environment variable.");

        var systemPrompt = BuildSystemPrompt(technology, experienceLevel, totalQuestions, currentQuestion);

        // Build messages array: system + conversation history
        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };
        messages.AddRange(conversationHistory.Select(m => (object)new { role = m.Role, content = m.Content }));

        var requestBody = new
        {
            model = _model,
            messages,
            temperature = 0.7,
            max_tokens = 1024,
            response_format = new { type = "json_object" }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        _logger.LogInformation("Calling OpenAI ({Model}) for {Tech}/{Level} Q{Q}/{Total}",
            _model, technology, experienceLevel, currentQuestion, totalQuestions);

        var response = await _httpClient.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("OpenAI API error: {Status} — {Body}", response.StatusCode, responseContent);
            throw new HttpRequestException($"AI service returned {(int)response.StatusCode}. Please try again.");
        }

        // Extract assistant's content from OpenAI response
        using var doc = JsonDocument.Parse(responseContent);
        var assistantContent = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(assistantContent))
            throw new InvalidOperationException("AI returned an empty response.");

        _logger.LogDebug("AI raw response: {Content}", assistantContent);

        var parsed = JsonSerializer.Deserialize<AIInterviewResponse>(assistantContent,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        return parsed ?? throw new InvalidOperationException("Failed to parse AI response.");
    }

    private static string BuildSystemPrompt(string technology, string experienceLevel, int totalQuestions, int currentQuestion)
    {
        return $$"""
            You are "Alex", an expert technical interviewer conducting a professional {{experienceLevel}}-level job interview focused on {{technology}}.

            INTERVIEW CONTEXT:
            - Technology: {{technology}}
            - Experience Level: {{experienceLevel}}
            - Total Questions: {{totalQuestions}}
            - Current Question Number: {{currentQuestion}} of {{totalQuestions}}

            YOUR BEHAVIOR:
            1. Ask ONE clear, specific technical question at a time appropriate for {{experienceLevel}} level.
            2. Cover diverse aspects of {{technology}}: core concepts, practical scenarios, best practices, problem-solving, architecture, and debugging.
            3. After receiving an answer, briefly evaluate it, then ask the next question.
            4. Be professional, conversational, and encouraging — like a real human interviewer.
            5. Adapt difficulty slightly based on the candidate's performance so far.
            6. Do NOT prefix questions with numbers like "Question 3:" — weave them naturally into conversation.
            7. Keep your spoken message concise (2-4 sentences for the question, 2-3 sentences for feedback).

            SCORING GUIDELINES:
            - 9-10: Exceptional answer with deep insight and real-world experience
            - 7-8: Strong answer covering key points correctly
            - 5-6: Adequate answer but missing important details
            - 3-4: Partial understanding with significant gaps
            - 1-2: Incorrect or barely relevant answer

            RESPONSE FORMAT — You MUST respond with ONLY valid JSON (no markdown, no extra text):

            When asking a question (including the first one):
            {
              "message": "Your natural spoken response. For the first question, include a brief greeting. For subsequent questions, include brief feedback on the previous answer and the next question.",
              "score": null or 1-10,
              "feedback": null or "2-3 sentence evaluation of previous answer",
              "topic": "topic of the question being asked (e.g., React Hooks, State Management)",
              "questionNumber": {{currentQuestion}},
              "isComplete": false
            }

            ONLY when the candidate has answered the FINAL question (question {{totalQuestions}}), provide the closing summary:
            {
              "message": "Your closing remarks thanking the candidate and summarizing key observations",
              "score": 1-10,
              "feedback": "evaluation of the final answer",
              "topic": null,
              "questionNumber": null,
              "isComplete": true,
              "overallScore": weighted_average_1.0_to_10.0,
              "overallFeedback": "comprehensive paragraph summarizing overall performance",
              "strengths": ["strength1", "strength2", "strength3"],
              "improvements": ["area1", "area2", "area3"]
            }

            IMPORTANT:
            - "score" is null for the very first question (no answer to evaluate yet).
            - For all subsequent responses, "score" rates the PREVIOUS answer.
            - "message" should sound natural when read aloud via text-to-speech.
            - Set isComplete=true ONLY after the candidate has answered all {{totalQuestions}} questions.
            """;
    }

    public async Task<List<GeneratedQuestion>> GenerateQuestionsAsync(string technology, string? topic, int count)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json or OPENAI_API_KEY environment variable.");

        var topicClause = string.IsNullOrWhiteSpace(topic)
            ? "Cover a diverse range of topics and sub-areas within this technology."
            : $"Focus specifically on the topic: \"{topic}\".";

        var systemPrompt = $$"""
            You are an expert technical interview question generator.

            Generate exactly {{count}} interview questions for: {{technology}}
            {{topicClause}}

            REQUIREMENTS:
            1. Questions should be practical and commonly asked in real interviews.
            2. Mix difficulty levels: include Easy, Medium, and Hard questions.
            3. Each question should be clear, specific, and self-contained.
            4. Cover different aspects: concepts, practical scenarios, best practices, debugging, architecture.

            RESPONSE FORMAT — respond with ONLY valid JSON (no markdown):
            {
              "questions": [
                {
                  "id": 1,
                  "question": "The interview question text",
                  "difficulty": "Easy|Medium|Hard",
                  "topic": "Specific sub-topic (e.g., Hooks, Async/Await, Indexing)"
                }
              ]
            }
            """;

        var requestBody = new
        {
            model = _model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = $"Generate {count} interview questions for {technology}." }
            },
            temperature = 0.8,
            max_tokens = 1500,
            response_format = new { type = "json_object" }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        _logger.LogInformation("Generating {Count} questions for {Tech} (topic: {Topic})", count, technology, topic ?? "general");

        var response = await _httpClient.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("OpenAI API error: {Status} — {Body}", response.StatusCode, responseContent);
            throw new HttpRequestException($"AI service returned {(int)response.StatusCode}. Please try again.");
        }

        using var doc = JsonDocument.Parse(responseContent);
        var assistantContent = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(assistantContent))
            throw new InvalidOperationException("AI returned an empty response.");

        using var parsed = JsonDocument.Parse(assistantContent);
        var questionsArray = parsed.RootElement.GetProperty("questions");

        var result = new List<GeneratedQuestion>();
        foreach (var q in questionsArray.EnumerateArray())
        {
            result.Add(new GeneratedQuestion
            {
                Id = q.GetProperty("id").GetInt32(),
                Question = q.GetProperty("question").GetString() ?? "",
                Difficulty = q.GetProperty("difficulty").GetString() ?? "Medium",
                Topic = q.GetProperty("topic").GetString() ?? technology,
            });
        }

        return result;
    }

    public async Task<List<QuestionAnswer>> GenerateBatchAnswersAsync(string technology, List<QuestionItem> questions)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json or OPENAI_API_KEY environment variable.");

        var questionsText = string.Join("\n", questions.Select(q => $"{q.Id}. {q.Question}"));

        var systemPrompt = $$"""
            You are an expert technical interview coach for {{technology}}.
            Provide concise, high-quality answers for the following interview questions.

            REQUIREMENTS:
            1. Each answer should be clear and concise (3-5 sentences).
            2. Include key points the candidate MUST mention (3-5 bullet points, use • as separator).
            3. Add 1-2 brief practical tips.

            RESPONSE FORMAT — respond with ONLY valid JSON (no markdown):
            {
              "answers": [
                {
                  "id": 1,
                  "answer": "Concise model answer",
                  "keyPoints": "Key points separated by •",
                  "tips": "Brief practical tips"
                }
              ]
            }
            """;

        var requestBody = new
        {
            model = _model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = questionsText }
            },
            temperature = 0.7,
            max_tokens = 4096,
            response_format = new { type = "json_object" }
        };

        var json = JsonSerializer.Serialize(requestBody);
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.openai.com/v1/chat/completions")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        _logger.LogInformation("Generating batch answers for {Count} {Tech} questions", questions.Count, technology);

        var response = await _httpClient.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("OpenAI API error: {Status} — {Body}", response.StatusCode, responseContent);
            throw new HttpRequestException($"AI service returned {(int)response.StatusCode}. Please try again.");
        }

        using var doc = JsonDocument.Parse(responseContent);
        var assistantContent = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(assistantContent))
            throw new InvalidOperationException("AI returned an empty response.");

        using var parsed = JsonDocument.Parse(assistantContent);
        var answersArray = parsed.RootElement.GetProperty("answers");

        var result = new List<QuestionAnswer>();
        foreach (var a in answersArray.EnumerateArray())
        {
            result.Add(new QuestionAnswer
            {
                Id = a.GetProperty("id").GetInt32(),
                Answer = a.GetProperty("answer").GetString() ?? "",
                KeyPoints = a.TryGetProperty("keyPoints", out var kp) ? kp.GetString() : null,
                Tips = a.TryGetProperty("tips", out var tp) ? tp.GetString() : null,
            });
        }

        return result;
    }


}
