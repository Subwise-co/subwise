import { describe, it, expect } from 'vitest'
import {
  parseBody,
  budgetSchema,
  reminderDaysSchema,
  updateReminderSchema,
  statusSchema,
  optinSchema,
  registerSchema,
} from '@/lib/schemas'

const UUID = '11111111-2222-3333-4444-555555555555'

describe('parseBody + strict schemas', () => {
  it('rejects unexpected fields (mass-assignment guard)', () => {
    const r = parseBody(budgetSchema, { budget: 5000, is_admin: true })
    expect(r.ok).toBe(false)
  })

  it('rejects non-object bodies', () => {
    for (const bad of [null, [], 'x', 7]) {
      expect(parseBody(budgetSchema, bad).ok).toBe(false)
    }
  })

  it('budget: coerces numeric strings, enforces range', () => {
    expect(parseBody(budgetSchema, { budget: '5000' })).toEqual({ ok: true, value: { budget: 5000 } })
    expect(parseBody(budgetSchema, { budget: -1 }).ok).toBe(false)
    expect(parseBody(budgetSchema, { budget: 100_000_001 }).ok).toBe(false)
  })

  it('reminder days: only 1/3/7 allowed', () => {
    expect(parseBody(reminderDaysSchema, { days: 3 }).ok).toBe(true)
    expect(parseBody(reminderDaysSchema, { days: 5 }).ok).toBe(false)
  })

  it('update reminder: requires a valid uuid id', () => {
    expect(parseBody(updateReminderSchema, { id: UUID, reminder_days: 7 }).ok).toBe(true)
    expect(parseBody(updateReminderSchema, { id: 'not-a-uuid', reminder_days: 7 }).ok).toBe(false)
  })

  it('status: enum + optional dates in YYYY-MM-DD', () => {
    expect(parseBody(statusSchema, { id: UUID, status: 'confirmed' }).ok).toBe(true)
    expect(parseBody(statusSchema, { id: UUID, status: 'nope' }).ok).toBe(false)
    expect(parseBody(statusSchema, { id: UUID, status: 'confirmed', next_charge_date: '07/01/2026' }).ok).toBe(false)
  })

  it('optin: bounded phone string', () => {
    expect(parseBody(optinSchema, { phone: '9876543210' }).ok).toBe(true)
    expect(parseBody(optinSchema, { phone: '12' }).ok).toBe(false)
    expect(parseBody(optinSchema, { phone: 'x'.repeat(50) }).ok).toBe(false)
  })

  it('register: trims/lowercases email, enforces password + name lengths, rejects extras', () => {
    const ok = parseBody(registerSchema, { name: '  Jay  ', email: '  JAY@X.CO  ', password: 'longenough1' })
    expect(ok.ok).toBe(true)
    expect(ok.value.email).toBe('jay@x.co')
    expect(ok.value.name).toBe('Jay')
    expect(parseBody(registerSchema, { name: 'J', email: 'bad', password: 'longenough1' }).ok).toBe(false)
    expect(parseBody(registerSchema, { name: 'J', email: 'a@b.co', password: 'short' }).ok).toBe(false)
    expect(parseBody(registerSchema, { name: 'J', email: 'a@b.co', password: 'longenough1', hack: 1 }).ok).toBe(false)
  })
})
