# InterviewReady — AI Mock Interview Platform

## What this project is

A full-stack AI-powered mock interview platform. Users pick a round type, technology, experience level, and company track, then do a voice (WebRTC) or text interview with an AI persona. The AI scores answers in real-time, tracks weak topics, and gives a final report.

Live URLs:
- Frontend: Vercel (`prepfinity.vercel.app`)
- Backend: Railway (`*.up.railway.app`) — deployed via Dockerfile in repo root

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router v6, TanStack Query, Axios, Zustand |
| Backend | .NET 10 (ASP.NET Core), C#, Entity Framework Core |
| Database | PostgreSQL (Railway-hosted) |
| Cache / Rate limiting | Redis (Railway-hosted, optional — falls back to in-memory) |
| Auth | JWT (HttpOnly cookie primary + `Authorization: Bearer` header fallback for iOS) |
| Payments | Razorpay (INR) |
| AI — text interviews | OpenAI GPT-4o via HTTP |
| AI — voice interviews | OpenAI Realtime API (WebRTC, client connects directly to OpenAI) |
| Analytics | PostHog |
| Styling | Plain CSS with design tokens — cyberpunk/neon aesthetic |

---

## Repo layout

```
/
├── InterviewPlatform.API/        # .NET 10 backend
│   ├── Controllers/              # AuthController, InterviewController, RealtimeController,
│   │                             #   PaymentController, CsrfController, QuestionBankController,
│   │                             #   ResumeController, OnboardingController, ProgressController,
│   │                             #   PricingController
│   ├── Services/                 # Business logic (Auth, Interview, AI, Payment, Realtime, etc.)
│   ├── Middleware/               # CsrfMiddleware, SecurityHeadersMiddleware,
│   │                             #   GlobalExceptionMiddleware, RedisSlidingWindowLimiter
│   ├── Models/                   # EF Core entities + DTOs
│   ├── Data/                     # AppDbContext, CreditPacks (static catalog), CompanyTracks
│   ├── Migrations/               # EF Core migrations
│   ├── Program.cs                # App bootstrap — DB, Redis, JWT, CORS, rate limiting, middleware
│   ├── appsettings.json          # Local dev config (has real keys — do not commit changes)
│   └── Dockerfile                # Multi-stage .NET build; sets COOKIES__CROSSSITE=true
│
└── client/                       # Vite + React frontend
    ├── src/
    │   ├── pages/                # One file per route (PageName.tsx + PageName.css co-located)
    │   ├── components/           # Shared components
    │   ├── services/             # API call wrappers (api.ts, authService.ts, etc.)
    │   ├── contexts/             # AuthContext, ThemeContext
    │   ├── hooks/                # useRealtimeSession, useInterviewHistory, useWeakTopics, etc.
    │   ├── store/                # interviewStore (Zustand)
    │   ├── types/                # TypeScript interfaces
    │   └── styles/               # globals.css (layout + utility classes), tokens.css (CSS vars)
    ├── index.html
    ├── vite.config.ts
    └── vercel.json               # SPA rewrite rule; no headers config (CSP is on the API only)
```

---

## Auth flow

This is cross-site (Vercel ↔ Railway), which makes auth non-trivial. Know this before touching anything auth-related:

1. **Login** → server sets `access_token` + `refresh_token` as `HttpOnly; SameSite=None; Secure` cookies AND returns both tokens in the response body (`data.accessToken`, `data.refreshToken`).
2. **Client** stores both tokens in `localStorage` (`interview_access_token`, `interview_refresh_token`).
3. **Every API request** — axios request interceptor in `client/src/services/api.ts` reads `localStorage` and injects `Authorization: Bearer <token>`.
4. **CSRF** — server issues HMAC-signed tokens (not cookie-based double-submit) because iOS Safari ITP blocks cross-site cookies. The CSRF token fetch (`GET /api/csrf/token`) also sends the Bearer header so the server issues a user-bound signed token (not an anonymous one).
5. **401 handling** — axios response interceptor calls `/api/auth/refresh` with `X-Refresh-Token` header + cookie. On success, stores rotated tokens and retries the original request.
6. **iOS Safari specifically**: ITP blocks all cross-site cookies. The Bearer header fallback is the reason anything works on iOS at all. Never remove it.

Key files:
- `client/src/services/api.ts` — axios instance, interceptors, token storage helpers
- `client/src/services/authService.ts` — login/register/logout/getProfile
- `client/src/contexts/AuthContext.tsx` — auth state, wraps the whole app
- `InterviewPlatform.API/Controllers/AuthController.cs` — login/refresh/logout endpoints, cookie helpers
- `InterviewPlatform.API/Program.cs` — JWT `OnMessageReceived` (reads cookie then Bearer header)
- `InterviewPlatform.API/Middleware/CsrfMiddleware.cs` — HMAC token validation
- `InterviewPlatform.API/Controllers/CsrfController.cs` — issues CSRF tokens

