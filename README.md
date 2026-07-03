# Subwise

**Never miss another payment.** Subwise is the financial-reminder layer for India — it finds every
recurring payment hiding in your inbox and pings you on **WhatsApp before the money leaves your account**.

Subscriptions, rent, EMIs, insurance, SIPs, UPI AutoPay mandates — they renew silently, and cancelling
the app rarely stops the debit. Subwise brings them all into one honest view and reminds you in time to act.

---

## What it does

- 🔎 **Finds recurring payments automatically** — connect Gmail (read-only) and an AI parser detects
  subscriptions, mandates, trials and renewals across the whole Indian auto-pay landscape (UPI AutoPay,
  e-NACH/NACH, card standing instructions, SIPs). Prefer manual? Add them yourself — no Gmail needed.
- 💸 **Shows your real monthly commitment** — one clear, verifiable number in your local currency, split
  into recurring vs one-time, with a spend forecast and charge calendar.
- 🔔 **Reminds you on WhatsApp before every charge** — with two-way controls (reply **YES / STOP / PAUSE /
  CANCEL**). Email is the automatic fallback when WhatsApp isn't connected.
- 🧾 **Shows you how to actually cancel** — 25 India-specific cancellation guides, including how to kill the
  UPI/NACH/card mandate that keeps charging *after* you "cancel" the app.

## How it helps

Most people lose money to payments they forgot about — a lapsed free trial, a mandate they can't locate,
an annual renewal that lands by surprise. Subwise turns those silent debits into a timely nudge, so you
decide **before** you're charged. Free, India-first, and privacy-first: read-only Gmail access, data never
sold, delete everything in one tap.

---

## Architecture

- **Next.js app** (repo root) — deployed on Vercel. Auth (Google + email/password via NextAuth), Gmail
  scan, AI parsing + entity-resolution, dashboard, and scheduled crons. TypeScript frontend, JS backend.
- **`whatsapp-worker/`** — a separate always-on Node service (Railway/VPS) running `whatsapp-web.js`. It
  holds a persistent authenticated WhatsApp session, so it can't run on serverless; it talks to the app
  over HTTP with a shared bearer secret.
- **Supabase** (Postgres) for data.llm with multi-key rotation for AI parsing

```
Gmail ──scan(job)──▶ AI parse (llm ×N keys) ──▶ cluster + reconcile ──▶ Supabase
                                                                                     │
        dashboard (monthly total, confirm/reject, guides)  ◀────────────────────────┤
                                                                                     ▼
             crons (daily reminders · weekly auto-scan · monthly digest)
                                                                                     ▼
                        lib/whatsapp (provider=webjs) ──▶ whatsapp-worker ──▶ user's WhatsApp
```

## Local development

```bash
# 1) App
npm install                       # uses .npmrc (legacy-peer-deps)
npm run dev                       # http://localhost:3000

# 2) WhatsApp worker (separate terminal)
cd whatsapp-worker
npm install                       # whatsapp-web.js 1.34.x + puppeteer (downloads Chrome once)
npm start                         # link the QR at http://localhost:8080/qr?key=<WHATSAPP_WORKER_SECRET>
```

Environment lives in `.env.local` (app) and `whatsapp-worker/.env` (worker) — copy from the `.env.example`
in each. Key vars: Supabase, Google OAuth,
`GEMINI_API_KEY`(comma-separated, one per account), `WHATSAPP_PROVIDER=webjs`, `WHATSAPP_WORKER_URL`, and `WHATSAPP_WORKER_SECRET` (identical
in both). **No secrets are committed** — only the `.env.example` templates.

## Database

Run the SQL migrations in `supabase/migrations/` from the Supabase SQL editor.

## Tests

```bash
npm test                          # unit tests (offline)
npm run test:integration          # live Supabase tests
RUN_LIVE_LLM=1 npm run test:integration   # opt-in: real-model parser checks
```

## Deploy

See **`DEPLOY.md`** — worker → Railway (with a `/data` volume for the session), app → Vercel.

---

> **WhatsApp note:** `whatsapp-web.js` is the launch transport (unofficial) — used opt-in, low-volume, for
> utility reminders only. Migrating to the official Meta Cloud API is a one-env-var switch
> (`WHATSAPP_PROVIDER=meta`); the template routing is already built in `lib/whatsapp.js`.
