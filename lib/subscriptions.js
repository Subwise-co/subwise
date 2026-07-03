// Pure, side-effect-free helpers for subscription processing.
// Kept free of network/DB calls so they can be unit-tested in isolation.
import { addDays, addMonths, addYears, parseISO, isSameDay, isBefore, format } from 'date-fns'
import { toInr, fromInr } from '@/lib/currency'

// Extract the first JSON array found in a model response. Never throws.
export function extractJsonArray(text) {
  if (!text) return []
  const match = String(text).match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// Normalize a service name for fuzzy dedupe: lowercase, strip whitespace.
// "Netflix", "netflix", "Netflix India" -> "netflix" / "netflixindia".
export function normalizeServiceKey(name) {
  return (name ?? '').toString().toLowerCase().replace(/\s+/g, '').trim()
}

const MERGE_FIELDS = [
  'amount',
  'currency',
  'billing_cycle',
  'payment_method',
  'next_charge_date',
  'charge_date',
  'trial_end_date',
  'kind',
  'confidence',
  'cancelled',
]

// Structural "noise" words that do NOT identify a service — mostly mutual-fund / e-mandate / plan-tier
// boilerplate. The model emits these inconsistently across emails for the same item (e.g. a SIP as
// "HDFC Silver ETF FoF" in one email and "HDFC Silver ETF Fund of Funds Direct Growth" in another),
// which previously broke fuzzy dedupe and created duplicate rows. Stripping them keeps the IDENTIFYING
// tokens (brand + asset, e.g. hdfc/silver/etf) so variants of the same fund collapse — while different
// funds (HDFC vs ICICI, silver vs gold) still stay distinct.
const NAME_STOPWORDS = new Set([
  'of', 'the', 'and', 'a', 'an', 'for',
  // mutual-fund / SIP boilerplate
  'fund', 'funds', 'fof', 'scheme', 'sip', 'plan', 'direct', 'regular', 'growth', 'dividend', 'idcw',
  'payout', 'reinvestment', 'option', 'series',
  // mandate / autopay boilerplate
  'mandate', 'autopay', 'emandate', 'enach', 'nach', 'si', 'recurring', 'standing', 'instruction',
  // corporate suffixes / geography (so "Facebook India Online Services Private Limited" ≡
  // "Facebook India Online SE" ≡ "Facebook" — same merchant, different legal-name truncations)
  'ltd', 'limited', 'inc', 'llp', 'co', 'company', 'corp', 'corporation', 'india', 'in',
  'online', 'services', 'service', 'pvt', 'private', 'solutions', 'technologies', 'technology', 'tech',
  // plan-tier boilerplate (so "Spotify Premium" ≡ "Spotify", "YouTube Premium" ≡ "YouTube")
  'premium', 'pro', 'plus', 'subscription', 'membership',
])

// Tokenize a service name into a set of IDENTIFYING lowercase alphanumeric words (noise stripped).
// Falls back to the raw tokens if stripping would leave nothing (e.g. a name made only of stopwords).
export function serviceTokens(name) {
  const all = (name ?? '')
    .toString()
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  const core = all.filter((t) => !NAME_STOPWORDS.has(t))
  return new Set(core.length ? core : all)
}

function isSubset(a, b) {
  if (!a.size) return false
  for (const t of a) if (!b.has(t)) return false
  return true
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return inter / (a.size + b.size - inter)
}

// Two names refer to the same service if one token set is a subset of the other
// ("HDFC Silver ETF FoF SIP" ⊆ "HDFC Silver ETF FoF Direct Growth SIP"; "Netflix" ⊆ "Netflix India")
// or they overlap heavily (Jaccard ≥ 0.6). Different funds (HDFC vs ICICI) stay separate.
export function sameService(a, b) {
  return isSubset(a, b) || isSubset(b, a) || jaccard(a, b) >= 0.6
}

// Find the existing row whose service_name fuzzily matches `name` (same fund/service), or null.
// Used to dedupe-on-write across scan batches/steps so variants don't create duplicate rows.
export function findMatchingSubscription(existingRows, name) {
  const tokens = serviceTokens(name)
  if (!tokens.size) return null
  return (existingRows || []).find((r) => sameService(tokens, serviceTokens(r.service_name))) || null
}

// Find ALL existing rows that fuzzily match `name`. Normally one, but if earlier (buggy) scans left
// duplicate rows for the same fund, this returns them all so the writer can collapse them into one.
export function findAllMatchingSubscriptions(existingRows, name) {
  const tokens = serviceTokens(name)
  if (!tokens.size) return []
  return (existingRows || []).filter((r) => sameService(tokens, serviceTokens(r.service_name)))
}

// Deduplicate by FUZZY service-name match, MERGING fields across copies so we don't lose data
// (e.g. a SIP "Units allocated" email with the amount + an "Instalment due" email with the date →
// one entry with both). Keeps the most descriptive (longest) name for the merged entry.
export function dedupeSubscriptions(list) {
  const groups = [] // { tokens, item }
  for (const sub of list || []) {
    const name = sub?.service_name
    if (!name) continue
    const tokens = serviceTokens(name)
    if (!tokens.size) continue

    const group = groups.find((g) => sameService(g.tokens, tokens))
    if (!group) {
      groups.push({ tokens, item: { ...sub } })
      continue
    }
    for (const f of MERGE_FIELDS) {
      const empty = group.item[f] === null || group.item[f] === undefined || group.item[f] === ''
      if (empty && sub[f] != null && sub[f] !== '') group.item[f] = sub[f]
    }
    // Prefer the more descriptive (longer) name, and widen the group's tokens accordingly.
    if (String(name).length > String(group.item.service_name || '').length) {
      group.item.service_name = name
      group.tokens = serviceTokens(name)
    }
  }
  return groups.map((g) => g.item)
}

// The date that determines an item's status, by kind.
export function relevantDate(item) {
  if (!item) return null
  if (item.kind === 'trial' || item.is_trial) return item.trial_end_date || item.next_charge_date
  if (item.kind === 'one_time') return item.charge_date
  return item.next_charge_date // subscription / mandate
}

function startOfDay(now) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

const RECURRING_CYCLES = { monthly: 1, annual: 12, weekly: 0 }

// Advance a date by one billing cycle.
function addCycle(date, cycle) {
  if (cycle === 'monthly') return addMonths(date, 1)
  if (cycle === 'annual') return addYears(date, 1)
  if (cycle === 'weekly') return addDays(date, 7)
  return date
}

// The next charge date for a recurring item, rolled forward to today or later.
// e.g. a monthly sub stored as the 16th, viewed on the 19th, returns next month's 16th.
// Returns a "YYYY-MM-DD" string, or null if there's no base date.
export function effectiveNextChargeDate(item, now = new Date()) {
  const base = item?.next_charge_date
  if (!base) return null
  let d
  try {
    d = parseISO(base)
  } catch {
    return base
  }
  const cycle = item.billing_cycle
  if (cycle in RECURRING_CYCLES) {
    let guard = 0
    while (isBefore(d, startOfDay(now)) && guard < 600) {
      d = addCycle(d, cycle)
      guard += 1
    }
  }
  return format(d, 'yyyy-MM-dd') // local-time format avoids UTC off-by-one
}

// 'active' | 'cancelled' | 'expired' | 'completed'(one-time).
export function getStatus(item, now = new Date()) {
  if (item?.kind === 'one_time') return 'completed'
  // Explicitly cancelled/ended (detected from a cancellation email or a user action) → never active.
  if (item?.is_active === false || item?.cancelled === true) return 'cancelled'
  // A mandate is a standing auto-debit authorization (active until cancelled) — never expires on its date.
  if (item?.kind === 'mandate') return 'active'

  // Trials end on a fixed date; once past, they're expired.
  if (item?.kind === 'trial' || item?.is_trial) {
    const d = item.trial_end_date || item.next_charge_date
    if (!d) return 'active'
    try {
      return parseISO(d) < startOfDay(now) ? 'expired' : 'active'
    } catch {
      return 'active'
    }
  }

  // Subscriptions: if they have a billing cycle they keep renewing → always active (date rolls forward).
  if (item?.billing_cycle in RECURRING_CYCLES) return 'active'

  // Cycle-less subscription: expired only if its single date is in the past.
  const d = item?.next_charge_date
  if (!d) return 'active'
  try {
    return parseISO(d) < startOfDay(now) ? 'expired' : 'active'
  } catch {
    return 'active'
  }
}

// Was the relevant date within the last `days` (default 90)? Used to hide stale expired items.
export function isExpiredWithin(item, days = 90, now = new Date()) {
  const d = relevantDate(item)
  if (!d) return false
  try {
    const dt = parseISO(d)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - days)
    return dt < startOfDay(now) && dt >= startOfDay(cutoff)
  } catch {
    return false
  }
}