---

## Interview types

### Text interview (Basic)
- Route: `/interview/basic/:sessionId`
- Credits: 1 Basic credit per session
- Flow: `POST /api/interview/start` → Q&A loop via `POST /api/interview/{id}/answer` → results at `/interview/results/:sessionId`
- Page: `BasicInterviewRoomPage.tsx`

### Voice interview (Realtime / Premium)
- Route: `/interview/realtime`
- Credits: 1 Premium credit per session
- Flow: `POST /api/realtime/session` mints an ephemeral OpenAI key → client opens WebRTC directly to OpenAI (`https://api.openai.com/v1/realtime/calls`) → client forwards tool-call events back to `/api/realtime/session/{id}/score` and `/api/realtime/session/{id}/complete`
- The .NET backend never touches the audio stream
- Page: `RealtimeInterviewRoomPage.tsx`
- `<audio>` element needs `playsInline` for iOS Safari autoplay
- `AudioContext` must call `.resume()` after creation (iOS Safari suspends it)

---

## AI Personas

Five personas in `InterviewPlatform.API/Services/InterviewerPersonas.cs`:

| Persona | Round type | OpenAI voice |
|---|---|---|
| Alex | `dsa` | alloy |
| Priya | `system_design` | echo |
| Rohan | `hr` | shimmer |
| Ananya | `tech` | alloy |
| Vikram | `resume` | echo |

---

## Company tracks

Defined in `InterviewPlatform.API/Data/CompanyTracks.cs`:
- `service` — TCS, Infosys, Wipro (easy-medium DSA, 5 questions)
- `startup` — Razorpay, Swiggy, Zepto (medium DSA, 7 questions)
- `faang` — Google, Microsoft, Amazon (hard DSA + system design)

---

## Credit system

- Signup grants: 2 Basic + 1 Premium credits
- Basic credits = text interviews; Premium credits = voice interviews
- Credit deducted at `POST /api/interview/start` or `POST /api/realtime/session`
- Packs sold via Razorpay — catalog in `InterviewPlatform.API/Data/CreditPacks.cs` (static, no DB migration needed to change prices)
- Founding Member promo: first 50 paying users get double credits on their first purchase. `User.IsFoundingMember` flag gates this. `FoundingMemberModal.tsx` surfaces it post-payment.

---

## Database schema (PostgreSQL via EF Core)

| Table | Key fields |
|---|---|
| `Users` | Id, Email (unique), PasswordHash, Role, ExperienceLevel, PreferredTechnologies, BasicCreditsBalance, PremiumCreditsBalance, IsFoundingMember, RazorpayCustomerId, FailedLoginAttempts, LockoutEnd |
| `RefreshTokens` | Token, UserId (FK), ExpiresAt, IsRevoked |
| `InterviewSessions` | UserId (FK), Mode (Basic/Premium), Status, Technology, RoundType, CompanyTrack, ExperienceLevel |
| `InterviewMessages` | SessionId (FK), Role, Content, QuestionTopic, QuestionNumber, Score, Feedback |
| `Payments` | UserId (FK), RazorpayOrderId (unique), PackId, Amount, Status |
| `UserResumes` | UserId (FK), FileName, Content (text), UploadedAt |
| `UserSkillProfiles` | UserId (FK, unique), WeakTopics (JSON), LastUpdatedAt |

Migrations live in `InterviewPlatform.API/Migrations/`. Run `dotnet ef migrations add <Name>` from inside `InterviewPlatform.API/`.

---

## API routes

All routes prefixed `/api/`:

```
AUTH (rate limited: 10/min/IP)
  POST /auth/login          — CSRF-exempt; returns accessToken + refreshToken in body + cookies
  POST /auth/register       — CSRF-exempt
  POST /auth/refresh        — CSRF-exempt; reads refresh_token cookie OR X-Refresh-Token header
  POST /auth/logout         — [Authorize]
  GET  /auth/profile        — [Authorize]

CSRF
  GET  /csrf/token          — returns signed HMAC token (user-bound if authenticated)

INTERVIEW (rate limited: 60/min/IP)
  POST /interview/start               — [Authorize]; deducts 1 Basic credit
  POST /interview/{id}/answer         — [Authorize]
  GET  /interview/{id}/detail         — [Authorize]
  GET  /interview/history             — [Authorize]
  GET  /interview/{id}/results        — [Authorize]

REALTIME (rate limited: 5/hr/IP — tight to prevent key farming)
  POST /realtime/session              — [Authorize]; deducts 1 Premium credit; mints ephemeral key
  POST /realtime/session/{id}/score   — [Authorize]
  POST /realtime/session/{id}/complete— [Authorize]

RESUME
  POST /resume/upload         — [Authorize]
  GET  /resume/latest         — [Authorize]

ONBOARDING
  POST /onboarding/complete   — [Authorize]
  GET  /onboarding/status     — [Authorize]

PROGRESS
  GET  /progress/summary      — [Authorize]

QUESTION BANK
  POST /questionbank/generate — [Authorize]

PAYMENT
  POST /payment/create-order  — [Authorize]
  POST /payment/verify        — [Authorize]
  POST /payment/webhook       — CSRF-exempt; validated by Razorpay signature

PRICING (public)
  GET  /pricing/packs         — also used as Railway health check endpoint
```

