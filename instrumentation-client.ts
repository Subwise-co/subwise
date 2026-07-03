import posthog from "posthog-js";

// Only initialize when a token is configured (avoids init(undefined) warnings in local/preview
// without PostHog set up).
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
if (token) {
  posthog.init(token, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    // Finance app privacy: only build person profiles for identified users (no PII profiles for
    // anonymous bouncers), and if session replay is ever enabled, mask all inputs so amounts /
    // emails / phone numbers are never recorded. Mark any sensitive element with `.ph-no-capture`.
    person_profiles: "identified_only",
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: ".ph-no-capture",
    },
  });
}
