import { describe, it, expect } from 'vitest'
import { normalizeIndianPhone, validateManualSubscription, validateCommitment } from '@/lib/validation'

describe('normalizeIndianPhone', () => {
  it('accepts a bare 10-digit number', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('9876543210')
  })

  it('strips +91, spaces, and dashes', () => {
    expect(normalizeIndianPhone('+91 98765-43210')).toBe('9876543210')
    expect(normalizeIndianPhone('091-9876543210')).toBe('9876543210')
  })

  it('rejects too-short numbers', () => {
    expect(normalizeIndianPhone('12345')).toBeNull()
    expect(normalizeIndianPhone('')).toBeNull()
    expect(normalizeIndianPhone(null)).toBeNull()
  })
})

describe('validateManualSubscription', () => {
  it('accepts and coerces a valid payload', () => {
    const { valid, value } = validateManualSubscription({
      service_name: '  Netflix ',
      amount: '199',
      billing_cycle: 'monthly',
      next_charge_date: '2026-07-01',
      reminder_days: 7,
    })
    expect(valid).toBe(true)
    expect(value).toEqual({
      service_name: 'Netflix',
      amount: 199,
      billing_cycle: 'monthly',
      next_charge_date: '2026-07-01',
      reminder_days: 7,
    })
  })

  it('requires a service name and a valid date', () => {
    const r1 = validateManualSubscription({ next_charge_date: '2026-07-01' })
    expect(r1.valid).toBe(false)
    expect(r1.errors.join()).toMatch(/Service name/)

    const r2 = validateManualSubscription({ service_name: 'X', next_charge_date: '01-07-2026' })
    expect(r2.valid).toBe(false)
    expect(r2.errors.join()).toMatch(/renewal date/)
  })

  it('rejects a negative amount', () => {
    const r = validateManualSubscription({
      service_name: 'X',
      next_charge_date: '2026-07-01',
      amount: -5,
    })
    expect(r.valid).toBe(false)
    expect(r.errors.join()).toMatch(/positive/)
  })

  it('defaults reminder_days to 3 and nulls an unknown billing cycle', () => {
    const { value } = validateManualSubscription({
      service_name: 'X',
      next_charge_date: '2026-07-01',
      reminder_days: 5,
      billing_cycle: 'fortnightly',
    })
    expect(value.reminder_days).toBe(3)
    expect(value.billing_cycle).toBeNull()
  })

  it('treats an empty amount as null (optional field)', () => {
    const { valid, value } = validateManualSubscription({
      service_name: 'X',
      next_charge_date: '2026-07-01',
      amount: '',
    })
    expect(valid).toBe(true)
    expect(value.amount).toBeNull()
  })
})

// The manual-add forms (recurring commitment + one-time payment) both POST to /api/subscriptions/manual,
// which runs validateCommitment. These lock the exact contract the two frontend forms send.
describe('validateCommitment — manual add path', () => {
  it('accepts the recurring-commitment form payload (chosen reminder day kept)', () => {
    const { valid, value } = validateCommitment({
      service_name: 'Gym Membership',
      title: 'Gym Membership',
      amount: '1500',
      category: 'subscription',
      recurrence_rule: 'monthly',
      next_charge_date: '2026-07-10',
      reminder_days: 7,
    })
    expect(valid).toBe(true)
    expect(value).toMatchObject({
      service_name: 'Gym Membership',
      amount: 1500,
      recurrence_rule: 'monthly',
      billing_cycle: 'monthly',
      next_charge_date: '2026-07-10',
      reminder_days: 7,
    })
  })

  it('accepts the one-time payment form payload (date required, reminder defaults to 3)', () => {
    const { valid, value } = validateCommitment({
      service_name: 'New laptop',
      title: 'New laptop',
      amount: 85000,
      category: 'Other',
      next_charge_date: '2026-06-15',
      recurrence_rule: 'monthly', // ignored for one-time; route forces kind=one_time
      reminder_days: 3,
    })
    expect(valid).toBe(true)
    expect(value.amount).toBe(85000)
    expect(value.next_charge_date).toBe('2026-06-15')
    expect(value.reminder_days).toBe(3)
  })

  it('falls back to title when service_name is missing (Rent, Car EMI)', () => {
    const { valid, value } = validateCommitment({ title: 'Rent', next_charge_date: '2026-07-01', amount: 25000 })
    expect(valid).toBe(true)
    expect(value.service_name).toBe('Rent')
  })

  it('requires a name and a valid date', () => {
    const r1 = validateCommitment({ next_charge_date: '2026-07-01' })
    expect(r1.valid).toBe(false)
    expect(r1.errors.join()).toMatch(/name/i)

    const r2 = validateCommitment({ service_name: 'X', next_charge_date: 'nope' })
    expect(r2.valid).toBe(false)
    expect(r2.errors.join()).toMatch(/date/i)
  })

  it('coerces an unknown reminder day back to the default 3', () => {
    const { value } = validateCommitment({ service_name: 'X', next_charge_date: '2026-07-01', reminder_days: 5 })
    expect(value.reminder_days).toBe(3)
  })
})

describe('input hardening (length limits + non-object bodies)', () => {
  it('rejects an over-long service name (commitment)', () => {
    const { valid, errors } = validateCommitment({
      service_name: 'x'.repeat(121),
      next_charge_date: '2026-07-01',
    })
    expect(valid).toBe(false)
    expect(errors.join(' ')).toMatch(/too long/i)
  })

  it('rejects an over-long service name (manual subscription)', () => {
    const { valid } = validateManualSubscription({
      service_name: 'x'.repeat(200),
      next_charge_date: '2026-07-01',
    })
    expect(valid).toBe(false)
  })

  it('accepts a name at the 120-char limit', () => {
    const { valid } = validateCommitment({ service_name: 'x'.repeat(120), next_charge_date: '2026-07-01' })
    expect(valid).toBe(true)
  })

  it('rejects non-object bodies (array / null / string)', () => {
    for (const bad of [[], null, 'nope', 42]) {
      expect(validateCommitment(bad).valid).toBe(false)
      expect(validateManualSubscription(bad).valid).toBe(false)
    }
  })
})
