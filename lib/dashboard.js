// Pure, side-effect-free helpers that turn the flat subscription list into dashboard data:
// the spend chart (upcoming + historical), the next-charge stat, the charge calendar, the category
// breakdown, and the reminder summary. No network/DB — unit-testable in isolation.
import {
  startOfMonth,
  endOfMonth,
  startOfDay,
  addMonths,
  addYears,
  parseISO,
  format,
  getDate,
  isBefore,
  isAfter,
  differenceInCalendarDays,
} from 'date-fns'
import { toInr, fromInr } from '@/lib/currency'
import { getStatus, effectiveNextChargeDate } from '@/lib/subscriptions'
import { nextDueDate, monthlyEquivalent } from '@/lib/recurrence'
import { normalizeCategory, categoryMeta, commitmentTitle } from '@/lib/commitments'

const WEEKS_PER_MONTH = 4.345

// An item that represents ongoing money leaving the account: a confirmed, active subscription or
// mandate (not a trial, one-time, cancelled, expired, pending, or rejected). Mirrors computeGhostSpend.
function isActiveRecurring(s, now) {
  return (
    s &&
    s.status !== 'pending' &&
    s.status !== 'rejected' &&
    (s.kind === 'subscription' || s.kind === 'mandate' || (!s.kind && !s.is_trial)) &&
    getStatus(s, now) === 'active'
  )
}

function safeParse(str) {
  if (!str) return null
  try {
    const d = parseISO(str)
    return isNaN(d.getTime()) ? null : d
  } catch {
    return null
  }
}

// True for items that bill every month (explicit monthly, or a cycle-less standing mandate).
function isMonthlyLike(s) {
  return s.billing_cycle === 'monthly' || (!s.billing_cycle && s.kind === 'mandate')
}

// Per-month cash outflow for the next `months` months (current month first). Monthly/weekly subs
// contribute their run-rate to every month; an annual sub lands its full amount only in its renewal
// month (so that month spikes). Returns
// [{ key:'2026-07', label:'Jul', date, totalInr, total(displayCurrency), items:[{name,amountInr,date}] }].
export function upcomingChargesByMonth(subs, now = new Date(), months = 6, rates = null, currency = 'INR') {
  const baseMonth = startOfMonth(now)
  const buckets = []
  for (let i = 0; i < months; i++) {
    const d = addMonths(baseMonth, i)
    buckets.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM'), date: d, totalInr: 0, items: [] })
  }
  const horizonEnd = endOfMonth(buckets[buckets.length - 1].date)
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))
  const addTo = (bucket, s, amtInr, dateStr) => {
    bucket.totalInr += amtInr
    bucket.items.push({ name: s.service_name, amountInr: amtInr, date: dateStr })
  }

  for (const s of subs || []) {
    if (!isActiveRecurring(s, now)) continue
    const amtInr = toInr(s.amount, s.currency, rates)
    if (!amtInr) continue
    const cycle = s.billing_cycle

    if (isMonthlyLike(s)) {
      for (const b of buckets) addTo(b, s, amtInr, `${b.key}-01`)
    } else if (cycle === 'weekly') {
      for (const b of buckets) addTo(b, s, amtInr * WEEKS_PER_MONTH, `${b.key}-01`)
    } else if (cycle === 'annual') {
      let d = safeParse(effectiveNextChargeDate(s, now)) // rolled forward to ≥ today
      let guard = 0
      while (d && !isAfter(d, horizonEnd) && guard < 12) {
        const b = byKey[format(d, 'yyyy-MM')]
        if (b) addTo(b, s, amtInr, format(d, 'yyyy-MM-dd'))
        d = addYears(d, 1)
        guard += 1
      }
    } else {
      // cycle-less subscription: a single upcoming date
      const d = safeParse(effectiveNextChargeDate(s, now))
      if (d) {
        const b = byKey[format(d, 'yyyy-MM')]
        if (b) addTo(b, s, amtInr, format(d, 'yyyy-MM-dd'))
      }
    }
  }
  for (const b of buckets) {
    b.total = fromInr(b.totalInr, currency, rates)
    b.totalInr = Math.round(b.totalInr)
  }
  return buckets
}

// Unified chart series: real past months (from spend_snapshots, kind 'actual') + the current month
// (kind 'current') + projected upcoming months (kind 'projected'). Past months only appear once a
// snapshot exists for them, so the chart starts at "now" until history accrues.
export function spendTrend(snapshots, subs, now = new Date(), opts = {}) {
  const { past = 3, future = 6, rates = null, currency = 'INR' } = opts
  const snapByKey = {}
  for (const s of snapshots || []) {
    const d = safeParse(s.month)
    if (d) snapByKey[format(d, 'yyyy-MM')] = s
  }
  const series = []
  for (let i = past; i >= 1; i--) {
    const d = addMonths(startOfMonth(now), -i)
    const key = format(d, 'yyyy-MM')
    const snap = snapByKey[key]
    if (!snap) continue
    const totalInr = Math.round(Number(snap.monthly_total_inr) || 0)
    series.push({ key, label: format(d, 'MMM'), totalInr, total: fromInr(totalInr, currency, rates), kind: 'actual' })
  }
  const upcoming = upcomingChargesByMonth(subs, now, future, rates, currency)
  upcoming.forEach((b, idx) =>
    series.push({ ...b, kind: idx === 0 ? 'current' : 'projected', isNow: idx === 0 })
  )
  return series
}