// Group a flat list into the dashboard's sections.
// pending: needs user confirmation. active: ongoing confirmed subs/trials/mandates.
// singlePayments: one-time. cancelled: detected as cancelled/ended (shown so the user can see them).
// expired: ended ≤90 days ago (older are dropped). rejected: excluded.
export function groupSubscriptions(subscriptions = [], now = new Date()) {
  const pending = []
  const active = []
  const singlePayments = []
  const cancelled = []
  const expired = []
  for (const item of subscriptions || []) {
    if (item.status === 'rejected') continue
    if (item.status === 'pending') {
      pending.push(item)
      continue
    }
    if (item.kind === 'one_time') {
      singlePayments.push(item)
      continue
    }
    const st = getStatus(item, now)
    if (st === 'cancelled') {
      cancelled.push(item) // shown regardless of age — the user explicitly wants to see what ended
      continue
    }
    if (st === 'expired') {
      if (isExpiredWithin(item, 90, now)) expired.push(item)
      continue // drop if expired > 90 days ago
    }
    active.push(item)
  }
  return { pending, active, singlePayments, cancelled, expired }
}

// Ghost spend: ongoing money leak only — active subscriptions + mandates (annual amortized).
// Excludes trials (no charge yet), one-time payments, and expired items. Mixed-currency per-item amounts
// are summed in INR, then the total is converted to `displayCurrency` (the user's local currency, by
// location; default INR). `monthlyInr` is always returned for thresholds/analytics.
export function computeGhostSpend(subscriptions = [], now = new Date(), rates = null, displayCurrency = 'INR') {
  const recurring = (subscriptions || []).filter(
    (s) =>
      s.status !== 'pending' &&
      s.status !== 'rejected' &&
      (s.kind === 'subscription' || s.kind === 'mandate' || (!s.kind && !s.is_trial)) &&
      getStatus(s, now) === 'active'
  )
  const monthly = recurring
    .filter((s) => s.billing_cycle !== 'annual')
    .reduce((sum, s) => sum + toInr(s.amount, s.currency, rates), 0)
  const annualAsMonthly =
    recurring
      .filter((s) => s.billing_cycle === 'annual')
      .reduce((sum, s) => sum + toInr(s.amount, s.currency, rates), 0) / 12
  const monthlyInr = monthly + annualAsMonthly
  const currency = (displayCurrency || 'INR').toUpperCase()
  const monthlyTotal = fromInr(monthlyInr, currency, rates)
  return {
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    count: recurring.length,
    currency,
    monthlyInr, // INR-equivalent, for currency-independent thresholds/analytics
  }
}

