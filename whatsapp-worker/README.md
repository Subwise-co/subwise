# Subwise WhatsApp Worker (whatsapp-web.js)

An always-on Node service that sends/receives WhatsApp messages for Subwise using
[`whatsapp-web.js`](https://github.com/pedroslopez/whatsapp-web.js). It is the **MVP transport**
while we wait to migrate to the official Meta Cloud API.

> **Why a separate service?** `whatsapp-web.js` runs a persistent, authenticated WhatsApp Web
> session in a headless browser. That needs a long-running process + stored session files, which
> Vercel (serverless) can't provide. So this runs on **Railway / a VPS**, separate from the Next.js app.

## How it connects to the app

```
Next.js (Vercel)                         this worker (Railway/VPS)
  lib/whatsapp.js (WHATSAPP_PROVIDER=webjs)
     └── POST /enqueue {to, body} ───────▶ outbound queue → throttled send (20–120s apart)
  /api/whatsapp/inbound  ◀── POST {from,text} ── on user message; replies with {reply}, worker sends it
```

The Next.js app must set:

- `WHATSAPP_PROVIDER=webjs`
- `WHATSAPP_WORKER_URL=https://<this-worker-url>`
- `WHATSAPP_WORKER_SECRET=<same secret as below>`

## Setup

1. Get a **dedicated** number (normal SIM) with the **WhatsApp Business** app installed. Do NOT use a personal number.
2. `cd whatsapp-worker && npm install` (pulls in Chromium via Puppeteer).
3. Copy `.env.example` → `.env` and fill `WHATSAPP_WORKER_SECRET` (must match the Next.js app) and `NEXTJS_URL`.
4. `npm start`. A **QR code** prints in the terminal — scan it from the dedicated WhatsApp (Linked Devices). Done once; the session persists in `.wwebjs_auth/`.
5. Verify: `GET /health` → `{ "ready": true, "queued": 0 }`.

## Deploy to Railway (recommended)

A `Dockerfile` is included (installs system Chromium), so Railway builds it reliably.

1. **New Project → Deploy from GitHub repo** (or `railway up` via the CLI). Set the service **Root Directory** to `whatsapp-worker` so Railway builds only this folder.
2. **Add a Volume** and set its mount path to `/data`.
3. **Variables:**
   - `WHATSAPP_WORKER_SECRET` = the shared secret (same as the Next.js app)
   - `NEXTJS_URL` = your public Next.js URL (e.g. `https://your-app.vercel.app`)
   - `WWEBJS_DATA_PATH` = `/data` (matches the volume → session survives redeploys)
   - (Railway sets `PORT` automatically; `PUPPETEER_EXECUTABLE_PATH` is set by the Dockerfile)
4. Deploy → open the service's public URL at **`/qr`** → scan with the WhatsApp Business number. `/health` should then show `{"ready":true}`.
5. Back in the **Next.js app** (Vercel env): set `WHATSAPP_PROVIDER=webjs`, `WHATSAPP_WORKER_URL=https://<railway-worker-url>`, `WHATSAPP_WORKER_SECRET=<same secret>` → redeploy.

> Without the volume at `/data`, every redeploy wipes the session and you'll re-scan the QR.

## VPS notes
- Install Node 20 + the `chromium` package; set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
- Keep it always-on with `pm2` or systemd; persist `WWEBJS_DATA_PATH` on disk.

## Scope / limits (MVP, Phase 1: 0–200 users)

- In-memory queue (lost on restart — fine; alerts recompute on the next cron).
- Single number, text only, low volume, opt-in users only (utility messages — no marketing).
- Phase 2 (200–1000): Redis-backed queue. Phase 3 (1000+): migrate to Meta Cloud API by setting
  `WHATSAPP_PROVIDER=meta` in the Next.js app — no other code changes.