// The soonest upcoming charge across active subs (and active trials, whose "charge" is the trial end).
// Returns { date, daysAway, items:[names], totalInr } or null.
export function nextCharge(subs, now = new Date(), rates = null) {
  const dateFor = (s) => {
    if (isActiveRecurring(s, now)) return effectiveNextChargeDate(s, now)
    if ((s.kind === 'trial' || s.is_trial) && getStatus(s, now) === 'active')
      return s.trial_end_date || s.next_charge_date || null
    return null
  }
  let bestStr = null
  let bestDate = null
  for (const s of subs || []) {
    const str = dateFor(s)
    const d = safeParse(str)
    if (!d || isBefore(d, startOfDay(now))) continue
    if (!bestDate || isBefore(d, bestDate)) {
      bestDate = d
      bestStr = str
    }
  }
  if (!bestDate) return null
  const items = []
  let totalInr = 0
  for (const s of subs || []) {
    if (dateFor(s) === bestStr) {
      items.push(s.service_name)
      totalInr += toInr(s.amount, s.currency, rates)
    }
  }
  return {
    date: bestStr,
    daysAway: differenceInCalendarDays(startOfDay(bestDate), startOfDay(now)),
    items,
    totalInr: Math.round(totalInr),
  }
}

// Map of day-of-month → charges, for the calendar of a given month (year, 0-indexed month).
// { 5: [{name, amountInr}], 16: [...] }. Recurring items repeat on their billing day.
export function chargeDaysInMonth(subs, year, month, now = new Date(), rates = null) {
  const monthStart = new Date(year, month, 1)
  const daysInMonth = getDate(endOfMonth(monthStart))
  const map = {}
  const add = (day, s, amtInr) => {
    const k = Math.min(Math.max(day, 1), daysInMonth)
    ;(map[k] = map[k] || []).push({ name: s.service_name, amountInr: amtInr })
  }
  for (const s of subs || []) {
    if (!isActiveRecurring(s, now)) continue
    const amtInr = toInr(s.amount, s.currency, rates)
    const anchor = safeParse(s.next_charge_date) || safeParse(s.charge_date)
    if (!anchor) continue
    const cycle = s.billing_cycle
    if (isMonthlyLike(s)) {
      add(getDate(anchor), s, amtInr)
    } else if (cycle === 'weekly') {
      const dow = anchor.getDay()
      for (let d = 1; d <= daysInMonth; d++) if (new Date(year, month, d).getDay() === dow) add(d, s, amtInr)
    } else if (cycle === 'annual') {
      if (anchor.getMonth() === month) add(getDate(anchor), s, amtInr)
    } else if (anchor.getFullYear() === year && anchor.getMonth() === month) {
      add(getDate(anchor), s, amtInr)
    }
  }
  return map
}

// Lightweight keyword → category mapping for the spend breakdown.
const CATEGORY_RULES = [
  ['Streaming', /netflix|hotstar|disney|prime\s*video|sony\s*liv|zee5|jiocinema|youtube|crunchyroll|hbo|max\b/i],
  ['Music', /spotify|apple\s*music|gaana|wynk|saavn|audible|soundcloud|tidal/i],
  ['AI & Tools', /claude|chatgpt|openai|anthropic|gemini|copilot|midjourney|perplexity|cursor/i],
  [
    'Productivity',
    /notion|figma|adobe|canva|microsoft|office|google\s*workspace|zoho|slack|loom|grammarly|dropbox|icloud|jira|atlassian/i,
  ],
  ['Food & Delivery', /swiggy|zomato|eatclub|blinkit|zepto|bigbasket|dunzo|kfc|dominos|healthfarm/i],
  ['Cloud & Hosting', /aws|amazon\s*web|google\s*cloud|gcp|azure|vercel|netlify|digitalocean|cloudflare|render/i],
  ['Finance & SIP', /sip|mutual\s*fund|etf|nps|fof|icici|hdfc|axis|groww|zerodha|kuvera/i],
  ['Fitness', /cult|gym|fitpass|healthify|curefit|fitness/i],
]

export function categorize(name) {
  const n = name || ''
  for (const [cat, re] of CATEGORY_RULES) if (re.test(n)) return cat
  return 'Other'
}

