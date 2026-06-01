# PrepFinity — AI Interview Platform

> 🌐 **Live at [prepfinity.co](https://prepfinity.co)** — practice technical interviews with an AI interviewer. Voice or text, real-time scoring, weak-topic analytics. Free to start.

A full-stack web application that conducts voice-driven, AI-powered mock technical interviews. Candidates pick a technology and experience level, then talk to an AI interviewer ("Alex") in real time — speech-to-text, GPT-evaluated answers, scoring, weak-topic analytics, and a tiered subscription model with Razorpay payments.

## Read More

- [How to prepare for the TCS technical interview process in 2026](https://prepfinity.co/blog/tcs-technical-interview-process-step-by-step)
- [Top 10 mistakes in AI mock interviews and how to fix them](https://prepfinity.co/blog/top-10-ai-mock-interview-mistakes)
- [All PrepFinity blog posts](https://prepfinity.co/blog)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Subscription Plans](#subscription-plans)
- [Security](#security)
- [Database Schema](#database-schema)

---

## Features

### Interview Engine
- **Live voice interview** with an AI interviewer (Alex) powered by OpenAI GPT-4o-mini.
- **Real-time speech-to-text** via Deepgram Nova-2 (with browser Web Speech API fallback).
- **Text-to-speech** for AI responses (Web Speech Synthesis API).
- **Per-question scoring** (1–10) with feedback, plus an end-of-interview overall score, strengths, and improvement areas.
- **Topic variety guard** — the prompt explicitly avoids repeating opening topics the candidate has already seen across past sessions.
- **Weak-topic focus mode** — candidates can target practice sessions at topics where they previously underperformed.
- **Configurable interview length** (number of questions) and **experience level** (Junior / Mid / Senior).

### Question Bank
- AI-generated practice questions for any technology / sub-topic.
- Batch-generated model answers with key points and tips.

### Progress & Analytics
- Full interview history with scores, strengths, improvements, and message-by-message replay.
- Weak-topic detection: aggregates per-topic average scores across completed sessions and surfaces the lowest.
- Monthly usage tracking enforced against the user's plan limit.

### Authentication & Accounts
- Email/password registration and login.
- JWT access tokens delivered via **HttpOnly cookies** (not in `localStorage`).
- Refresh-token rotation, account lockout on repeated failed logins.
- BCrypt password hashing.
- CSRF protection middleware.

### Payments & Subscriptions
- Four tiers: Free, Starter, Pro, Unlimited.
- **Razorpay** order creation and signature-verified payment confirmation (HMAC SHA256).
- 30-day billing cycle; expired paid plans auto-revert to Free.

---

## Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────┐
│  React 18 + Vite (client)    │ ◄──────►│  ASP.NET Core 10 Web API     │
│  - React Router 7            │  HTTPS  │  - Controllers + Services    │
│  - Axios (withCredentials)   │ Cookies │  - EF Core (SQLite)          │
│  - Deepgram WebSocket STT    │         │  - JWT auth via cookies      │
│  - Web Speech Synthesis      │         │  - Rate limiting + CSRF      │
└──────────────────────────────┘         └────────────┬─────────────────┘
                                                      │
                                ┌─────────────────────┼─────────────────────┐
                                ▼                     ▼                     ▼
                          ┌──────────┐         ┌─────────────┐       ┌──────────┐
                          │  OpenAI  │         │  Deepgram   │       │ Razorpay │
                          │ GPT-4o-  │         │   Nova-2    │       │  Orders  │
                          │   mini   │         │     STT     │       │   API    │
                          └──────────┘         └─────────────┘       └──────────┘
```

The interview loop is server-orchestrated:

1. Client POSTs `start` → server builds a system prompt (with variety + focus-mode instructions) → OpenAI returns the first question as JSON.
2. Candidate speaks → Deepgram (or browser) transcribes → client POSTs `answer`.
3. Server replays full conversation to OpenAI → gets `{ score, feedback, nextQuestion }` → persists both messages.
4. On the final answer, the AI returns `isComplete: true` with overall score, strengths, and improvements.

---

## Tech Stack

### Backend — [InterviewPlatform.API](InterviewPlatform.API/)
| Layer | Technology |
|---|---|
| Runtime | .NET 10 (ASP.NET Core Web API) |
| Language | C# (nullable + implicit usings) |
| ORM | Entity Framework Core 10 |
| Database | SQLite |
| Auth | `Microsoft.AspNetCore.Authentication.JwtBearer` + HttpOnly cookies |
| Password hashing | `BCrypt.Net-Next` |
| Rate limiting | Built-in `Microsoft.AspNetCore.RateLimiting` (fixed window) |
| API docs | `Microsoft.AspNetCore.OpenApi` |
| AI | OpenAI Chat Completions API (`gpt-4o-mini`) |
| STT | Deepgram Nova-2 (key proxied through `/api/speech/token`) |
| Payments | Razorpay REST API |

### Frontend — [client/](client/)
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite 5 |
| Language | TypeScript 5.6 |
| Routing | React Router DOM 7 |
| HTTP | Axios (`withCredentials: true`) |
| Analytics | Firebase Analytics |
| Speech in | Deepgram WebSocket + Web Speech API fallback |
| Speech out | Web Speech Synthesis API |
| Linting | ESLint 9 + `typescript-eslint` |

---

## Project Structure

```
AI-Interview-Platform/
├── InterviewPlatform.API/             # ASP.NET Core backend
│   ├── Controllers/
│   │   ├── AuthController.cs          # register, login, refresh, logout, profile
│   │   ├── CsrfController.cs          # CSRF token issuance
│   │   ├── InterviewController.cs     # start, answer, history, detail, weak-topics, abandon, usage
│   │   ├── PaymentController.cs       # create-order, verify, plan
│   │   ├── PricingController.cs       # public plans + cost breakdown
│   │   ├── ProgressController.cs      # progress analytics
│   │   ├── QuestionBankController.cs  # AI-generated questions + answers
│   │   └── SpeechController.cs        # Deepgram key handoff
│   ├── Data/AppDbContext.cs           # EF Core DbContext
│   ├── Middleware/
│   │   ├── CsrfMiddleware.cs
│   │   ├── GlobalExceptionMiddleware.cs
│   │   └── SecurityHeadersMiddleware.cs
│   ├── Models/
│   │   ├── DTOs/                      # AuthDTOs, InterviewDTOs, PaymentDTOs
│   │   ├── User.cs, RefreshToken.cs
│   │   ├── InterviewSession.cs, InterviewMessage.cs
│   │   └── Payment.cs
│   ├── Services/
│   │   ├── AuthService.cs             # registration, login, JWT issuance, refresh rotation
│   │   ├── AIService.cs               # OpenAI integration (interview + question bank prompts)
│   │   ├── InterviewService.cs        # orchestration: sessions, scoring, weak-topics
│   │   └── PaymentService.cs          # Razorpay order create + signature verify
│   ├── Program.cs                     # DI, middleware pipeline, DB bootstrap
│   ├── appsettings.json               # local config (gitignored secrets)
│   └── appsettings.Template.json      # config template
│
└── client/                            # React frontend
    └── src/
        ├── pages/
        │   ├── LoginPage.tsx / RegisterPage.tsx
        │   ├── DashboardPage.tsx
        │   ├── InterviewSetupPage.tsx       # tech, level, # questions, focus topics
        │   ├── InterviewRoomPage.tsx        # live voice interview UI
        │   ├── InterviewResultPage.tsx
        │   ├── QuestionBankPage.tsx
        │   ├── MyProgressPage.tsx
        │   └── PricingPage.tsx
        ├── services/                        # axios wrappers per domain
        ├── contexts/AuthContext.tsx
        ├── components/ProtectedRoute, GuestRoute
        ├── types/                           # auth.ts, interview.ts, speech.d.ts
        ├── firebase.ts                      # Firebase Analytics init
        └── App.tsx                          # routes
```

---

## Getting Started

### Prerequisites
- .NET 10 SDK
- Node.js 18+ and npm
- Accounts/API keys for: OpenAI, Deepgram (optional, falls back to browser), Razorpay (optional for free-tier-only use)

### Backend
```bash
cd InterviewPlatform.API
cp appsettings.Template.json appsettings.json     # then fill in secrets (see Configuration)
dotnet restore
dotnet run
```
The API starts on `http://localhost:5000` (or whatever `launchSettings.json` defines). SQLite DB and tables are created automatically on first run via `EnsureCreated` + idempotent `ALTER TABLE` statements in [Program.cs:120-160](InterviewPlatform.API/Program.cs#L120-L160).

### Frontend
```bash
cd client
npm install
npm run dev
```
The dev server runs on `http://localhost:5173` and is whitelisted in the API's CORS policy.

---

## Configuration

All backend secrets live in `InterviewPlatform.API/appsettings.json` (gitignored) or environment variables. See [appsettings.Template.json](InterviewPlatform.API/appsettings.Template.json):

```jsonc
{
  "ConnectionStrings": {
    "DefaultConnection": "Data Source=interview_platform.db"
  },
  "Jwt": {
    "Secret": "<at least 32 chars>",       // or JWT_SECRET env var
    "Issuer": "InterviewPlatform",
    "Audience": "InterviewPlatformUsers",
    "ExpirationInMinutes": "15"
  },
  "Cors": {
    "AllowedOrigins": [ "http://localhost:5173" ]
  },
  "OpenAI": {
    "ApiKey": "<openai key>",              // or OPENAI_API_KEY env var
    "Model": "gpt-4o-mini"
  },
  "Deepgram": {
    "ApiKey": "<deepgram key>"             // or DEEPGRAM_API_KEY env var
  },
  "Razorpay": {
    "KeyId": "<razorpay key id>",
    "KeySecret": "<razorpay key secret>"
  }
}
```

Frontend Firebase config lives in [client/src/firebase.ts](client/src/firebase.ts).

---

## API Reference

All endpoints are prefixed with `/api`. Auth is via the `access_token` HttpOnly cookie set by `POST /auth/login`.

### Auth — [AuthController](InterviewPlatform.API/Controllers/AuthController.cs)
| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register` | Rate-limited (`auth`: 10/min/IP). No auto-login. |
| POST | `/auth/login` | Sets `access_token` + `refresh_token` cookies. |
| POST | `/auth/refresh` | Rotates both tokens from the refresh cookie. |
| POST | `/auth/logout` | Revokes all user refresh tokens. |
| GET  | `/auth/profile` | Returns the current user's profile. |

### Interview — [InterviewController](InterviewPlatform.API/Controllers/InterviewController.cs)
| Method | Route | Purpose |
|---|---|---|
| POST | `/interview/start` | Start a session; returns first AI question. Enforces monthly limit. |
| POST | `/interview/{id}/answer` | Submit answer, get score + next question (or final summary). |
| POST | `/interview/{id}/abandon` | Mark an in-progress session abandoned. |
| GET  | `/interview/history` | List the user's past sessions. |
| GET  | `/interview/{id}` | Full transcript + scores for a session. |
| GET  | `/interview/weak-topics?technology=React` | Topics where avg score < 6. |
| GET  | `/interview/usage` | Current month interview count + plan limit. |

### Speech, Question Bank, Progress, Payments, Pricing
- `GET  /speech/token` — returns the Deepgram key for authenticated users.
- `POST /questionbank/generate` — AI-generates practice questions.
- `POST /questionbank/answers` — Batch model answers for given questions.
- `GET  /progress/...` — analytics endpoints.
- `POST /payment/create-order` — creates a Razorpay order for a plan.
- `POST /payment/verify` — verifies signature and upgrades the user's plan.
- `GET  /payment/plan` — current plan + expiry.
- `GET  /pricing/plans` — public plan list and cost breakdown.

---

## Subscription Plans

Defined in [PricingController.cs](InterviewPlatform.API/Controllers/PricingController.cs) and enforced in [InterviewService.GetMonthlyUsageAsync](InterviewPlatform.API/Services/InterviewService.cs#L325):

| Plan | Price (₹/mo) | Interviews/mo | Notes |
|---|---|---|---|
| Free | 0 | 3 | Basic scoring + progress |
| Starter | 199 | 10 | Adds weak-topic practice + full analytics |
| Pro | 499 | 30 | Priority responses + question bank access |
| Unlimited | 999 | ∞ | Everything, plus email support |

Per-interview cost basis (10-question session): ₹1.00 OpenAI + ₹2.90 Deepgram + ₹0.60 infra ≈ ₹4.50.

---

## Security

The middleware pipeline ([Program.cs:162-181](InterviewPlatform.API/Program.cs#L162-L181)) layers:

1. **Global exception handling** — uniform error envelope, no stack-trace leaks.
2. **Security headers** — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP, etc.
3. **CORS** — whitelist from `Cors:AllowedOrigins`, credentials allowed for cookie auth.
4. **Rate limiting** — fixed-window: `auth` (10/min/IP), `api` (60/min/IP). 429 with JSON body on reject.
5. **CSRF** — token issued by `CsrfController`, validated by `CsrfMiddleware` on state-changing requests.
6. **JWT auth** — token read from `access_token` cookie (not `Authorization` header), so XSS cannot exfiltrate it.

Other safeguards:
- BCrypt password hashing with per-user salt.
- Refresh-token rotation + revocation on logout.
- Account lockout after repeated failed logins.
- Razorpay payment signature verification with constant-time comparison (`CryptographicOperations.FixedTimeEquals`).
- `SameSite=Strict` cookies, `Secure` flag in production, `Path=/api/auth` on the refresh cookie so it isn't sent to other endpoints.

---

## Database Schema

SQLite, managed by EF Core in [AppDbContext.cs](InterviewPlatform.API/Data/AppDbContext.cs):

- **Users** — `Email` (unique), `FullName`, `PasswordHash`, `Plan`, `PlanExpiresAt`, `RazorpayCustomerId`, lockout fields.
- **RefreshTokens** — `Token` (unique), `UserId`, expiry, revoke state.
- **InterviewSessions** — `UserId`, `Technology`, `ExperienceLevel`, `TotalQuestions`, `CurrentQuestionNumber`, `Status`, `OverallScore`, `OverallFeedback`, `Strengths` (JSON), `Improvements` (JSON), `FocusTopics` (JSON), timestamps.
- **InterviewMessages** — `SessionId`, `Role` (`interviewer` / `candidate`), `Content`, `Score`, `Feedback`, `QuestionTopic`, `QuestionNumber`, `CreatedAt`.
- **Payments** — `UserId`, `RazorpayOrderId` (unique), `RazorpayPaymentId`, `RazorpaySignature`, `PlanId`, `AmountInPaise`, `Status`, timestamps.

Foreign keys cascade on user deletion. Schema migrations beyond the initial `EnsureCreated` are handled by idempotent `ALTER TABLE` statements at startup so existing dev DBs upgrade in place.

---

## Recent Highlights

- Deepgram Nova-2 STT integrated with browser fallback; transcript de-duplication fixed.
- Question-variety guard added to the system prompt — past opening topics are passed in to prevent repeats.
- Weak-topic practice mode: focus topics persist on the session and shape every prompt in the interview.
- Razorpay payments + tiered subscription enforcement wired through the interview start flow.

Deploy steps
A. Railway (API + Postgres + Redis)
Create the project. Go to https://railway.app → New Project → Deploy from GitHub repo. Pick your repo. Railway will detect railway.json and build the Dockerfile at InterviewPlatform.API/Dockerfile.

Add Postgres. In the project canvas → New → Database → Add Postgres. It auto-creates DATABASE_URL (Railway's format) and PG* vars.

Add Redis. New → Database → Add Redis. Auto-creates REDIS_URL.

Set environment variables on your API service (Variables tab). Use double-underscore for nested .NET keys:


ASPNETCORE_ENVIRONMENT=Production
PORT=8080
ConnectionStrings__DefaultConnection=Host=${{Postgres.PGHOST}};Port=${{Postgres.PGPORT}};Database=${{Postgres.PGDATABASE}};Username=${{Postgres.PGUSER}};Password=${{Postgres.PGPASSWORD}};SSL Mode=Require;Trust Server Certificate=true
ConnectionStrings__Redis=${{Redis.REDIS_URL}}
Jwt__Secret=<generate 64+ random chars, e.g. openssl rand -base64 48>
Jwt__Issuer=InterviewPlatform
Jwt__Audience=InterviewPlatformUsers
Jwt__ExpirationInMinutes=15
OpenAI__ApiKey=<your existing key>
OpenAI__InterviewModel=gpt-4o
OpenAI__BulkModel=gpt-4o-mini
OpenAI__RealtimeModel=gpt-realtime
Razorpay__KeyId=<your_razorpay_key_id>
Razorpay__KeySecret=<your_razorpay_key_secret>
Razorpay__WebhookSecret=<your_razorpay_webhook_secret>
# Get test keys from https://dashboard.razorpay.com/app/website-app-settings/api-keys
# Webhook secret is set when you register a webhook at https://dashboard.razorpay.com/app/webhooks
Cookies__CrossSite=true
Cors__AllowedOrigins__0=https://<your-vercel-domain>.vercel.app
The ${{Postgres.PGHOST}} syntax is Railway's variable referencing — Railway substitutes them at deploy time. Note SSL Mode=Require — Railway Postgres requires TLS.

Deploy — Railway will build and run. Once it's healthy, click Settings → Networking → Generate Domain for the API service to get https://<something>.up.railway.app.

Run the EF migration. First deploy will hit the Database.Migrate() call in Program.cs and run pending migrations automatically. Watch the deploy logs. The credit-system backfill in Program.cs:163 also runs there.

B. Vercel (frontend)
Import the repo. https://vercel.com/new → import your GitHub repo.

Configure project settings:

Root Directory: client
Framework: Vite (auto-detected)
Build Command: npm run build (default)
Output Directory: dist (default)
Environment variables (Project Settings → Environment Variables):


VITE_API_URL=https://<your-railway-domain>.up.railway.app
(Skip VITE_POSTHOG_KEY unless you want analytics.)

Deploy. Vercel will give you https://<project>.vercel.app.

C. Wire the two together
Go back to Railway, edit Cors__AllowedOrigins__0 so it matches your actual Vercel URL (including https:// and no trailing slash). Redeploy if the value changed.

Update the Razorpay webhook URL. In your Razorpay dashboard, edit the webhook you created earlier — change the URL from your ngrok URL to:


https://<your-railway-domain>.up.railway.app/api/payment/webhook
Keep the same webhook secret (already in env vars).

D. Smoke test
Open the Vercel URL → register a new account (post-register resume step shows up).
Dashboard shows 2 Basic + 1 Premium credit.
Try Basic interview — should complete and show results.
Visit /pricing → buy Starter Pack with test card 4111 1111 1111 1111 → credits update.
Check Railway logs for Razorpay webhook credited user X via order ... after a few seconds.
Things to watch out for
First deploy is slow — Railway compiles the .NET image fresh (~3-5 min). Subsequent deploys reuse the restore layer.
The free Railway plan has $5/month credit — fine for testing but the API + Postgres + Redis services will eat through it in ~10 days of continuous uptime. Use Railway's sleep-on-idle setting or pause the project when not testing.
appsettings.json is gitignored, so Railway sees only the env vars. Don't be surprised if local dev still works (reading from appsettings.json) while Railway depends entirely on env vars.
CORS errors in the browser console after deploy almost always mean the Cors__AllowedOrigins__0 value doesn't exactly match the request Origin. Check protocol (https://) and trailing slashes.
Want me to also push these files to a deploy branch, or are you good to take it from here?

Host=postgresql://postgres:tqWIgRsxZDgDzlvlLBACwLMzNGypaiSj@postgres.railway.internal:5432/railway;Port=5432;Database=railway;Username=postgres;Password=tqWIgRsxZDgDzlvlLBACwLMzNGypaiSj;SSL Mode=Require;Trust Server Certificate=true