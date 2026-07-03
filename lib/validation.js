// Pure input-validation helpers for API routes. No dependencies, fully unit-tested.
import { normalizeCategory, isValidCategory, DEFAULT_CATEGORY } from '@/lib/commitments'
import { normalizeRecurrence, billingCycleFor } from '@/lib/recurrence'

const BILLING_CYCLES = ['monthly', 'annual', 'weekly']
const REMINDER_DAYS = [1, 3, 7]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_NAME_LEN = 120 // length cap on stored names/titles — prevents storage abuse / oversized rows

// Reject anything that isn't a plain object (arrays, null, primitives) before field-level checks.
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

// Normalize an Indian mobile number to its 10 significant digits, or null if invalid.
export function normalizeIndianPhone(input) {
  const digits = (input ?? '').toString().replace(/\D/g, '').slice(-10)
  return digits.length === 10 ? digits : null
}

// Validate + coerce a manual-subscription payload.
// Returns { valid, errors: string[], value }.
export function validateManualSubscription(payload = {}) {
  const errors = []
  if (!isPlainObject(payload)) return { valid: false, errors: ['Invalid request body'], value: {} }

  const service_name =
    typeof payload.service_name === 'string' ? payload.service_name.trim() : ''
  if (!service_name) errors.push('Service name is required')
  else if (service_name.length > MAX_NAME_LEN) errors.push(`Service name is too long (max ${MAX_NAME_LEN})`)

  const next_charge_date = payload.next_charge_date
  if (!next_charge_date || !DATE_RE.test(String(next_charge_date))) {
    errors.push('A valid renewal date (YYYY-MM-DD) is required')
  }

  let amount = null
  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
    const n = Number(payload.amount)
    if (Number.isNaN(n) || n < 0) errors.push('Amount must be a positive number')
    else amount = n
  }

  const billing_cycle = BILLING_CYCLES.includes(payload.billing_cycle)
    ? payload.billing_cycle
    : null

  const reminder_days = REMINDER_DAYS.includes(Number(payload.reminder_days))
    ? Number(payload.reminder_days)
    : 3

  return {
    valid: errors.length === 0,
    errors,
    value: { service_name, amount, billing_cycle, next_charge_date, reminder_days },
  }
}

// Validate + coerce a v2 "recurring financial commitment" payload (the generalized manual reminder).
// Accepts any category (subscription/rent/utility/credit_card/insurance/investment/loan/custom), a
// flexible recurrence, and a reminder offset. Title OR service_name identifies it.
// Returns { valid, errors, value } where value is ready to upsert into `subscriptions`.
export function validateCommitment(payload = {}) {
  const errors = []
  if (!isPlainObject(payload)) return { valid: false, errors: ['Invalid request body'], value: {} }

  const category = isValidCategory(payload.category) ? normalizeCategory(payload.category) : DEFAULT_CATEGORY

  const title = typeof payload.title === 'string' ? payload.title.trim() : ''
  const rawName = typeof payload.service_name === 'string' ? payload.service_name.trim() : ''
  // Identify by service_name; fall back to the title so non-merchant reminders (Rent, Car EMI) work.
  const service_name = rawName || title
  if (!service_name) errors.push('A name is required')
  else if (service_name.length > MAX_NAME_LEN) errors.push(`Name is too long (max ${MAX_NAME_LEN})`)
  if (title.length > MAX_NAME_LEN) errors.push(`Title is too long (max ${MAX_NAME_LEN})`)

  const next_charge_date = payload.next_charge_date
  if (!next_charge_date || !DATE_RE.test(String(next_charge_date))) {
    errors.push('A valid date (YYYY-MM-DD) is required')
  }

  let amount = null
  if (payload.amount !== undefined && payload.amount !== null && payload.amount !== '') {
    const n = Number(payload.amount)
    if (Number.isNaN(n) || n < 0) errors.push('Amount must be a positive number')
    else amount = n
  }

  const recurrence_rule = normalizeRecurrence(payload.recurrence_rule) || 'monthly'
  // Keep billing_cycle in sync for legacy ghost-spend/calendar logic (null for quarterly/half-yearly).
  const billing_cycle = billingCycleFor(recurrence_rule)

  const reminder_days = REMINDER_DAYS.includes(Number(payload.reminder_days))
    ? Number(payload.reminder_days)
    : 3

  return {
    valid: errors.length === 0,
    errors,
    value: { service_name, title: title || null, category, amount, recurrence_rule, billing_cycle, next_charge_date, reminder_days },
  }
}
