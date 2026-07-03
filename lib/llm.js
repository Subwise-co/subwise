// Provider-agnostic text generation with MULTI-KEY rotation + fallback.
//
// Groq free-tier limits are per-API-key, so we support several Groq keys and rotate across them
// (round-robin) — sequential scan batches land on different keys, multiplying throughput so a
// 100+ email scan won't trip the per-minute/per-day limits. On a key's 429 we cool it down and
// move to the next key; only when all Groq keys are cooling do we fall back to Gemini.
//
//   GROQ_API_KEYS=key1,key2,key3,key4   (preferred — comma-separated)
//   GROQ_API_KEY=key                    (single-key fallback, still supported)
//   LLM_PROVIDER=groq (default) | gemini   → which provider family is tried first
//
// Env read at call time so it works with late-loaded env and is easy to test.
import { GoogleGenerativeAI } from '@google/generative-ai'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash' // 2.0-flash is suspended; 2.5-flash / -lite are valid

// Parse the configured Groq keys for a given POOL so scanning, analytics, and the Stage-2 clustering
// tie-break can use separate keys at scale (10 keys → ~6 scan / 2 analytics / 2 cluster). Each pool falls
// back to the shared GROQ_API_KEYS, then a single GROQ_API_KEY. pool: 'scan' | 'analytics' | 'cluster' |
// undefined (shared). The dedicated GROQ_*_KEYS split is optional — unset pools just share GROQ_API_KEYS.
function groqKeys(pool) {
  const named =
    pool === 'analytics'
      ? process.env.GROQ_ANALYTICS_KEYS
      : pool === 'scan'
        ? process.env.GROQ_SCAN_KEYS
        : pool === 'cluster'
          ? process.env.GROQ_CLUSTER_KEYS
          : ''
  const src = named || process.env.GROQ_API_KEYS || ''
  const multi = src.split(',').map((k) => k.trim()).filter(Boolean)
  if (multi.length) return multi
  return process.env.GROQ_API_KEY ? [process.env.GROQ_API_KEY] : []
}
function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY)
}

// Per-key cooldown (epoch ms until which a 429'd key is skipped) + a round-robin cursor.
const cooldownUntil = new Map()
let rrCursor = 0

// Test helper: reset rotation/cooldown state between tests.
export function clearCooldowns() {
  cooldownUntil.clear()
  rrCursor = 0
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const is429 = (err) => /\b429\b/.test(err?.message || '')
// An invalid/revoked key: don't retry it every batch — cool it for the rest of the run.
const isInvalidKey = (err) => /\b401\b|invalid_api_key|invalid api key/i.test(err?.message || '')
const INVALID_KEY_COOLDOWN_MS = 24 * 60 * 60 * 1000

// Pull a retry delay (ms) out of a provider error: Groq "Please retry in 24.5s",
// Gemini `"retryDelay":"24s"`, or generic "try again in 12s". Returns null if none.
export function parseRetryMs(err) {
  const msg = String(err?.message || '')
  const m =
    msg.match(/retry(?:Delay)?["']?[^0-9]*([0-9.]+)\s*s/i) || msg.match(/in\s+([0-9.]+)\s*s/i)
  return m ? Math.ceil(parseFloat(m[1]) * 1000) : null
}

// Groq keys not currently cooling down, ordered round-robin (so consecutive calls spread the load).
function availableGroqKeys(pool) {
  const keys = groqKeys(pool)
  if (!keys.length) return []
  const now = Date.now()
  const live = keys.filter((k) => (cooldownUntil.get(k) || 0) <= now)
  if (!live.length) return []
  const start = rrCursor % live.length
  rrCursor = (rrCursor + 1) % Math.max(live.length, 1)
  return [...live.slice(start), ...live.slice(0, start)]
}

async function callGroq(prompt, key) {
  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Groq ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const result = await genAI.getGenerativeModel({ model }).generateContent(prompt)
  return result.response.text()
}

// Provider FAMILY order (groq vs gemini), filtered to configured ones. (Groq expands to its keys.)
export function providerOrder(pool) {
  const primary = (process.env.LLM_PROVIDER || 'groq').toLowerCase()
  const order = primary === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini']
  return order.filter((p) => (p === 'groq' ? groqKeys(pool).length > 0 : geminiConfigured()))
}

// Generate text. Builds an attempt list (rotated Groq keys + Gemini per the family order) and tries
// each until one succeeds. A Groq 429 cools that key (honoring retry-after) and moves on. Throws only
// if every attempt fails — annotated with `.rateLimited`/`.retryAfterMs` so the caller can retry later.
export async function generateText(prompt, meta = {}, opts = {}) {
  const pool = opts.pool
  const families = providerOrder(pool)
  if (!families.length)
    throw new Error('No LLM provider configured — set GROQ_API_KEYS/GROQ_API_KEY and/or GEMINI_API_KEY')

  const attempts = []
  for (const fam of families) {
    if (fam === 'groq') {
      availableGroqKeys(pool).forEach((key, i) => attempts.push({ type: 'groq', key, idx: i }))
    } else {
      attempts.push({ type: 'gemini' })
    }
  }
  // All Groq keys are cooling and there's no Gemini → tell caller when to retry.
  if (!attempts.length) {
    const soonest = Math.min(...groqKeys(pool).map((k) => cooldownUntil.get(k) || 0))
    const err = new Error('All Groq keys cooling down')
    err.rateLimited = true
    err.retryAfterMs = Math.max(1000, soonest - Date.now())
    throw err
  }

  let lastErr
  for (const a of attempts) {
    try {
      const text = a.type === 'groq' ? await callGroq(prompt, a.key) : await callGemini(prompt)
      meta.provider = a.type === 'groq' ? `groq#${a.idx + 1}` : `gemini:${process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL}`
      return text
    } catch (err) {
      lastErr = err
      if (a.type === 'groq' && isInvalidKey(err)) {
        // Bad/revoked key — skip it for the rest of the run instead of retrying every batch.
        cooldownUntil.set(a.key, Date.now() + INVALID_KEY_COOLDOWN_MS)
        console.warn(`[llm] groq key#${a.idx + 1} is invalid (401) — disabling it for this run, trying next`)
      } else if (a.type === 'groq' && is429(err)) {
        const cool = parseRetryMs(err) ?? 60000
        cooldownUntil.set(a.key, Date.now() + cool)
        console.warn(`[llm] groq key#${a.idx + 1} rate-limited — cooling ${Math.round(cool / 1000)}s, trying next`)
      } else {
        console.warn(`[llm] ${a.type} attempt failed: ${err?.message || err}`)
      }
    }
  }
  if (lastErr) {
    lastErr.rateLimited = is429(lastErr) || lastErr.rateLimited
    lastErr.retryAfterMs = lastErr.retryAfterMs || parseRetryMs(lastErr)
  }
  throw lastErr
}
