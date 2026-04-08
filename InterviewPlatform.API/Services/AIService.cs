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
        List<ChatMessage> conversationHistory,
        List<string>? previousTopics = null,
        List<string>? focusTopics = null)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
            throw new InvalidOperationException(
                "OpenAI API key is not configured. Set OpenAI:ApiKey in appsettings.json or OPENAI_API_KEY environment variable.");

        var systemPrompt = BuildSystemPrompt(technology, experienceLevel, totalQuestions, currentQuestion, previousTopics, focusTopics);

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

    private static string BuildSystemPrompt(string technology, string experienceLevel, int totalQuestions, int currentQuestion, List<string>? previousTopics = null, List<string>? focusTopics = null)
    {
        // Build variety instructions for the first question to avoid repetition across sessions
        var varietyBlock = "";
        if (currentQuestion == 1 && previousTopics != null && previousTopics.Count > 0)
        {
            var topicList = string.Join(", ", previousTopics.Select(t => $"\"{t}\""));
            varietyBlock = $"""

            VARIETY REQUIREMENT (CRITICAL):
            The candidate has taken previous interviews. Their past opening questions covered these topics: {topicList}.
            You MUST start with a DIFFERENT topic that is NOT in that list. Pick a fresh, creative angle on {technology} that hasn't been explored yet.
            """;
        }
        else if (currentQuestion == 1)
        {
            // Even without history, add a randomization seed to prevent deterministic first questions
            var topicSeeds = GetTopicSeeds(technology);
            var random = new Random();
            var seed = topicSeeds[random.Next(topicSeeds.Length)];
            varietyBlock = $"""

            VARIETY REQUIREMENT:
            Start this interview by asking about: {seed}. Make the question specific, practical, and appropriate for {experienceLevel} level.
            """;
        }

        // Build focus mode instructions when the user wants to practice weak areas
        var focusBlock = "";
        if (focusTopics != null && focusTopics.Count > 0)
        {
            var focusList = string.Join(", ", focusTopics.Select(t => $"\"{t}\""));
            focusBlock = $"""

            FOCUS MODE — WEAK AREA PRACTICE:
            This is a targeted practice session. The candidate has identified these as weak areas they want to improve: {focusList}.
            You MUST concentrate your questions on these specific topics. Distribute questions across the listed topics.
            For each topic, dig deeper than a typical interview — ask follow-up questions that test understanding of nuances, edge cases, and real-world application.
            After evaluating each answer, provide more detailed feedback with specific learning points to help the candidate improve in these areas.
            """;
        }

        return $$"""
            You are "Alex", an expert technical interviewer conducting a professional {{experienceLevel}}-level job interview focused on {{technology}}.

            INTERVIEW CONTEXT:
            - Technology: {{technology}}
            - Experience Level: {{experienceLevel}}
            - Total Questions: {{totalQuestions}}
            - Current Question Number: {{currentQuestion}} of {{totalQuestions}}
            {{varietyBlock}}
            {{focusBlock}}

            YOUR BEHAVIOR:
            1. Ask ONE clear, specific technical question at a time appropriate for {{experienceLevel}} level.
            2. Cover diverse aspects of {{technology}}: core concepts, practical scenarios, best practices, problem-solving, architecture, and debugging.
            3. After receiving an answer, briefly evaluate it, then ask the next question.
            4. Be professional, conversational, and encouraging — like a real human interviewer.
            5. Adapt difficulty slightly based on the candidate's performance so far.
            6. Do NOT prefix questions with numbers like "Question 3:" — weave them naturally into conversation.
            7. Keep your spoken message concise (2-4 sentences for the question, 2-3 sentences for feedback).
            8. Throughout the interview, ensure you cover DIFFERENT topics — never repeat a topic area already discussed.

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

    /// <summary>
    /// Returns a pool of diverse topic seeds for a given technology to randomize opening questions.
    /// </summary>
    private static string[] GetTopicSeeds(string technology)
    {
        var techLower = technology.ToLowerInvariant();

        var topicMap = new Dictionary<string, string[]>
        {
            ["react"] = new[] { "component lifecycle and hooks", "state management patterns", "performance optimization and memoization", "routing and navigation", "context API vs Redux", "custom hooks design", "error boundaries", "server-side rendering", "testing strategies", "React concurrent features", "code splitting and lazy loading", "form handling and validation", "ref forwarding and imperative handles", "reconciliation and virtual DOM" },
            ["node.js"] = new[] { "event loop and async patterns", "stream processing", "middleware architecture", "error handling strategies", "clustering and worker threads", "security best practices", "database connection pooling", "REST API design", "authentication and authorization", "logging and monitoring", "package management and versioning", "buffer and binary data", "child processes", "caching strategies" },
            ["python"] = new[] { "decorators and metaclasses", "generators and iterators", "concurrency with asyncio", "memory management and GC", "type hints and protocols", "testing with pytest", "data structures and algorithms", "OOP design patterns", "context managers", "comprehensions and functional style", "package management", "error handling best practices", "web frameworks comparison", "performance profiling" },
            ["angular"] = new[] { "dependency injection", "change detection strategies", "RxJS and observables", "lazy loading modules", "template-driven vs reactive forms", "route guards and resolvers", "component communication patterns", "pipes and directives", "state management with NgRx", "testing components and services", "Angular signals", "standalone components", "interceptors and middleware", "zone.js and change detection" },
            ["sql"] = new[] { "query optimization and execution plans", "indexing strategies", "window functions", "transaction isolation levels", "normalization and denormalization", "stored procedures vs inline SQL", "common table expressions (CTEs)", "joins and subquery optimization", "deadlock prevention", "partitioning strategies", "temporal tables", "JSON data handling", "security and injection prevention", "database design patterns" },
            ["javascript"] = new[] { "closures and scope chain", "prototypal inheritance", "promises and async/await", "event delegation and bubbling", "ES modules vs CommonJS", "WeakMap and WeakSet usage", "proxy and reflect API", "generators and iterators", "memory leaks and debugging", "web workers and concurrency", "design patterns in JS", "error handling patterns", "TypeScript integration", "performance optimization" },
            ["typescript"] = new[] { "generic types and constraints", "utility types and mapped types", "discriminated unions", "type narrowing and guards", "declaration merging", "conditional types", "template literal types", "module augmentation", "strict mode benefits", "infer keyword usage", "decorators and metadata", "branded types", "variance annotations", "satisfies operator" },
            [".net"] = new[] { "dependency injection and IoC", "middleware pipeline", "Entity Framework and LINQ", "async/await patterns", "authentication with Identity", "minimal APIs vs controllers", "background services and hosted services", "configuration and options pattern", "logging and diagnostics", "caching strategies", "SignalR real-time communication", "gRPC services", "health checks and monitoring", "API versioning" },
            ["aws"] = new[] { "Lambda and serverless patterns", "S3 storage classes and lifecycle", "VPC networking and security groups", "IAM policies and roles", "DynamoDB design patterns", "CloudFormation vs CDK", "API Gateway configurations", "SQS vs SNS vs EventBridge", "ECS vs EKS container orchestration", "CloudWatch monitoring and alarms", "cost optimization strategies", "disaster recovery patterns", "Step Functions workflows", "ElastiCache usage patterns" },
            ["docker"] = new[] { "multi-stage builds", "networking modes and DNS", "volume management and persistence", "Docker Compose orchestration", "image optimization and layers", "security scanning and hardening", "health checks and restart policies", "environment variable management", "logging drivers", "resource constraints and limits", "registry management", "build cache optimization", "rootless containers", "Docker init and development workflows" },
            ["system design"] = new[] { "load balancing strategies", "database sharding and replication", "caching layers and invalidation", "message queues and event-driven architecture", "microservices communication patterns", "CAP theorem trade-offs", "rate limiting and throttling", "API gateway design", "data consistency patterns", "CDN and edge computing", "monitoring and observability", "authentication at scale", "search system design", "real-time data pipelines" },
            ["java"] = new[] { "JVM memory model and garbage collection", "concurrency and thread safety", "Stream API and functional programming", "design patterns in practice", "Spring dependency injection", "exception handling best practices", "generics and type erasure", "collections framework internals", "testing with JUnit and Mockito", "microservices with Spring Boot", "reactive programming", "module system (JPMS)", "record types and sealed classes", "virtual threads (Project Loom)" },
        };

        // Try exact match first, then partial match
        if (topicMap.TryGetValue(techLower, out var topics))
            return topics;

        foreach (var kvp in topicMap)
        {
            if (techLower.Contains(kvp.Key) || kvp.Key.Contains(techLower))
                return kvp.Value;
        }

        // Generic fallback for any technology
        return new[]
        {
            "core concepts and fundamentals", "best practices and common pitfalls",
            "performance optimization", "testing strategies", "debugging techniques",
            "architecture and design patterns", "security considerations",
            "real-world problem solving", "advanced features and internals",
            "integration patterns", "error handling approaches", "scalability concerns",
            "code organization and maintainability", "tooling and ecosystem"
        };
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
