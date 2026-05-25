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
// Accept either an Npgsql key=value string or a postgresql:// URI (which is what Railway,
// Heroku, Fly etc. hand out). Also handle the case where the operator pasted the URI inside
// a Host=... key — Npgsql treats that as a literal hostname and fails DNS lookup at runtime.
var rawConnectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? Environment.GetEnvironmentVariable("DATABASE_URL");
var connectionString = NormalizePostgresConnectionString(rawConnectionString);

// One-line startup hint: log the resolved Host so config mistakes surface in the deploy log
// without ever leaking the password. If you see "Host: <empty>" the variable isn't set at all.
if (!string.IsNullOrWhiteSpace(connectionString))
{
    var hostPart = connectionString
        .Split(';', StringSplitOptions.RemoveEmptyEntries)
        .FirstOrDefault(p => p.StartsWith("Host=", StringComparison.OrdinalIgnoreCase));
    Console.WriteLine($"[startup] Postgres Host resolved to: {hostPart ?? "<no Host key found>"}");
}
else
{
    Console.WriteLine("[startup] Postgres connection string is EMPTY — set ConnectionStrings__DefaultConnection or DATABASE_URL.");
}

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));

static string? NormalizePostgresConnectionString(string? input)
{
    if (string.IsNullOrWhiteSpace(input)) return input;

    var trimmed = input.Trim();

    // Case 1: bare URI — postgresql://user:pass@host:port/db
    if (trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return ConvertUri(trimmed);
    }

    // Case 2: key=value form that accidentally has a URI embedded in Host=...
    // (happens when someone pastes the URI into a value template like Host=...;Port=5432).
    // Detect by looking inside the Host= value for the "://" scheme separator.
    var pairs = trimmed.Split(';', StringSplitOptions.RemoveEmptyEntries);
    foreach (var pair in pairs)
    {
        var eq = pair.IndexOf('=');
        if (eq < 0) continue;
        var key = pair[..eq].Trim();
        var value = pair[(eq + 1)..].Trim();
        if (string.Equals(key, "Host", StringComparison.OrdinalIgnoreCase) &&
            (value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
             value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)))
        {
            return ConvertUri(value);
        }
    }

    return trimmed; // assume already valid Npgsql key=value
}

static string ConvertUri(string uriString)
{
    var uri = new Uri(uriString);
    var userInfo = uri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty;
    var database = uri.AbsolutePath.TrimStart('/');
    var port = uri.Port > 0 ? uri.Port : 5432;

    return $"Host={uri.Host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=true";
}

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
