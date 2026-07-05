// Subwise WhatsApp worker — whatsapp-web.js based.
//
// Runs as a SEPARATE always-on Node process (Railway/VPS), NOT on Vercel: it holds a persistent
// authenticated WhatsApp Web session (LocalAuth) and a headless browser, neither of which work on
// serverless. Scan the QR once; the session persists across restarts via the auth folder.
//
// Responsibilities:
//   1. Outbound: POST /enqueue { to, body }  → queued, then sent with a human-like delay.
//   2. Inbound : on a user message → forward to the Next.js app, send back its reply.
//
// Auth: a single shared bearer secret (WHATSAPP_WORKER_SECRET) guards /enqueue and is used when
// calling the Next.js inbound endpoint.
require('dotenv').config() // loads .env locally; no-op on Railway (vars come from the dashboard)
const fs = require('fs')
const path = require('path')
const express = require('express')
const qrcodeTerminal = require('qrcode-terminal')
const QRCode = require('qrcode')
const { Client, LocalAuth } = require('whatsapp-web.js')

// Browser: use PUPPETEER_EXECUTABLE_PATH if set (Docker/Railway → system Chromium), otherwise let
// the bundled Chrome that ships with this puppeteer version run (most compatible locally).
const BROWSER_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || undefined

const PORT = process.env.PORT || 8080
const SECRET = process.env.WHATSAPP_WORKER_SECRET || ''
const NEXTJS_URL = (process.env.NEXTJS_URL || '').replace(/\/$/, '')
// Human-like spacing between sends (the doc: 20–120s). Tunable via env.
const MIN_DELAY_MS = Number(process.env.WORKER_MIN_DELAY_MS) || 20_000
const MAX_DELAY_MS = Number(process.env.WORKER_MAX_DELAY_MS) || 120_000
// Scan ticker: advance any active scan job by one batch every SCAN_TICK_MS (server-side "background").
const SCAN_TICK_MS = Number(process.env.SCAN_TICK_MS) || 25_000

// WhatsApp Web version pinning. whatsapp-web.js drives the web.whatsapp.com page by injecting code that
// assumes a specific WhatsApp Web build. Its default `local` cache resolves to the version the library
// shipped with; if that HTML isn't on disk it SILENTLY loads the LIVE page, which is usually newer than
// the library can drive → `window.Debug.VERSION` never appears → the "auth timeout" we hit (no QR ever).
// Fix: load a KNOWN-GOOD snapshot via the `remote` cache. Snapshots rotate, so by default we auto-detect
// the newest one in the wppconnect archive at boot. Override with envs if a specific pin is needed.
const WEB_VERSION_PIN = process.env.WWEBJS_WEB_VERSION || '' // explicit pin wins; '' = auto-detect latest
const WEB_VERSION_REMOTE =
  process.env.WWEBJS_REMOTE_PATH ||
  'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html'
let resolvedWebVersion = WEB_VERSION_PIN // set at boot (before the client starts)

