using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace InterviewPlatform.API.Middleware;

/// <summary>
/// Validates an HMAC-signed CSRF token on state-changing requests (POST, PUT, DELETE, PATCH).
///
/// Why HMAC instead of the classic cookie-vs-header double-submit pattern: in cross-site
/// deployments (frontend on Vercel, API on Railway) the CSRF cookie is set on the API origin
/// but JS runs on the frontend origin. On mobile Safari + Chrome Android private mode,
/// Intelligent Tracking Prevention silently drops third-party cookies between navigations,
/// breaking the double-submit comparison and causing 403s on every POST.
///
/// The HMAC scheme is cookie-free: the server signs <userId>|<nonce>|<expiry> with the JWT
/// secret and hands the token to the client. The client replays it in X-XSRF-TOKEN on every
/// state-changing request. The middleware re-derives the HMAC and verifies it matches the
/// claimed userId. An attacker on a different origin can't forge a token without the secret,
/// so CSRF is still prevented.
/// </summary>
public class CsrfMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _config;
    private const string CsrfHeaderName = "X-XSRF-TOKEN";
    private const string CsrfCookieName = "XSRF-TOKEN"; // legacy double-submit fallback

    // Paths that are exempt from CSRF: public auth endpoints (no user context yet) and the
    // server-to-server payment webhook (authenticated via Razorpay's own signature header).
    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/auth/login",
        "/api/auth/register",
        "/api/auth/refresh",
        "/api/payment/webhook",
    };

    public CsrfMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _config = config;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var method = context.Request.Method;

        if (method is "POST" or "PUT" or "DELETE" or "PATCH")
        {
            var path = context.Request.Path.Value ?? "";

            if (!ExemptPaths.Contains(path))
            {
                var headerToken = context.Request.Headers[CsrfHeaderName].FirstOrDefault();
                var cookieToken = context.Request.Cookies[CsrfCookieName];
                var userId = context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (!IsValid(headerToken, cookieToken, userId, _config))
                {
                    context.Response.StatusCode = 403;
                    await context.Response.WriteAsJsonAsync(new { success = false, message = "Invalid CSRF token." });
                    return;
                }
            }
        }

        await _next(context);
    }

    /// <summary>
    /// Accept either a valid HMAC-signed token (new path, works cross-site) or a matching
    /// cookie+header pair (legacy double-submit, still works for same-site deployments and
    /// users with old tokens issued before this change).
    /// </summary>
    private static bool IsValid(string? headerToken, string? cookieToken, string? userId, IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(headerToken)) return false;

        // Path 1: signed HMAC token. Format: base64url(userId.expiryUnix.nonce).base64url(hmac).
        var secret = config["Jwt:Secret"];
        if (!string.IsNullOrWhiteSpace(secret) && headerToken.Contains('.'))
        {
            if (TryVerifySignedToken(headerToken, secret, out var tokenUserId, out var expiryUnix))
            {
                // Token's claimed user must match the authenticated user (if any). Anonymous
                // POSTs don't reach here for protected controllers — they 401 first — so this
                // mostly matters for the small handful of [AllowAnonymous] POSTs we have.
                if (!string.IsNullOrEmpty(userId) && tokenUserId != userId) return false;

                // Expiry check
                if (DateTimeOffset.FromUnixTimeSeconds(expiryUnix) < DateTimeOffset.UtcNow) return false;

                return true;
            }
        }

        // Path 2: legacy double-submit cookie comparison. Kept for backwards compatibility
        // with tokens issued by the previous CsrfController response — same-site deployments
        // hit this path because their cookies arrive reliably.
        if (!string.IsNullOrWhiteSpace(cookieToken) &&
            string.Equals(cookieToken, headerToken, StringComparison.Ordinal))
        {
            return true;
        }

        return false;
    }

    /// <summary>
    /// Token format: "<payload>.<signature>" where payload is base64url("<userId>|<expiry>|<nonce>")
    /// and signature is base64url(HMAC-SHA256(payload, secret)).
    /// </summary>
    public static string IssueSignedToken(string userId, string secret, TimeSpan lifetime)
    {
        var expiry = DateTimeOffset.UtcNow.Add(lifetime).ToUnixTimeSeconds();
        var nonce = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
        var raw = $"{userId}|{expiry}|{nonce}";
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(raw));
        var sig = Base64UrlEncode(ComputeHmac(payload, secret));
        return $"{payload}.{sig}";
    }

    private static bool TryVerifySignedToken(string token, string secret, out string userId, out long expiryUnix)
    {
        userId = string.Empty;
        expiryUnix = 0;
        var dot = token.IndexOf('.');
        if (dot <= 0 || dot >= token.Length - 1) return false;

        var payload = token[..dot];
        var sig = token[(dot + 1)..];

        // Verify signature in constant time.
        var expected = Base64UrlEncode(ComputeHmac(payload, secret));
        if (!CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(sig)))
        {
            return false;
        }

        try
        {
            var decoded = Encoding.UTF8.GetString(Base64UrlDecode(payload));
            var parts = decoded.Split('|');
            if (parts.Length != 3) return false;
            userId = parts[0];
            if (!long.TryParse(parts[1], out expiryUnix)) return false;
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static byte[] ComputeHmac(string data, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string s)
    {
        var padded = s.Replace('-', '+').Replace('_', '/');
        padded = padded.PadRight(padded.Length + (4 - padded.Length % 4) % 4, '=');
        return Convert.FromBase64String(padded);
    }
}
