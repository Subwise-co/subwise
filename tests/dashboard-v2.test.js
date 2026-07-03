import { describe, it, expect } from 'vitest'
import {
  commitmentNextDate,
  commitmentTotals,
  upcomingWithin,
  timelineBuckets,
  groupByCategory,
  trialsEndingSoon,
  savingsFromRemoved,
  recentPriceChanges,
  splitBySource,
} from '../lib/dashboard.js'

const NOW = new Date('2026-06-27T10:00:00')

// A realistic mix of v2 commitments.
const SUBS = [
  { service_name: 'Netflix', category: 'subscription', amount: 649, currency: 'INR', billing_cycle: 'monthly', recurrence_rule: 'monthly', next_charge_date: '2026-07-01', status: 'confirmed', is_active: true },
  { title: 'Flat rent', service_name: 'Flat rent', category: 'rent', amount: 28000, currency: 'INR', billing_cycle: 'monthly', recurrence_rule: 'monthly', next_charge_date: '2026-06-28', status: 'confirmed', is_active: true },
  { title: 'Health insurance', service_name: 'Health insurance', category: 'insurance', amount: 12000, currency: 'INR', recurrence_rule: 'annual', billing_cycle: 'annual', next_charge_date: '2026-07-10', status: 'confirmed', is_active: true },
  { service_name: 'Old Gym', category: 'subscription', amount: 1000, currency: 'INR', billing_cycle: 'monthly', recurrence_rule: 'monthly', next_charge_date: '2026-05-01', status: 'confirmed', is_active: false },
  { service_name: 'Claude Pro', category: 'subscription', kind: 'trial', is_trial: true, amount: 1990, currency: 'INR', trial_end_date: '2026-06-29', status: 'confirmed', is_active: true },
]

describe('commitmentNextDate', () => {
  it('rolls forward via recurrence_rule', () => {
    expect(commitmentNextDate({ recurrence_rule: 'monthly', next_charge_date: '2026-01-15' }, NOW)).toBe('2026-07-15')
  })
  it('handles quarterly (no legacy cycle)', () => {
    expect(commitmentNextDate({ recurrence_rule: 'quarterly', next_charge_date: '2026-01-10' }, NOW)).toBe('2026-07-10')
  })
})

describe('commitmentTotals', () => {
  it('amortizes annual to monthly and excludes trial/inactive', () => {
    const t = commitmentTotals(SUBS, NOW)
    // 649 + 28000 + (12000/12 = 1000) = 29649 ; Old Gym inactive + Claude trial excluded
    expect(t.monthlyInr).toBe(29649)
    expect(t.count).toBe(3)
    expect(t.yearlyInr).toBe(29649 * 12)
  })
})

describe('upcomingWithin', () => {
  it('lists active commitments due within N days, soonest first', () => {
    const u = upcomingWithin(SUBS, 7, NOW)
    const names = u.items.map((i) => i.name)
    expect(names).toContain('Flat rent') // due 28 Jun
    expect(names).toContain('Netflix') // due 1 Jul
    expect(names).not.toContain('Health insurance') // due 10 Jul = 13 days away → outside the 7-day window
    expect(u.items[0].daysAway).toBeLessThanOrEqual(u.items[u.items.length - 1].daysAway)
  })
})

describe('timelineBuckets', () => {
  it('buckets by proximity', () => {
    const b = timelineBuckets(SUBS, NOW)
    const all = [...b.today, ...b.tomorrow, ...b.thisWeek, ...b.later].map((i) => i.name)
    expect(all).toContain('Flat rent')
    expect(all).toContain('Health insurance') // within 60-day horizon
  })
})

describe('groupByCategory', () => {
  it('groups active commitments by v2 category, high→low', () => {
    const g = groupByCategory(SUBS, NOW)
    const cats = g.map((x) => x.category)
    expect(cats).toContain('rent')
    expect(cats).toContain('subscription')
    expect(cats).toContain('insurance')
    expect(cats).not.toContain(undefined)
    // rent (28000) should be the biggest monthly group
    expect(g[0].category).toBe('rent')
  })
})

describe('trialsEndingSoon', () => {
  it('finds the Claude trial ending in 2 days', () => {
    const t = trialsEndingSoon(SUBS, NOW, 7)
    expect(t.count).toBe(1)
    expect(t.items[0].name).toBe('Claude Pro')
    expect(t.items[0].daysAway).toBe(2)
  })
})

describe('savingsFromRemoved', () => {
  it('sums monthly-equivalent of removed commitments', () => {
    const s = savingsFromRemoved(SUBS, NOW)
    expect(s.count).toBe(1) // Old Gym
    expect(s.monthlyInr).toBe(1000)
    expect(s.yearlyInr).toBe(12000)
  })
})

describe('splitBySource', () => {
  it('separates manual from gmail-detected (auto)', () => {
    const { auto, manual } = splitBySource([
      { service_name: 'Netflix', source: 'gmail' },
      { title: 'Rent', source: 'manual' },
      { service_name: 'Spotify' }, // no source → treated as auto
    ])
    expect(auto.map((s) => s.service_name || s.title)).toEqual(['Netflix', 'Spotify'])
    expect(manual.map((s) => s.title)).toEqual(['Rent'])
  })
  it('handles empty/nullish', () => {
    expect(splitBySource(null)).toEqual({ auto: [], manual: [] })
  })
})

describe('recentPriceChanges', () => {
  it('surfaces the latest change per item, newest first', () => {
    const rows = [
      { service_name: 'Netflix', price_history: [{ date: '2026-03-01', from: 499, to: 649 }] },
      { service_name: 'Spotify', price_history: [{ date: '2026-06-01', from: 119, to: 149 }] },
      { service_name: 'Nochange', price_history: [{ date: '2026-01-01', from: 100, to: 100 }] },
      { service_name: 'Empty' },
    ]
    const c = recentPriceChanges(rows)
    expect(c).toHaveLength(2)
    expect(c[0].name).toBe('Spotify') // newest date first
    expect(c[0].direction).toBe('up')
    expect(c.find((x) => x.name === 'Netflix').from).toBe(499)
  })
})