// Find the newest WhatsApp Web snapshot the wppconnect archive currently hosts, so we never pin a
// version that's been rotated out (a 404 there would silently fall back to the live page → auth timeout).
async function resolveLatestWebVersion() {
  if (WEB_VERSION_PIN) return WEB_VERSION_PIN // explicit env pin wins — skip the lookup
  try {
    const res = await fetch('https://api.github.com/repos/wppconnect-team/wa-version/contents/html', {
      headers: { 'User-Agent': 'subwise-worker', Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return ''
    const files = await res.json()
    const build = (v) => Number(v.split('.')[2].split('-')[0]) || 0 // numeric part for sorting
    const versions = (Array.isArray(files) ? files : [])
      .map((f) => f.name)
      .filter((n) => /^2\.3000\..+\.html$/.test(n))
      .map((n) => n.replace(/\.html$/, ''))
      .sort((a, b) => build(a) - build(b))
    return versions[versions.length - 1] || ''
  } catch (e) {
    console.error('[worker] could not resolve latest WhatsApp Web version:', e?.message || e)
    return ''
  }
}

// Keep the process (and the HTTP server) alive no matter what the WhatsApp client throws — a crashed
// process is what caused the app's ECONNREFUSED on /api/whatsapp/optin.
process.on('unhandledRejection', (e) => console.error('[worker] unhandledRejection:', e?.message || e))
process.on('uncaughtException', (e) => console.error('[worker] uncaughtException:', e?.message || e))

let ready = false
let readyAt = 0 // timestamp when the session last became READY — used to settle before the first send
let lastQr = null // latest QR string (for the /qr browser page); cleared once linked
let client = null
let starting = false
let restartTimer = null
const queue = [] // [{ to, body }] — in-memory (MVP). Lost on restart; alerts recompute next cron.

// Anti-spam: never send the SAME message to the SAME number twice within this window (and never queue
// duplicates). This is what got us a temporary WhatsApp ban — repeated identical sends to one number.
const recentSends = new Map() // to -> { body, at }
const DEDUP_WINDOW_MS = Number(process.env.WORKER_DEDUP_MS) || 10 * 60 * 1000

if (BROWSER_PATH) console.log(`[worker] using browser: ${BROWSER_PATH}`)
else console.log('[worker] using puppeteer bundled Chromium')

// A crash or redeploy can leave Chromium's profile singleton lock behind on the persistent volume.
// The next container has a DIFFERENT hostname, so Chromium reads the lock as "profile in use by
// another computer" and refuses to launch — and because /data survives restarts, the retry loop can
// never recover on its own. Exactly one worker runs at a time, so any lock found at boot is stale by
// definition: remove it before every launch. (SingletonLock is a dangling symlink — rmSync handles it.)
const WWEBJS_DATA_PATH = process.env.WWEBJS_DATA_PATH || './.wwebjs_auth'
function clearStaleChromiumLocks() {
  try {
    const sessionDirs = fs
      .readdirSync(WWEBJS_DATA_PATH, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('session'))
      .map((d) => path.join(WWEBJS_DATA_PATH, d.name))
    for (const dir of sessionDirs) {
      for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        const p = path.join(dir, name)
        try {
          fs.lstatSync(p) // throws if absent (lstat, not stat: SingletonLock is a dangling symlink)
          fs.rmSync(p, { force: true })
          console.log(`[worker] cleared stale ${name} in ${dir}`)
        } catch {
          /* nothing to clear */
        }
      }
    }
  } catch {
    /* data dir doesn't exist yet (first boot) — nothing to do */
  }
}

// Escape hatch for a CORRUPTED profile (e.g. after a hard crash): set WWEBJS_RESET_SESSION=1 in the
// service env and redeploy — the session folders are moved aside (not deleted) at boot, Chromium
// starts clean, and you re-link once via /qr. Then REMOVE the var so later restarts keep the session.
function resetSessionIfRequested() {
  if (process.env.WWEBJS_RESET_SESSION !== '1') return
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const dirs = fs
      .readdirSync(WWEBJS_DATA_PATH, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('session') && !d.name.includes('backup'))
    for (const d of dirs) {
      const from = path.join(WWEBJS_DATA_PATH, d.name)
      const to = path.join(WWEBJS_DATA_PATH, `${d.name}-backup-${stamp}`)
      fs.renameSync(from, to)
      console.log(`[worker] WWEBJS_RESET_SESSION=1 — moved ${from} → ${to}; re-link via /qr, then unset the var`)
    }
  } catch (e) {
    console.error('[worker] session reset failed:', e?.message || e)
  }
}

// Build a FRESH client with all listeners attached. We never call initialize() twice on the same
// instance (that caused "binding already exists"); on every (re)connect we destroy the old one
// (releasing the userDataDir lock that caused "browser is already running") and create a new one.
function createClient() {
  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WWEBJS_DATA_PATH || './.wwebjs_auth' }),
    puppeteer: {
      headless: true,
      executablePath: BROWSER_PATH,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // Containers give /dev/shm only 64MB; Chromium exhausts it and dies at launch ("Code: null").
        // This makes it use /tmp instead — the standard puppeteer-in-Docker fix.
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-crash-reporter',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
      ],
    },
    // Give a slow first page-load more room than the 30s default before throwing "auth timeout".
    authTimeoutMs: 60_000,
    qrMaxRetries: 5,
    // Pin a known-good WhatsApp Web build (resolved at boot) instead of the live page. Falls back to
    // the library default `local` cache only if we couldn't resolve a snapshot.
    ...(resolvedWebVersion
      ? { webVersion: resolvedWebVersion, webVersionCache: { type: 'remote', remotePath: WEB_VERSION_REMOTE } }
      : {}),
  })
  c.on('qr', (qr) => {
    lastQr = qr
    console.log('\n[worker] Scan this QR with WhatsApp Business (once). Or open /qr in a browser:\n')
    qrcodeTerminal.generate(qr, { small: true })
  })
  c.on('ready', () => {
    ready = true
    readyAt = Date.now()
    lastQr = null
    console.log('[worker] WhatsApp client READY')
  })
  c.on('authenticated', () => console.log('[worker] authenticated (QR accepted)'))
  c.on('loading_screen', (p, m) => console.log(`[worker] loading ${p}% ${m || ''}`))
  c.on('change_state', (s) => console.log('[worker] state:', s))
  c.on('auth_failure', (m) => console.error('[worker] auth_failure:', m))
  c.on('disconnected', (r) => {
    ready = false
    console.error('[worker] disconnected:', r, '— restarting in 8s')
    scheduleRestart(8000)
  })
  c.on('message', onMessage)
  return c
}