---

## Middleware pipeline order (Program.cs)

1. `GlobalExceptionMiddleware` — catches unhandled exceptions
2. `SecurityHeadersMiddleware` — adds `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy` (camera + geolocation blocked; microphone NOT blocked — needed for voice interviews), HSTS, CSP
3. CORS (`Frontend` policy — reads allowed origins from `Cors:AllowedOrigins` config)
4. Rate limiter
5. `CsrfMiddleware` — validates `X-XSRF-TOKEN` header on POST/PUT/DELETE/PATCH (HMAC path + legacy double-submit fallback)
6. `UseAuthentication` / `UseAuthorization`

---

## Rate limiting

| Policy | Limit |
|---|---|
| `auth` | 10 req/min/IP |
| `api` | 60 req/min/IP |
| `realtime` | 5 req/hr/IP |

When Redis is configured, uses distributed sliding-window (`RedisSlidingWindowLimiter`). Without Redis, falls back to in-memory fixed-window.

---

## Environment variables

### Railway (backend)
```
DATABASE_URL              postgresql://... (or set ConnectionStrings__DefaultConnection)
ConnectionStrings__Redis  redis://...
JWT_SECRET                (min 32 chars)
Jwt__Issuer               InterviewPlatform
Jwt__Audience             InterviewPlatformUsers
Jwt__ExpirationInMinutes  15
Cors__AllowedOrigins__0   https://prepfinity.vercel.app
OpenAI__ApiKey            sk-...
OpenAI__InterviewModel    gpt-4o
OpenAI__BulkModel         gpt-4o-mini
OpenAI__RealtimeModel     gpt-realtime
Razorpay__KeyId           rzp_live_...
Razorpay__KeySecret       ...
Razorpay__WebhookSecret   ...
COOKIES__CROSSSITE        true   ← CRITICAL for iOS Safari; also baked into Dockerfile ENV
```

### Vercel (frontend, build-time)
```
VITE_API_URL          https://your-app.up.railway.app   (no trailing slash, no /api)
VITE_POSTHOG_KEY      (optional)
VITE_POSTHOG_HOST     https://app.posthog.com
```

---

## CSS / styling conventions

- Design tokens in `client/src/styles/tokens.css` — all colors, spacing, radii, shadows as CSS vars
- Utility classes + global resets in `client/src/styles/globals.css`
- Each page has a co-located CSS file (`PageName.css`) imported directly in the `.tsx`
- Neon/cyberpunk aesthetic: `--neon-cyan` (#00f0ff) + `--neon-magenta` (#ff2bd6)
- Glass surfaces: `.glass`, `.glass-elevated`, `.glass-strong` utility classes
- Buttons: `.btn .btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` + size modifiers `.btn-sm`, `.btn-lg`
- Inputs: `.input`, `.textarea`, `.select`
- Full-screen loading: `.loading-screen` + `.spinner` (defined in globals.css, used by ProtectedRoute/GuestRoute)
- Viewport height: always write `min-height: 100vh; min-height: 100dvh` — `dvh` is the iOS Safari fix
- Dark theme is default; light theme via `data-theme="light"` on `<html>`; toggle in `ThemeContext.tsx`

---

## Known iOS Safari gotchas (already fixed)

All these are already implemented — don't revert them:

1. **ITP blocks cross-site cookies** → Bearer header fallback on every request (including CSRF token fetch)
2. **`<audio autoPlay>`** needs `playsInline` or iOS silently blocks playback
3. **`AudioContext`** is created in `suspended` state on iOS → must call `.resume()` after `new AudioContext()`
4. **`Permissions-Policy: microphone=()`** on API responses would block mic — removed
5. **`COOKIES__CROSSSITE=true`** must be set in Railway — also baked into Dockerfile as `ENV`

---

## Local development

```bash
# Backend
cd InterviewPlatform.API
dotnet run
# Runs on http://localhost:5290

# Frontend
cd client
npm install
npm run dev
# Runs on http://localhost:5173
```

Local dev uses `SameSite=Lax` cookies (not cross-site), so Bearer header fallback is not exercised locally. Test iOS auth issues against the deployed environment.

---

## Deployment

- **Backend**: push to `main` → Railway auto-deploys via Dockerfile. EF migrations run automatically on startup.
- **Frontend**: push to `main` → Vercel auto-deploys. No build command needed beyond Vite defaults.
- **DB migrations**: `dotnet ef migrations add <Name>` then push — migrations apply on next Railway deploy.
