using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;
using InterviewPlatform.API.Data;
using InterviewPlatform.API.Middleware;
using InterviewPlatform.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database (PostgreSQL) ----------
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ---------- Redis (caching + rate-limit backing) ----------
var redisConnection = builder.Configuration.GetConnectionString("Redis");
var redisEnabled = !string.IsNullOrWhiteSpace(redisConnection);
if (redisEnabled)
{
    builder.Services.AddStackExchangeRedisCache(options =>
    {
        options.Configuration = redisConnection;
        options.InstanceName = "interview:";
    });
    builder.Services.AddSingleton<IConnectionMultiplexer>(
        _ => ConnectionMultiplexer.Connect(redisConnection!));
    builder.Services.AddSingleton<ICacheService, RedisCacheService>();
}
else
{
    builder.Services.AddSingleton<ICacheService, NullCacheService>();
}

// ---------- Authentication (JWT via HttpOnly Cookie) ----------
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? throw new InvalidOperationException("JWT Secret not configured. Set Jwt:Secret in config or JWT_SECRET env var.");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ClockSkew = TimeSpan.Zero
    };

    // Read JWT from HttpOnly cookie instead of Authorization header
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Cookies["access_token"];
            if (!string.IsNullOrEmpty(accessToken))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// ---------- Rate Limiting ----------
// When Redis is configured we use a distributed sliding-window limiter (survives multi-instance deploys).
// Otherwise we fall back to the in-memory fixed-window limiter.
builder.Services.AddRateLimiter(options =>
{
    RateLimitPartition<string> BuildPartition(HttpContext context, string policyName, int limit, TimeSpan window, int queueLimit)
    {
        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        if (redisEnabled)
        {
            return RateLimitPartition.Get(key, _ =>
            {
                var mux = context.RequestServices.GetRequiredService<IConnectionMultiplexer>();
                return new RedisSlidingWindowLimiter(
                    mux.GetDatabase(),
                    $"ratelimit:{policyName}:{key}",
                    limit,
                    window);
            });
        }

        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = limit,
            Window = window,
            QueueLimit = queueLimit
        });
    }

    options.AddPolicy("auth", context => BuildPartition(context, "auth", 10, TimeSpan.FromMinutes(1), 0));
    options.AddPolicy("api",  context => BuildPartition(context, "api",  60, TimeSpan.FromMinutes(1), 2));

    // Realtime session creation — tight cap to prevent ephemeral-key farming.
    options.AddPolicy("realtime", context => BuildPartition(context, "realtime", 5, TimeSpan.FromHours(1), 0));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { success = false, message = "Too many requests. Please slow down and try again." },
            cancellationToken);
    };
});

// ---------- Services ----------
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddSingleton<IAIService, AIService>();
builder.Services.AddScoped<IInterviewService, InterviewService>();
builder.Services.AddScoped<IPaymentService, PaymentService>();
builder.Services.AddScoped<IRealtimeSessionService, RealtimeSessionService>();
builder.Services.AddScoped<IResumeService, ResumeService>();
builder.Services.AddScoped<IOnboardingService, OnboardingService>();
builder.Services.AddHttpClient("Razorpay");
builder.Services.AddHttpClient("OpenAIRealtime", c => c.Timeout = TimeSpan.FromSeconds(15));

// ---------- CORS ----------
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:5173" };
        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for cookies
    });
});

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// ---------- Apply EF Core migrations on startup ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Credit-system backfill: grant 2 basic + 1 premium to any user still on the legacy 0/0 state.
    // Safe to re-run — the WHERE clause guarantees idempotency.
    db.Database.ExecuteSqlRaw(
        "UPDATE \"Users\" SET \"BasicCreditsBalance\" = 2, \"PremiumCreditsBalance\" = 1 " +
        "WHERE \"BasicCreditsBalance\" = 0 AND \"PremiumCreditsBalance\" = 0");
}

// ---------- Middleware Pipeline (order matters!) ----------

// 1. Global exception handler (outermost)
app.UseMiddleware<GlobalExceptionMiddleware>();

// 2. Security headers
app.UseMiddleware<SecurityHeadersMiddleware>();

// 3. CORS
app.UseCors("Frontend");

// 4. Rate limiting
app.UseRateLimiter();

// 5. CSRF validation
app.UseMiddleware<CsrfMiddleware>();

// 6. Auth
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

app.Run();
