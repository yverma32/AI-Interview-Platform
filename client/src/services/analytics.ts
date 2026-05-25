import posthog from 'posthog-js';

/**
 * PostHog wrapper. Init is called once from main.tsx. Every event helper is a no-op until init
 * runs, so callers don't need to guard. We mask all inputs in session recording for privacy.
 */
let initialized = false;

export function initAnalytics() {
  if (initialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    // Allow local dev without analytics — silence warnings to keep DX clean.
    return;
  }
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://app.posthog.com',
    capture_pageview: true,
    autocapture: true,
    session_recording: { maskAllInputs: true },
  });
  initialized = true;
}

function capture(event: string, props?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, props);
}

export const analytics = {
  identify: (userId: string, props?: Record<string, unknown>) => {
    if (!initialized) return;
    posthog.identify(userId, props);
  },

  reset: () => {
    if (!initialized) return;
    posthog.reset();
  },

  interviewStarted: (technology: string, roundType: string, companyTrack?: string) =>
    capture('interview_started', { technology, roundType, companyTrack }),

  interviewCompleted: (score: number | null, durationSeconds: number, questionCount: number) =>
    capture('interview_completed', { score, durationSeconds, questionCount }),

  interviewAbandoned: (reason: string, questionNumber: number) =>
    capture('interview_abandoned', { reason, questionNumber }),

  resumeUploaded: () => capture('resume_uploaded'),

  creditsPurchased: (packId: string, basicCredits: number, premiumCredits: number) =>
    capture('credits_purchased', { packId, basicCredits, premiumCredits }),

  creditsLow: (basicCredits: number, premiumCredits: number) =>
    capture('credits_low', { basicCredits, premiumCredits }),

  creditsExhausted: (mode: 'basic' | 'premium') =>
    capture('credits_exhausted', { mode }),

  interviewModeSelected: (mode: 'basic' | 'premium') =>
    capture('interview_mode_selected', { mode }),

  weakTopicPracticed: (topic: string) =>
    capture('weak_topic_practiced', { topic }),

  realtimeConnectionFailed: (error: string) =>
    capture('realtime_connection_failed', { error }),

  onboardingCompleted: (skillLevel: string, track: string, score: number) =>
    capture('onboarding_completed', { skillLevel, track, score }),
};
