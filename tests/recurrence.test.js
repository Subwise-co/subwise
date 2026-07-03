import { describe, it, expect } from 'vitest'
import {
  normalizeRecurrence,
  recurrenceLabel,
  billingCycleFor,
  monthlyEquivalent,
  nextDueDate,
  RECURRENCES,
} from '../lib/recurrence.js'
import {
  normalizeCategory,
  isValidCategory,
  categoryLabel,
  commitmentTitle,
  DEFAULT_CATEGORY,
} from '../lib/commitments.js'

describe('normalizeRecurrence', () => {
  it('passes through known keys', () => {
    for (const r of RECURRENCES) expect(normalizeRecurrence(r.key)).toBe(r.key)
  })
  it('maps fuzzy inputs', () => {
    expect(normalizeRecurrence('Yearly')).toBe('annual')
    expect(normalizeRecurrence('per month')).toBe('monthly')
    expect(normalizeRecurrence('every 3 months / quarter')).toBe('quarterly')
    expect(normalizeRecurrence('semi-annual')).toBe('half_yearly')
    expect(normalizeRecurrence('once')).toBe('one_time')
  })
  it('returns null for junk', () => {
    expect(normalizeRecurrence('blah')).toBeNull()
    expect(normalizeRecurrence(null)).toBeNull()
  })
})

describe('billingCycleFor (legacy mapping)', () => {
  it('maps the three legacy cycles, null otherwise', () => {
    expect(billingCycleFor('monthly')).toBe('monthly')
    expect(billingCycleFor('annual')).toBe('annual')
    expect(billingCycleFor('weekly')).toBe('weekly')
    expect(billingCycleFor('quarterly')).toBeNull()
    expect(billingCycleFor('half_yearly')).toBeNull()
    expect(billingCycleFor('one_time')).toBeNull()
  })
})

describe('monthlyEquivalent', () => {
  it('amortizes periods to a monthly figure', () => {
    expect(monthlyEquivalent(600, 'monthly')).toBe(600)
    expect(monthlyEquivalent(1200, 'annual')).toBe(100)
    expect(monthlyEquivalent(3000, 'quarterly')).toBe(1000)
    expect(monthlyEquivalent(6000, 'half_yearly')).toBe(1000)
    expect(monthlyEquivalent(100, 'weekly')).toBeCloseTo(434.5, 1)
    expect(monthlyEquivalent(5000, 'one_time')).toBe(0)
  })
  it('handles bad input', () => {
    expect(monthlyEquivalent(null, 'monthly')).toBe(0)
    expect(monthlyEquivalent('abc', 'monthly')).toBe(0)
  })
})

describe('nextDueDate', () => {
  const now = new Date('2026-06-27T10:00:00')
  it('rolls a past monthly anchor forward to today-or-later', () => {
    expect(nextDueDate('monthly', '2026-01-05', now)).toBe('2026-07-05')
  })
  it('rolls an annual anchor forward', () => {
    expect(nextDueDate('annual', '2024-03-10', now)).toBe('2027-03-10')
  })
  it('rolls quarterly forward', () => {
    expect(nextDueDate('quarterly', '2026-01-15', now)).toBe('2026-07-15')
  })
  it('leaves a future anchor untouched', () => {
    expect(nextDueDate('monthly', '2026-08-01', now)).toBe('2026-08-01')
  })
  it('returns the anchor unchanged for one-time', () => {
    expect(nextDueDate('one_time', '2026-01-01', now)).toBe('2026-01-01')
  })
  it('handles missing anchor', () => {
    expect(nextDueDate('monthly', null, now)).toBeNull()
  })
})

describe('recurrenceLabel', () => {
  it('labels known + falls back', () => {
    expect(recurrenceLabel('annual')).toBe('Yearly')
    expect(recurrenceLabel('weird')).toBe('Monthly')
  })
})

describe('commitment categories', () => {
  it('validates + normalizes', () => {
    expect(isValidCategory('rent')).toBe(true)
    expect(isValidCategory('nope')).toBe(false)
    expect(normalizeCategory('Credit Card')).toBe('credit_card')
    expect(normalizeCategory('garbage')).toBe(DEFAULT_CATEGORY)
  })
  it('labels + titles', () => {
    expect(categoryLabel('investment')).toBe('Investment / SIP')
    expect(commitmentTitle({ title: 'Flat rent' })).toBe('Flat rent')
    expect(commitmentTitle({ service_name: 'Netflix' })).toBe('Netflix')
    expect(commitmentTitle({ category: 'rent' })).toBe('Rent')
  })
})
