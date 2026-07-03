// Pure recurrence helpers for v2 "recurring financial commitments". Zero I/O → unit-tested, reused by
// the manual-reminder API, the Add-Reminder form, and the dashboard totals/timeline.
import { addDays, addWeeks, addMonths, addYears, parseISO, isBefore, format } from 'date-fns'

// Recurrence options offered in the Add-Reminder flow (key + label + months-per-period for amortization).
// `months` is the period length in months; weekly is special-cased; one_time has no period.
export const RECURRENCES = [
  { key: 'weekly', label: 'Weekly', months: null },
  { key: 'monthly', label: 'Monthly', months: 1 },
  { key: 'quarterly', label: 'Quarterly', months: 3 },
  { key: 'half_yearly', label: 'Half-yearly', months: 6 },
  { key: 'annual', label: 'Yearly', months: 12 },
  { key: 'one_time', label: 'One-time', months: null },
]
const RECURRENCE_KEYS = RECURRENCES.map((r) => r.key)
const WEEKS_PER_MONTH = 4.345

export function normalizeRecurrence(rule) {
  const r = String(rule || '').toLowerCase().trim()
  if (RECURRENCE_KEYS.includes(r)) return r
  if (/half|semi|6\s*month/.test(r)) return 'half_yearly'
  if (/quarter/.test(r)) return 'quarterly'
  if (/year|annual/.test(r)) return 'annual'
  if (/month/.test(r)) return 'monthly'
  if (/week/.test(r)) return 'weekly'
  if (/one|single|once/.test(r)) return 'one_time'
  return null
}

export function recurrenceLabel(rule) {
  const r = normalizeRecurrence(rule)
  return RECURRENCES.find((x) => x.key === r)?.label || 'Monthly'
}

// Map a recurrence to the legacy billing_cycle vocabulary (monthly|annual|weekly|null) so existing
// subscription/ghost-spend logic keeps working. Quarterly/half-yearly have no legacy cycle → null
// (the v2 dashboard totals use monthlyEquivalent() below, which IS period-accurate).
export function billingCycleFor(rule) {
  const r = normalizeRecurrence(rule)
  if (r === 'monthly' || r === 'annual' || r === 'weekly') return r
  return null
}

// Monthly-equivalent amount for a commitment (for "Monthly Commitment" totals). Annual/quarterly/etc.
// amortized to a per-month figure; one-time contributes 0 to a recurring total.
export function monthlyEquivalent(amount, rule) {
  const amt = Number(amount) || 0
  const r = normalizeRecurrence(rule)
  if (r === 'weekly') return amt * WEEKS_PER_MONTH
  if (r === 'one_time') return 0
  const months = RECURRENCES.find((x) => x.key === r)?.months || 1
  return amt / months
}

// Advance one period.
function addPeriod(date, rule) {
  const r = normalizeRecurrence(rule)
  if (r === 'weekly') return addWeeks(date, 1)
  if (r === 'annual') return addYears(date, 1)
  if (r === 'quarterly') return addMonths(date, 3)
  if (r === 'half_yearly') return addMonths(date, 6)
  if (r === 'monthly') return addMonths(date, 1)
  return null // one_time / unknown: no next occurrence
}

// Next due date (YYYY-MM-DD) for a commitment, rolling the anchor forward to today-or-later.
// Returns the anchor unchanged for one-time/unknown recurrences. `now` injectable for tests.
export function nextDueDate(rule, anchorISO, now = new Date()) {
  if (!anchorISO) return null
  let d
  try {
    d = parseISO(anchorISO)
  } catch {
    return anchorISO
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  if (normalizeRecurrence(rule) === 'one_time' || !addPeriod(d, rule)) return format(d, 'yyyy-MM-dd')
  let guard = 0
  while (isBefore(d, today) && guard < 600) {
    d = addPeriod(d, rule)
    guard += 1
  }
  return format(d, 'yyyy-MM-dd')
}