// (Re)start the client. Serialized (only one start in flight) and destroys the previous browser first.
async function startClient(attempt = 0) {
  if (starting) return
  starting = true
  ready = false
  try {
    if (client) {
      try {
        await client.destroy()
      } catch {
        /* ignore destroy errors */
      }
    }
    clearStaleChromiumLocks()
    client = createClient()
    await client.initialize()
    starting = false
  } catch (err) {
    starting = false
    const wait = Math.min(5000 * 2 ** attempt, 60_000)
    console.error(`[worker] start failed (${err?.message || err}) — retrying in ${wait / 1000}s`)
    scheduleRestart(wait, attempt + 1)
  }
}

function scheduleRestart(delay, attempt = 0) {
  if (restartTimer) return // a restart is already pending
  restartTimer = setTimeout(() => {
    restartTimer = null
    startClient(attempt)
  }, delay)
}

const toChatId = (to) => `${String(to).replace(/\D/g, '')}@c.us`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const randomDelay = () => MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS))

// Fallback readiness: whatsapp-web.js sometimes doesn't fire 'ready' (gets stuck after auth). Poll the
// WhatsApp connection state and flip `ready` once it's CONNECTED so queued messages actually send.
async function readinessPoller() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!ready && client) {
      try {
        const state = await client.getState()
        if (state === 'CONNECTED') {
          ready = true
          if (!readyAt) readyAt = Date.now()
          lastQr = null
          console.log('[worker] READY (detected via getState)')
        }
      } catch {
        /* page not loaded yet */
      }
    }
    await sleep(5000)
  }
}

// Right after a session becomes READY, WhatsApp Web is still doing its initial sync and reloads the
// page once or twice — a send fired in that window dies with "Promise was collected" / "Execution
// context was destroyed" (the puppeteer page context is torn down mid-call). The FIRST send a new
// user gets is the opt-in welcome, so this must be robust. Two guards: a post-READY settle, and a
// retry that re-sends on those transient page-teardown errors.
const READY_SETTLE_MS = Number(process.env.WORKER_READY_SETTLE_MS) || 6000
const SEND_RETRIES = Number(process.env.WORKER_SEND_RETRIES) || 3
const TRANSIENT_SEND_ERROR =
  /Promise was collected|Execution context was destroyed|Target closed|Session closed|context was destroyed|Cannot read properties of undefined/i

async function sendWithRetry(to, body) {
  for (let attempt = 1; attempt <= SEND_RETRIES; attempt++) {
    try {
      await client.sendMessage(toChatId(to), body)
      return
    } catch (err) {
      const msg = err?.message || String(err)
      const transient = TRANSIENT_SEND_ERROR.test(msg)
      console.error(`[worker] send attempt ${attempt}/${SEND_RETRIES} failed → ${to}: ${msg}`)
      if (!transient || attempt === SEND_RETRIES) throw err
      // Page is likely mid-reload — wait for it to settle (and re-confirm CONNECTED), then retry.
      await sleep(2500 * attempt)
      try {
        if ((await client.getState()) !== 'CONNECTED') await sleep(3000)
      } catch {
        await sleep(3000)
      }
    }
  }
}

// Outbound queue processor — sends one message, then waits a randomized delay (never bursts).
async function processQueue() {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!ready || !client || queue.length === 0) {
      await sleep(3000)
      continue
    }
    // Don't fire during the post-link sync window — let the page settle first.
    const sinceReady = Date.now() - readyAt
    if (readyAt && sinceReady < READY_SETTLE_MS) {
      await sleep(READY_SETTLE_MS - sinceReady)
    }
    const job = queue.shift()
    try {
      await sendWithRetry(job.to, job.body)
      recentSends.set(job.to, { body: job.body, at: Date.now() })
      console.log(`[worker] sent → ${job.to}`)
    } catch (err) {
      console.error(`[worker] send failed → ${job.to}:`, err?.message || err)
    }
    await sleep(randomDelay())
  }
}