// Lookback window (days) for a scan, given when the user was last scanned.
// First scan (never scanned) → 90 (3 months). Weekly scan → days since last scan + 3-day buffer,
// clamped to [7, 90]. `now` is injectable for tests.
export function scanWindowDays(lastScannedAt) {
  // First-ever scan looks back 90 days; EVERY re-scan only looks at the last 7 days — cheap, and it
  // still catches anything added since the last scan (already-detected items stay stored). This also
  // limits cost/abuse from repeatedly re-scanning or deleting + re-creating an account.
  if (!lastScannedAt) return 90
  return 7
}

// Should we fire a Trial Watchdog alert for this trial? Only if it has a known end date that is TODAY or
// later — a trial that already ended has already converted/charged, so alerting is just noise (and wrong).
// `now` is injectable for deterministic tests.
export function shouldAlertTrial(trial, now = new Date()) {
  const end = trial?.trial_end_date || trial?.next_charge_date
  if (!end) return false
  // Compare on the date only, in end-of-day terms, so a trial ending "today" still alerts.
  const endMs = new Date(`${String(end).slice(0, 10)}T23:59:59Z`).getTime()
  if (Number.isNaN(endMs)) return false
  return endMs >= now.getTime()
}

// Is a renewal alert due today? (alert fires `daysBefore` days before the charge date.)
// `now` is injectable for deterministic tests.
export function isAlertDueToday(nextChargeDate, daysBefore, now = new Date()) {
  if (!nextChargeDate) return false
  try {
    const alertDate = addDays(parseISO(nextChargeDate), -Number(daysBefore || 0))
    return isSameDay(alertDate, now)
  } catch {
    return false
  }
}
