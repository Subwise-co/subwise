// Strict request-body schemas for the simple, well-defined write endpoints. Each uses `.strict()` so
// UNEXPECTED fields are rejected (defence against mass-assignment / probing), enforces types, length
// limits, and value ranges. Pair with `parseBody()` for a graceful { ok, value | error } result.
//
// The commitment endpoints (manual add / edit) use the richer `validateCommitment()` in lib/validation
// instead, because their payloads vary by form — but those routes also build explicit DB rows (never
// spread the raw body), so unknown fields can never reach the database there either.
import { z } from 'zod'

const reminderDays = z.coerce
  .number()
  .int()
  .refine((v) => [1, 3, 7].includes(v), { message: 'reminder_days must be 1, 3, or 7' })
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format')
const uuid = z.string().uuid('invalid id')
const money = z.coerce.number().min(0, 'must be ≥ 0').max(100_000_000, 'value is too large')

export const budgetSchema = z.object({ budget: money }).strict()

export const reminderDaysSchema = z.object({ days: reminderDays }).strict()

export const updateReminderSchema = z.object({ id: uuid, reminder_days: reminderDays }).strict()

export const statusSchema = z
  .object({
    id: uuid,
    status: z.enum(['confirmed', 'rejected']),
    trial_end_date: isoDate.optional(),
    next_charge_date: isoDate.optional(),
  })
  .strict()

export const optinSchema = z.object({ phone: z.string().min(6, 'invalid phone').max(20, 'invalid phone') }).strict()

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Please enter your name').max(80, 'Name is too long'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254, 'Email is too long'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(200, 'Password is too long'),
  })
  .strict()

// Parse a body against a schema. Returns { ok:true, value } or { ok:false, error } (first message).
// Also rejects non-object bodies (arrays/null/primitives) cleanly.
export function parseBody(schema, body) {
  const result = schema.safeParse(body)
  if (result.success) return { ok: true, value: result.data }
  return { ok: false, error: result.error.issues[0]?.message || 'Invalid input' }
}