// Inbound — forward a user's message to Next.js, send back the reply. (Attached in createClient.)
async function onMessage(msg) {
  try {
    if (msg.from.endsWith('@g.us') || msg.from === 'status@broadcast') return // ignore groups/status
    if (!NEXTJS_URL) return
    // Resolve the sender's REAL phone number. On newer WhatsApp, msg.from is a privacy "@lid"
    // identifier, NOT the phone number — and for a @lid contact `contact.number` is also the lid. That
    // breaks the server's last-10-digit matching (the YES/STOP reply still sends, but the profile
    // UPDATE matches no row, so opt-in/STOP/PAUSE never persist). Use the library's lid→pn map.
    let from = msg.from.split('@')[0]
    try {
      if (msg.from.endsWith('@lid') && typeof client.getContactLidAndPhone === 'function') {
        const [m] = await client.getContactLidAndPhone([msg.from])
        if (m?.pn) from = String(m.pn).replace(/\D/g, '') // e.g. "918375928860@c.us" → "918375928860"
      }
    } catch (e) {
      console.error('[worker] lid→phone resolve failed:', e?.message || e)
    }
    console.log(`[worker] inbound from=${msg.from} resolved=${from}: ${String(msg.body || '').slice(0, 24)}`)
    const res = await fetch(`${NEXTJS_URL}/api/whatsapp/inbound`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, text: msg.body }),
    })
    if (!res.ok) {
      console.error('[worker] inbound forward failed:', res.status)
      return
    }
    const { reply } = await res.json()
    if (reply) await msg.reply(reply)
  } catch (err) {
    console.error('[worker] inbound error:', err?.message || err)
  }
}

// --- HTTP API ---
const app = express()
app.use(express.json())

function authed(req) {
  return SECRET && req.headers.authorization === `Bearer ${SECRET}`
}

app.get('/health', (_req, res) => res.json({ ready, queued: queue.length }))

// Browser-friendly QR page — scan this from the dedicated WhatsApp Business phone.
// (Much easier than reading the ASCII QR out of cloud logs.) Auto-refreshes every 20s.
// Gated by ?key=<WHATSAPP_WORKER_SECRET> so a stranger can't grab the QR and hijack the session.
app.get('/qr', async (req, res) => {
  if (SECRET && req.query.key !== SECRET) return res.status(401).send('Unauthorized')
  if (ready) return res.send('<p>✅ Already linked. The worker is ready.</p>')
  if (!lastQr) return res.send('<p>Starting… no QR yet. Refresh in a few seconds.</p>')
  try {
    const dataUrl = await QRCode.toDataURL(lastQr, { width: 320 })
    res.send(
      `<!doctype html><meta http-equiv="refresh" content="20"><body style="font-family:sans-serif;text-align:center;padding:24px">
       <h3>Scan with WhatsApp Business → Linked Devices → Link a device</h3>
       <img src="${dataUrl}" alt="WhatsApp QR"/><p>This page refreshes every 20s.</p></body>`
    )
  } catch {
    res.status(500).send('QR render error')
  }
})

app.post('/enqueue', (req, res) => {
  if (!authed(req)) return res.status(401).json({ error: 'Unauthorized' })
  const { to, body } = req.body || {}
  if (!to || !body) return res.status(400).json({ error: 'to and body are required' })
  // Drop duplicates: same message already queued, or sent to this number very recently.
  const recent = recentSends.get(to)
  const dup =
    queue.some((j) => j.to === to && j.body === body) ||
    (recent && recent.body === body && Date.now() - recent.at < DEDUP_WINDOW_MS)
  if (dup) {
    console.log(`[worker] deduped duplicate message → ${to}`)
    return res.status(200).json({ deduped: true })
  }
  queue.push({ to, body })
  res.status(202).json({ queued: true, position: queue.length })
})

// Scan ticker — advance any active scan job by one batch, server-side, so scans finish even if no
// browser tab is open. Honors the retry-after the app returns when the LLM is rate-limited.
async function scanTicker() {
  if (!NEXTJS_URL || !SECRET) return // not configured → skip
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let extraWait = 0
    try {
      const res = await fetch(`${NEXTJS_URL}/api/scan/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        const d = await res.json().catch(() => ({}))
        if (d.retryAfterMs) extraWait = Math.min(d.retryAfterMs, 30_000)
        if (d.status === 'running' && !d.retryAfterMs) extraWait = -SCAN_TICK_MS + 1500 // keep momentum mid-job
      }
    } catch {
      /* app unreachable — try again next tick */
    }
    await sleep(SCAN_TICK_MS + extraWait)
  }
}

// HTTP server first (must stay up regardless of WhatsApp client state).
app.listen(PORT, () => console.log(`[worker] HTTP listening on :${PORT}`))
// Resolve the WhatsApp Web version to pin BEFORE the first client start, then boot the client.
;(async () => {
  resetSessionIfRequested() // once, at boot — NOT on every reconnect
  resolvedWebVersion = await resolveLatestWebVersion()
  if (resolvedWebVersion)
    console.log(`[worker] pinning WhatsApp Web ${resolvedWebVersion} (remote cache → no live-page mismatch)`)
  else
    console.log('[worker] no pinned web version available — falling back to library default (local cache)')
  startClient()
})()
processQueue()
readinessPoller()
scanTicker()
