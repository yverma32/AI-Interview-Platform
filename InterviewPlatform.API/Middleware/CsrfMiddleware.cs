namespace InterviewPlatform.API.Middleware;

/// <summary>
/// Validates the anti-forgery token on state-changing requests (POST, PUT, DELETE, PATCH)
/// when using cookie-based authentication. GET/HEAD/OPTIONS are skipped.
/// </summary>
public class CsrfMiddleware
{
    private readonly RequestDelegate _next;
    private const string CsrfCookieName = "XSRF-TOKEN";
    private const string CsrfHeaderName = "X-XSRF-TOKEN";

    // Paths that are exempt from CSRF (public auth endpoints that don't need cookies yet)
    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh"   // Refresh uses HttpOnly+SameSite cookie — no extra CSRF needed
    };

    public CsrfMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;

        // Only validate on state-changing methods
        if (method is "POST" or "PUT" or "DELETE" or "PATCH")
        {
            var path = context.Request.Path.Value ?? "";

            if (!ExemptPaths.Contains(path))
            {
                var cookieToken = context.Request.Cookies[CsrfCookieName];
                var headerToken = context.Request.Headers[CsrfHeaderName].FirstOrDefault();

                if (string.IsNullOrEmpty(cookieToken) || string.IsNullOrEmpty(headerToken) || cookieToken != headerToken)
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(new { success = false, message = "Invalid CSRF token." });
                    return;
                }
            }
        }

        await _next(context);
    }
}
