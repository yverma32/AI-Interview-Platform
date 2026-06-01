using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace InterviewPlatform.API.Services;

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendOrgWelcomeAsync(string toEmail, string toName, string orgName, string tempPassword)
    {
        var html = BuildWelcomeHtml(toName, orgName, toEmail, tempPassword);
        await SendAsync(toEmail, toName, $"Welcome to PrepFinity — Your {orgName} Interview Portal", html);
    }

    // ---------- Core send ----------

    private async Task SendAsync(string toEmail, string toName, string subject, string htmlBody)
    {
        var smtpHost  = _config["Email:SmtpHost"]  ?? throw new InvalidOperationException("Email:SmtpHost not configured.");
        var smtpPort  = int.Parse(_config["Email:SmtpPort"]  ?? "587");
        var smtpUser  = _config["Email:SmtpUser"]  ?? throw new InvalidOperationException("Email:SmtpUser not configured.");
        var smtpPass  = _config["Email:SmtpPass"]  ?? throw new InvalidOperationException("Email:SmtpPass not configured.");
        var fromEmail = _config["Email:FromEmail"] ?? smtpUser;
        var fromName  = _config["Email:FromName"]  ?? "PrepFinity";

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromEmail));
        message.To.Add(new MailboxAddress(toName, toEmail));
        message.Subject = subject;
        message.Body = new TextPart("html") { Text = htmlBody };

        using var client = new SmtpClient();
        await client.ConnectAsync(smtpHost, smtpPort, SecureSocketOptions.StartTls);
        await client.AuthenticateAsync(smtpUser, smtpPass);
        await client.SendAsync(message);
        await client.DisconnectAsync(true);

        _logger.LogInformation("Email sent to {Email}: {Subject}", toEmail, subject);
    }

    // ---------- HTML template ----------

    private static string BuildWelcomeHtml(string name, string orgName, string email, string tempPassword) => $"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Welcome to PrepFinity</title>
        </head>
        <body style="margin:0;padding:0;background:#050510;font-family:'Segoe UI',system-ui,sans-serif;color:#f0f6ff;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050510;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0"
                       style="background:rgba(255,255,255,0.04);border:1px solid rgba(0,240,255,0.18);
                              border-radius:16px;overflow:hidden;max-width:600px;width:100%;">

                  <!-- Header banner -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#00f0ff22,#b026ff22,#ff2bd622);
                               padding:36px 40px;border-bottom:1px solid rgba(0,240,255,0.15);text-align:center;">
                      <div style="font-size:28px;font-weight:700;letter-spacing:-0.5px;margin-bottom:6px;">
                        <span style="background:linear-gradient(135deg,#00f0ff,#ff2bd6);
                                     -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                                     background-clip:text;">PrepFinity</span>
                      </div>
                      <div style="font-size:13px;color:#8a96ad;letter-spacing:0.12em;text-transform:uppercase;">
                        AI Interview Platform
                      </div>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;">
                      <p style="font-size:18px;font-weight:600;margin:0 0 16px;color:#f0f6ff;">
                        Hello {name},
                      </p>
                      <p style="font-size:15px;line-height:1.7;color:#b8c5d6;margin:0 0 24px;">
                        Your <strong style="color:#f0f6ff;">{orgName}</strong> interview portal has been set up on PrepFinity.
                        You can now create AI-powered interview drives, share invite links with candidates,
                        and download detailed assessment reports.
                      </p>

                      <!-- Credentials box -->
                      <table width="100%" cellpadding="0" cellspacing="0"
                             style="background:rgba(0,240,255,0.06);border:1px solid rgba(0,240,255,0.22);
                                    border-radius:10px;margin-bottom:24px;">
                        <tr>
                          <td style="padding:24px 28px;">
                            <div style="font-size:11px;color:#8a96ad;text-transform:uppercase;
                                        letter-spacing:0.1em;margin-bottom:16px;font-weight:600;">
                              Your Login Credentials
                            </div>
                            <table cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="font-size:13px;color:#8a96ad;padding:4px 0;width:100px;">Email</td>
                                <td style="font-size:14px;color:#00f0ff;font-weight:600;padding:4px 0;
                                           font-family:'Courier New',monospace;">{email}</td>
                              </tr>
                              <tr>
                                <td style="font-size:13px;color:#8a96ad;padding:4px 0;">Password</td>
                                <td style="font-size:14px;color:#ff2bd6;font-weight:600;padding:4px 0;
                                           font-family:'Courier New',monospace;">{tempPassword}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>

                      <!-- Warning -->
                      <table width="100%" cellpadding="0" cellspacing="0"
                             style="background:rgba(255,184,0,0.08);border:1px solid rgba(255,184,0,0.25);
                                    border-radius:8px;margin-bottom:28px;">
                        <tr>
                          <td style="padding:14px 18px;font-size:13px;color:#ffb800;line-height:1.6;">
                            ⚠️ &nbsp;You will be asked to set a new password on your first login.
                            Please do this immediately to secure your account.
                          </td>
                        </tr>
                      </table>

                      <!-- CTA button -->
                      <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                        <tr>
                          <td style="border-radius:8px;background:linear-gradient(135deg,#00f0ff,#b026ff);">
                            <a href="https://prepfinity.co/login"
                               style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                                      color:#050510;text-decoration:none;border-radius:8px;letter-spacing:0.02em;">
                              Log In to PrepFinity →
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="font-size:13px;color:#5a647a;line-height:1.6;margin:0;">
                        If you have any questions, reply to this email or contact us at
                        <a href="mailto:yverma32@gmail.com" style="color:#00f0ff;text-decoration:none;">yverma32@gmail.com</a>.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid rgba(0,240,255,0.10);
                               font-size:12px;color:#5a647a;text-align:center;">
                      © {DateTime.UtcNow.Year} PrepFinity · AI Interview Platform ·
                      <a href="https://prepfinity.co/privacy" style="color:#5a647a;">Privacy Policy</a>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;
}
