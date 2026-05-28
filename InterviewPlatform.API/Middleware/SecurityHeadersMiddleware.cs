namespace InterviewPlatform.API.Middleware;

/// <summary>
/// Adds production security headers to every response.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Prevent MIME-type sniffing
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        // Prevent clickjacking
        context.Response.Headers["X-Frame-Options"] = "DENY";
        // XSS filter (legacy browsers)
        context.Response.Headers["X-XSS-Protection"] = "1; mode=block";
        // Referrer policy
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        // Permissions policy — disallow camera/geolocation; microphone omitted so the
        // browser doesn't inherit a deny rule that could block mic access on the frontend
        // when proxied or same-origin (iOS Safari is particularly strict about this).
        context.Response.Headers["Permissions-Policy"] = "camera=(), geolocation=()";
        // Remove server header
        context.Response.Headers.Remove("Server");
        // Content Security Policy (API only)
        context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
        // Strict Transport Security (HTTPS in production)
        context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

        await _next(context);
    }
}
