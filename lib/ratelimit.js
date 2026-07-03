// Lightweight in-memory sliding-window rate limiter for API routes. Best-effort: it's per-serverless-
// instance (Vercel may run several), so it stops obvious rapid abuse — a rented bot hammering /register
// or /optin during a public launch — without new infra. For hard, distributed limits at scale, swap the
// store for Upstash Ratelimit (env-gated) later. Pure-ish (a module-level Map); safe to unit-test.

const buckets = new Map() // key -> number[] (request timestamps, ms)

// Returns { ok, remaining, retryAfterMs }. Counts this call against the window when allowed.
export function rateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now()
  const cutoff = now - windowMs
  const hits = (buckets.get(key) || []).filter((t) => t > cutoff)
  if (hits.length >= limit) {
    const retryAfterMs = Math.max(0, hits[0] + windowMs - now)
    buckets.set(key, hits)
    return { ok: false, remaining: 0, retryAfterMs }
  }
  hits.push(now)
  buckets.set(key, hits)
  // Opportunistic cleanup so the Map doesn't grow unbounded on a long-lived instance.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      const live = v.filter((t) => t > cutoff)
      if (live.length) buckets.set(k, live)
      else buckets.delete(k)
    }
  }
  return { ok: true, remaining: limit - hits.length, retryAfterMs: 0 }
}

// Best-effort client IP from common proxy headers (Vercel sets x-forwarded-for).
export function clientIp(req) {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function tooMany(retryAfterMs) {
  return Response.json(
    { error: 'Too many requests. Please slow down and try again shortly.' },
    { status: 429, headers: { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

// Convenience: enforce a per-IP limit and return a 429 Response if exceeded, else null.
// Use for UNAUTHENTICATED endpoints (register, opt-in, fx) where the IP is the only identity.
export function enforce(req, name, opts) {
  const { ok, retryAfterMs } = rateLimit(`${name}:${clientIp(req)}`, opts)
  return ok ? null : tooMany(retryAfterMs)
}

// Enforce a limit keyed by an explicit identity (e.g. the signed-in user's email). Use for
// AUTHENTICATED endpoints so one account can't hammer an endpoint and so users behind a shared
// IP aren't throttled collectively. Returns a 429 Response if exceeded, else null.
export function enforceIdentity(identity, name, opts) {
  const { ok, retryAfterMs } = rateLimit(`${name}:${identity || 'anon'}`, opts)
  return ok ? null : tooMany(retryAfterMs)
}

// Test helper.
export function _reset() {
  buckets.clear()
}
