using System.Security.Claims;
using InterviewPlatform.API.Models.DTOs;
using InterviewPlatform.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace InterviewPlatform.API.Controllers;

[ApiController]
[Route("api/payment")]
[Authorize]
[EnableRateLimiting("api")]
public class PaymentController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly IInterviewService _interviewService;

    public PaymentController(IPaymentService paymentService, IInterviewService interviewService)
    {
        _paymentService = paymentService;
        _interviewService = interviewService;
    }

    private int GetUserId() =>
        int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("create-order")]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem();
        try
        {
            var order = await _paymentService.CreateCreditOrderAsync(GetUserId(), request.PackId);
            return Ok(order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("verify")]
    public async Task<IActionResult> VerifyPayment([FromBody] VerifyPaymentRequest request)
    {
        var result = await _paymentService.VerifyAndTopUpCreditsAsync(GetUserId(), request);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    /// <summary>
    /// Razorpay server-to-server webhook. Public (no auth, no CSRF) — authenticated solely via the
    /// X-Razorpay-Signature header which Razorpay computes from the raw body + the WebhookSecret.
    /// This is the safety net: if the client closes its browser before /verify runs, the webhook
    /// still credits the user. Crediting is idempotent — calling /verify after the webhook (or vice
    /// versa) is a no-op.
    /// </summary>
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> RazorpayWebhook()
    {
        Request.EnableBuffering();
        string body;
        using (var reader = new StreamReader(Request.Body, leaveOpen: true))
        {
            body = await reader.ReadToEndAsync();
            Request.Body.Position = 0;
        }

        var signature = Request.Headers["X-Razorpay-Signature"].FirstOrDefault() ?? string.Empty;

        var ok = await _paymentService.HandleWebhookAsync(body, signature);
        // Razorpay retries with backoff on non-2xx — return 200 once we've made up our mind, 400 only
        // when the signature is invalid (so a misconfigured endpoint surfaces in their dashboard).
        return ok ? Ok(new { received = true }) : BadRequest(new { received = false });
    }
}