// Monthly-equivalent INR for fair category comparison (annual amortized, weekly ×4.345).
function monthlyInrFor(s, rates) {
  const amt = toInr(s.amount, s.currency, rates)
  if (s.billing_cycle === 'annual') return amt / 12
  if (s.billing_cycle === 'weekly') return amt * WEEKS_PER_MONTH
  return amt
}

// Spend grouped by category (monthly-equivalent INR), sorted high→low.
// Returns [{ category, totalInr, count }].
export function spendByCategory(subs, now = new Date(), rates = null) {
  const groups = {}
  for (const s of subs || []) {
    if (!isActiveRecurring(s, now)) continue
    const cat = categorize(s.service_name)
    const g = (groups[cat] = groups[cat] || { category: cat, totalInr: 0, count: 0 })
    g.totalInr += monthlyInrFor(s, rates)
    g.count += 1
  }
  return Object.values(groups)
    .map((g) => ({ ...g, totalInr: Math.round(g.totalInr) }))
    .sort((a, b) => b.totalInr - a.totalInr)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// v2 — "recurring financial commitments" (subscriptions are one category among rent/EMI/insurance/…)
// These helpers are recurrence-aware (handle quarterly/half-yearly that the legacy cycle vocabulary
// can't) and category-aware, and power the financial-overview dashboard.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// An active commitment: not pending/rejected/cancelled, not a trial, not a one-time payment.
function isActiveCommitment(s) {
  return (
    s &&
    s.status !== 'pending' &&
    s.status !== 'rejected' &&
    s.is_active !== false &&
    s.kind !== 'one_time' &&
    !(s.kind === 'trial' || s.is_trial)
  )
}

function commitmentAnchor(s) {
  return s.next_charge_date || s.charge_date || null
}

// Next due date (YYYY-MM-DD) for any commitment — prefers the flexible recurrence_rule, falls back to
// the legacy billing_cycle, then to the raw anchor.
export function commitmentNextDate(s, now = new Date()) {
  const rule = s.recurrence_rule || s.billing_cycle
  const anchor = commitmentAnchor(s)
  if (!anchor) return null
  if (rule) return nextDueDate(rule, anchor, now)
  return effectiveNextChargeDate(s, now) || anchor
}

// Monthly-equivalent INR for a commitment (recurrence-accurate; quarterly/half-yearly amortized).
function commitmentMonthlyInr(s, rates) {
  const rule = s.recurrence_rule || s.billing_cycle || 'monthly'
  return monthlyEquivalent(toInr(s.amount, s.currency, rates), rule)
}

// Headline totals for the overview: monthly + yearly commitment in display currency, and a count.
export function commitmentTotals(subs, now = new Date(), rates = null, currency = 'INR') {
  let monthlyInr = 0
  let count = 0
  for (const s of subs || []) {
    if (!isActiveCommitment(s)) continue
    monthlyInr += commitmentMonthlyInr(s, rates)
    count += 1
  }
  monthlyInr = Math.round(monthlyInr)
  return {
    count,
    monthlyInr,
    monthly: fromInr(monthlyInr, currency, rates),
    yearlyInr: monthlyInr * 12,
    yearly: fromInr(monthlyInr * 12, currency, rates),
  }
}

// Commitments due within `days` of now, soonest first → for "Upcoming This Week" etc.
// Returns { items:[{name, category, amountInr, amount, date, daysAway}], totalInr, total }.
export function upcomingWithin(subs, days = 7, now = new Date(), rates = null, currency = 'INR') {
  const items = []
  let totalInr = 0
  for (const s of subs || []) {
    if (!isActiveCommitment(s)) continue
    const d = safeParse(commitmentNextDate(s, now))
    if (!d) continue
    const daysAway = differenceInCalendarDays(startOfDay(d), startOfDay(now))
    if (daysAway < 0 || daysAway > days) continue
    const amountInr = toInr(s.amount, s.currency, rates)
    totalInr += amountInr
    items.push({
      name: commitmentTitle(s),
      category: normalizeCategory(s.category),
      amountInr,
      amount: fromInr(amountInr, currency, rates),
      date: format(d, 'yyyy-MM-dd'),
      daysAway,
    })
  }
  items.sort((a, b) => a.daysAway - b.daysAway)
  return { items, totalInr: Math.round(totalInr), total: fromInr(totalInr, currency, rates) }
}

// Group upcoming commitments into Today / Tomorrow / This Week / Later buckets (within `horizon` days).
export function timelineBuckets(subs, now = new Date(), rates = null, currency = 'INR', horizon = 60) {
  const { items } = upcomingWithin(subs, horizon, now, rates, currency)
  const buckets = { today: [], tomorrow: [], thisWeek: [], later: [] }
  for (const it of items) {
    if (it.daysAway === 0) buckets.today.push(it)
    else if (it.daysAway === 1) buckets.tomorrow.push(it)
    else if (it.daysAway <= 7) buckets.thisWeek.push(it)
    else buckets.later.push(it)
  }
  return buckets
}

// Commitments grouped by their v2 category (monthly-equivalent INR), high→low.
// Returns [{ category, label, count, monthlyInr, monthly, items:[{name, amountInr, date}] }].
export function groupByCategory(subs, now = new Date(), rates = null, currency = 'INR') {
  const groups = {}
  for (const s of subs || []) {
    if (!isActiveCommitment(s)) continue
    const cat = normalizeCategory(s.category)
    const g = (groups[cat] = groups[cat] || { category: cat, label: categoryMeta(cat).label, count: 0, monthlyInr: 0, items: [] })
    g.monthlyInr += commitmentMonthlyInr(s, rates)
    g.count += 1
    g.items.push({ name: commitmentTitle(s), amountInr: toInr(s.amount, s.currency, rates), date: commitmentNextDate(s, now) })
  }
  return Object.values(groups)
    .map((g) => ({ ...g, monthlyInr: Math.round(g.monthlyInr), monthly: fromInr(g.monthlyInr, currency, rates) }))
    .sort((a, b) => b.monthlyInr - a.monthlyInr)
}

// Trials ending within `days` → for the "Trials Ending Soon" insight card.
export function trialsEndingSoon(subs, now = new Date(), days = 7) {
  const items = []
  for (const s of subs || []) {
    if (!(s.kind === 'trial' || s.is_trial)) continue
    if (s.status === 'rejected' || s.is_active === false) continue
    const d = safeParse(s.trial_end_date || s.next_charge_date)
    if (!d) continue
    const daysAway = differenceInCalendarDays(startOfDay(d), startOfDay(now))
    if (daysAway < 0 || daysAway > days) continue
    items.push({ name: commitmentTitle(s), date: format(d, 'yyyy-MM-dd'), daysAway })
  }
  items.sort((a, b) => a.daysAway - b.daysAway)
  return { count: items.length, items }
}

// Savings from commitments the user has removed/cancelled — sum of their monthly-equivalent spend.
// Returns { count, monthlyInr, monthly, yearlyInr, yearly }. Drives the "you now save ₹X/yr" line.
export function savingsFromRemoved(subs, now = new Date(), rates = null, currency = 'INR') {
  let monthlyInr = 0
  let count = 0
  for (const s of subs || []) {
    const removed = s.is_active === false || s.cancelled === true || getStatus(s, now) === 'cancelled'
    if (!removed) continue
    if (s.kind === 'one_time' || s.kind === 'trial' || s.is_trial) continue
    if (s.status === 'rejected') continue
    monthlyInr += commitmentMonthlyInr(s, rates)
    count += 1
  }
  monthlyInr = Math.round(monthlyInr)
  return {
    count,
    monthlyInr,
    monthly: fromInr(monthlyInr, currency, rates),
    yearlyInr: monthlyInr * 12,
    yearly: fromInr(monthlyInr * 12, currency, rates),
  }
}

// Recent price changes from each row's price_history (latest entry per item), newest first.
// Returns [{ name, from, to, date, direction: 'up'|'down' }].
export function recentPriceChanges(subs, limit = 5) {
  const changes = []
  for (const s of subs || []) {
    const hist = Array.isArray(s.price_history) ? s.price_history : []
    if (!hist.length) continue
    const last = hist[hist.length - 1]
    if (last?.from == null || last?.to == null || last.from === last.to) continue
    changes.push({
      name: commitmentTitle(s),
      from: last.from,
      to: last.to,
      date: last.date || null,
      direction: last.to > last.from ? 'up' : 'down',
    })
  }
  changes.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  return changes.slice(0, limit)
}

// Split commitments by origin: `auto` = detected from Gmail (subscriptions/mandates/trials), `manual` =
// added by hand. Drives the Auto-pay vs Manual tabs. Anything not explicitly 'manual' is treated as auto.
export function splitBySource(subs) {
  const auto = []
  const manual = []
  for (const s of subs || []) {
    if (s?.source === 'manual') manual.push(s)
    else auto.push(s)
  }
  return { auto, manual }
}

// Summary of reminder lead-times across active subs: the most common value + a {days: count} map.
export function reminderSummary(subs, now = new Date()) {
  const counts = {}
  let total = 0
  for (const s of subs || []) {
    if (!isActiveRecurring(s, now)) continue
    const d = Number(s.reminder_days) || 3
    counts[d] = (counts[d] || 0) + 1
    total += 1
  }
  let mostCommon = 3
  let max = -1
  for (const [d, c] of Object.entries(counts)) {
    if (c > max) {
      max = c
      mostCommon = Number(d)
    }
  }
  return { mostCommon, counts, total }
}
