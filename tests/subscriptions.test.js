import { describe, it, expect } from 'vitest'
import {
  extractJsonArray,
  normalizeServiceKey,
  dedupeSubscriptions,
  computeGhostSpend,
  isAlertDueToday,
  getStatus,
  isExpiredWithin,
  groupSubscriptions,
  scanWindowDays,
  shouldAlertTrial,
  effectiveNextChargeDate,
  findMatchingSubscription,
} from '@/lib/subscriptions'

describe('extractJsonArray', () => {
  it('parses a clean JSON array', () => {
    expect(extractJsonArray('[{"service_name":"Netflix"}]')).toEqual([
      { service_name: 'Netflix' },
    ])
  })

  it('extracts the array embedded in surrounding prose', () => {
    const text = 'Here you go:\n[{"service_name":"Spotify"}]\nHope that helps!'
    expect(extractJsonArray(text)).toEqual([{ service_name: 'Spotify' }])
  })

  it('returns [] for malformed JSON instead of throwing', () => {
    expect(extractJsonArray('[{"service_name": Netflix]')).toEqual([])
  })

  it('returns [] when there is no array', () => {
    expect(extractJsonArray('no subscriptions found')).toEqual([])
    expect(extractJsonArray('')).toEqual([])
    expect(extractJsonArray(null)).toEqual([])
  })

  it('returns [] when the JSON is not an array', () => {
    expect(extractJsonArray('{"a":1}')).toEqual([])
  })
})

describe('normalizeServiceKey', () => {
  it('lowercases and strips whitespace', () => {
    expect(normalizeServiceKey('Netflix India')).toBe('netflixindia')
    expect(normalizeServiceKey('  Spotify  ')).toBe('spotify')
    expect(normalizeServiceKey(undefined)).toBe('')
  })
})

describe('dedupeSubscriptions', () => {
  it('drops case/whitespace duplicates, keeping the first occurrence', () => {
    const out = dedupeSubscriptions([
      { service_name: 'Netflix', amount: 199 },
      { service_name: 'netflix', amount: 499 },
      { service_name: 'Spotify' },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ service_name: 'Netflix', amount: 199 })
    expect(out[1]).toEqual({ service_name: 'Spotify' })
  })

  it('skips entries without a service name and tolerates empty input', () => {
    expect(dedupeSubscriptions([{ amount: 100 }, { service_name: '' }])).toEqual([])
    expect(dedupeSubscriptions(null)).toEqual([])
  })

  it('merges fields across duplicates (fills missing data from later copies)', () => {
    const out = dedupeSubscriptions([
      { service_name: 'HDFC Silver ETF SIP', amount: 2500, billing_cycle: 'monthly' },
      { service_name: 'HDFC Silver ETF SIP', next_charge_date: '2026-06-16' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].amount).toBe(2500)
    expect(out[0].next_charge_date).toBe('2026-06-16') // filled from the second copy
  })

  it('fuzzy-merges name variants of the same fund, keeps the longer name', () => {
    const out = dedupeSubscriptions([
      { service_name: 'HDFC Silver ETF FoF SIP', amount: 2500 },
      { service_name: 'HDFC Silver ETF FoF Direct Growth SIP', next_charge_date: '2026-07-16' },
    ])
    expect(out).toHaveLength(1)
    expect(out[0].service_name).toBe('HDFC Silver ETF FoF Direct Growth SIP') // longer wins
    expect(out[0].amount).toBe(2500)
    expect(out[0].next_charge_date).toBe('2026-07-16')
  })

  it('merges "Netflix" with "Netflix India" (subset)', () => {
    expect(dedupeSubscriptions([{ service_name: 'Netflix' }, { service_name: 'Netflix India' }])).toHaveLength(1)
  })

  it('keeps different funds separate (HDFC vs ICICI)', () => {
    const out = dedupeSubscriptions([
      { service_name: 'HDFC Silver ETF FoF Direct Growth SIP' },
      { service_name: 'ICICI Prudential Multi Asset Fund Direct Growth SIP' },
    ])
    expect(out).toHaveLength(2)
  })

  // Regression: the model emits different name variants of the SAME fund across emails; these must
  // collapse to one row (previously they created duplicates because "fof" vs "fund of funds" etc.
  // dropped the Jaccard overlap below threshold).
  it('merges name variants of the same SIP fund (the HDFC/ICICI duplicate bug)', () => {
    const hdfc = dedupeSubscriptions([
      { service_name: 'HDFC Silver ETF FoF', amount: 2500 },
      { service_name: 'HDFC Silver ETF Fund of Funds Direct Growth', next_charge_date: '2026-07-10' },
    ])
    expect(hdfc).toHaveLength(1)

    const icici = dedupeSubscriptions([
      { service_name: 'ICICI Prudential Silver ETF FoF' },
      { service_name: 'ICICI Pru Silver ETF Fund of Fund Direct' },
    ])
    expect(icici).toHaveLength(1)

    // ...and a mixed batch of all four variants → exactly two funds.
    expect(
      dedupeSubscriptions([
        { service_name: 'HDFC Silver ETF FoF' },
        { service_name: 'HDFC Silver ETF Fund of Funds Direct Growth' },
        { service_name: 'ICICI Prudential Silver ETF FoF' },
        { service_name: 'ICICI Pru Silver ETF Fund of Fund Direct' },
      ])
    ).toHaveLength(2)
  })

  it('does NOT over-merge genuinely different funds from the same house (silver vs gold)', () => {
    expect(
      dedupeSubscriptions([
        { service_name: 'HDFC Silver ETF FoF' },
        { service_name: 'HDFC Gold ETF FoF' },
      ])
    ).toHaveLength(2)
  })

  // Regression: the same Facebook e-mandate arrived under different legal-name truncations and must
  // collapse to ONE row (the bank-named copy is handled separately by the parser's bank-only guard).
  it('merges merchant legal-name variants (the Facebook triple-mandate bug)', () => {
    expect(
      dedupeSubscriptions([
        { service_name: 'FACEBOOK INDIA ONLINE SE' },
        { service_name: 'FACEBOOK INDIA ONLINE SERVICES PRIVATE LIMITED' },
        { service_name: 'Facebook' },
      ])
    ).toHaveLength(1)
  })
})

describe('findMatchingSubscription (dedupe-on-write across scan batches)', () => {
  const rows = [
    { id: 'a', service_name: 'HDFC Silver ETF FoF SIP' },
    { id: 'b', service_name: 'ICICI Prudential Multi Asset Fund SIP' },
  ]
  it('matches a name variant of the same fund', () => {
    expect(findMatchingSubscription(rows, 'HDFC Silver ETF FoF Direct Growth SIP')?.id).toBe('a')
  })
  it('returns null for a genuinely different service', () => {
    expect(findMatchingSubscription(rows, 'Netflix')).toBeNull()
  })
  it('returns null on empty inputs', () => {
    expect(findMatchingSubscription([], 'Netflix')).toBeNull()
    expect(findMatchingSubscription(rows, '')).toBeNull()
  })
})

describe('computeGhostSpend', () => {
  it('amortizes annual subscriptions into the monthly total', () => {
    const res = computeGhostSpend([
      { amount: 200, billing_cycle: 'monthly' },
      { amount: 1200, billing_cycle: 'annual' }, // 100/mo
    ])
    expect(res.monthlyTotal).toBe(300)
    expect(res.yearlyTotal).toBe(3600)
    expect(res.count).toBe(2)
  })

  it('treats missing/non-numeric amounts as zero', () => {
    const res = computeGhostSpend([{ billing_cycle: 'monthly' }, { amount: 'abc' }])
    expect(res.monthlyTotal).toBe(0)
    expect(res.count).toBe(2)
  })

  it('handles empty input', () => {
    expect(computeGhostSpend([])).toMatchObject({ monthlyTotal: 0, yearlyTotal: 0, count: 0 })
    expect(computeGhostSpend()).toMatchObject({ monthlyTotal: 0, yearlyTotal: 0, count: 0 })
  })
})

describe('isAlertDueToday', () => {
  it('is true when today is exactly daysBefore ahead of the charge date', () => {
    const now = new Date('2026-06-18T09:00:00+05:30')
    expect(isAlertDueToday('2026-06-21', 3, now)).toBe(true) // 21 - 3 = 18
  })

  it('is false on other days', () => {
    const now = new Date('2026-06-18T09:00:00+05:30')
    expect(isAlertDueToday('2026-06-21', 7, now)).toBe(false)
    expect(isAlertDueToday('2026-06-25', 3, now)).toBe(false)
  })

  it('is false for missing/invalid dates', () => {
    expect(isAlertDueToday(null, 3, new Date())).toBe(false)
    expect(isAlertDueToday('not-a-date', 3, new Date())).toBe(false)
  })
})

describe('scanWindowDays', () => {
  const now = new Date('2026-06-19T12:00:00+05:30')
  it('returns 90 for a first scan (never scanned)', () => {
    expect(scanWindowDays(null, now)).toBe(90)
  })
  it('caps every re-scan at 7 days (recent scan)', () => {
    expect(scanWindowDays('2026-06-18T12:00:00+05:30', now)).toBe(7)
  })
  it('caps every re-scan at 7 days — no 90-day redo even after a long gap', () => {
    expect(scanWindowDays('2025-01-01T00:00:00+05:30', now)).toBe(7)
  })
})

describe('shouldAlertTrial', () => {
  const now = new Date('2026-07-02T10:00:00Z')
  it('alerts for a trial ending in the future', () => {
    expect(shouldAlertTrial({ trial_end_date: '2026-07-04' }, now)).toBe(true)
  })
  it('alerts for a trial ending today', () => {
    expect(shouldAlertTrial({ trial_end_date: '2026-07-02' }, now)).toBe(true)
  })
  it('does NOT alert for a trial that already ended', () => {
    expect(shouldAlertTrial({ trial_end_date: '2026-06-28' }, now)).toBe(false)
  })
  it('falls back to next_charge_date, and skips when no date is known', () => {
    expect(shouldAlertTrial({ next_charge_date: '2026-07-10' }, now)).toBe(true)
    expect(shouldAlertTrial({}, now)).toBe(false)
  })
})

describe('effectiveNextChargeDate', () => {
  const now = new Date('2026-06-19T12:00:00+05:30')
  it('rolls a monthly date that already passed this month to next month', () => {
    expect(
      effectiveNextChargeDate({ billing_cycle: 'monthly', next_charge_date: '2026-06-16' }, now)
    ).toBe('2026-07-16')
  })
  it('rolls an annual date forward a year', () => {
    expect(
      effectiveNextChargeDate({ billing_cycle: 'annual', next_charge_date: '2025-04-16' }, now)
    ).toBe('2027-04-16')
  })
  it('leaves a future date unchanged', () => {
    expect(
      effectiveNextChargeDate({ billing_cycle: 'monthly', next_charge_date: '2026-06-25' }, now)
    ).toBe('2026-06-25')
  })
  it('returns null when there is no date', () => {
    expect(effectiveNextChargeDate({ billing_cycle: 'monthly' }, now)).toBeNull()
  })
})

describe('getStatus', () => {
  const now = new Date('2026-06-19T12:00:00+05:30')
  it('keeps a monthly subscription active even when this month’s date has passed', () => {
    expect(
      getStatus({ kind: 'subscription', billing_cycle: 'monthly', next_charge_date: '2026-06-16' }, now)
    ).toBe('active')
  })
  it('marks a cycle-less subscription with a past date as expired', () => {
    expect(getStatus({ kind: 'subscription', next_charge_date: '2026-05-01' }, now)).toBe('expired')
  })
  it('marks a future trial as active', () => {
    expect(getStatus({ kind: 'trial', trial_end_date: '2026-06-25' }, now)).toBe('active')
  })
  it('always reports one_time as completed', () => {
    expect(getStatus({ kind: 'one_time', charge_date: '2026-01-01' }, now)).toBe('completed')
  })
  it('keeps a mandate active even when its start/charge date is in the past', () => {
    expect(getStatus({ kind: 'mandate', next_charge_date: '2026-06-18', charge_date: '2026-06-18' }, now)).toBe('active')
  })
  it('treats unknown dates as active (not hidden)', () => {
    expect(getStatus({ kind: 'subscription' }, now)).toBe('active')
  })
  it('reports a cancelled subscription as cancelled (via cancelled flag or is_active=false)', () => {
    expect(getStatus({ kind: 'subscription', cancelled: true, billing_cycle: 'monthly' }, now)).toBe('cancelled')
    expect(getStatus({ kind: 'subscription', is_active: false, next_charge_date: '2026-07-01' }, now)).toBe('cancelled')
  })
})

describe('isExpiredWithin', () => {
  const now = new Date('2026-06-18T12:00:00+05:30')
  it('is true when ended within the window', () => {
    expect(isExpiredWithin({ kind: 'trial', trial_end_date: '2026-05-12' }, 90, now)).toBe(true)
  })
  it('is false when ended longer ago than the window', () => {
    expect(isExpiredWithin({ kind: 'trial', trial_end_date: '2026-01-01' }, 90, now)).toBe(false)
  })
  it('is false for a future (not-yet-expired) date', () => {
    expect(isExpiredWithin({ kind: 'subscription', next_charge_date: '2026-07-01' }, 90, now)).toBe(
      false
    )
  })
})

describe('groupSubscriptions', () => {
  const now = new Date('2026-06-18T12:00:00+05:30')
  const items = [
    { id: 1, kind: 'subscription', status: 'confirmed', next_charge_date: '2026-07-01' }, // active
    { id: 2, kind: 'trial', status: 'confirmed', trial_end_date: '2026-05-12' }, // expired ~37d ago
    { id: 3, kind: 'trial', status: 'confirmed', trial_end_date: '2026-01-01' }, // expired >90d → dropped
    { id: 4, kind: 'one_time', status: 'confirmed', charge_date: '2026-04-29' }, // single payment
    { id: 5, kind: 'mandate', status: 'confirmed', next_charge_date: '2026-08-01' }, // active
    { id: 6, kind: 'subscription', status: 'pending', next_charge_date: '2026-09-01' }, // needs confirmation
    { id: 7, kind: 'subscription', status: 'rejected', next_charge_date: '2026-09-01' }, // excluded
    { id: 8, kind: 'subscription', status: 'confirmed', cancelled: true, billing_cycle: 'monthly' }, // cancelled
  ]
  it('splits into pending, active, singlePayments, cancelled, recent expired; drops rejected and stale', () => {
    const { pending, active, singlePayments, cancelled, expired } = groupSubscriptions(items, now)
    expect(pending.map((s) => s.id)).toEqual([6])
    expect(active.map((s) => s.id).sort()).toEqual([1, 5])
    expect(singlePayments.map((s) => s.id)).toEqual([4])
    expect(cancelled.map((s) => s.id)).toEqual([8])
    expect(expired.map((s) => s.id)).toEqual([2]) // id 3 dropped (>90d), id 7 rejected
  })
})

describe('computeGhostSpend — kind/status aware', () => {
  const now = new Date('2026-06-18T12:00:00+05:30')
  it('counts only active subscriptions + mandates, excluding trials/one-time/expired', () => {
    const res = computeGhostSpend(
      [
        { kind: 'subscription', amount: 200, billing_cycle: 'monthly', next_charge_date: '2026-07-01' },
        { kind: 'mandate', amount: 1200, billing_cycle: 'annual', next_charge_date: '2026-12-01' }, // 100/mo
        { kind: 'trial', amount: 999, trial_end_date: '2026-07-01' }, // excluded (trial)
        { kind: 'one_time', amount: 500, charge_date: '2026-06-01' }, // excluded (one-time)
        { kind: 'subscription', amount: 300, next_charge_date: '2026-05-01' }, // excluded (cycle-less, expired)
      ],
      now
    )
    expect(res.monthlyTotal).toBe(300) // 200 + 100
    expect(res.count).toBe(2)
  })

  it('converts non-INR amounts to INR before summing', () => {
    const res = computeGhostSpend(
      [
        { kind: 'subscription', amount: 100, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-01' },
        { kind: 'subscription', amount: 20, currency: 'USD', billing_cycle: 'monthly', next_charge_date: '2026-07-01' },
      ],
      now
    )
    expect(res.monthlyTotal).toBe(100 + 20 * 94) // USD converted at default static rate
  })

  it('shows the total in the display currency (by location), keeping monthlyInr for thresholds', () => {
    const subs = [
      { kind: 'subscription', amount: 9400, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-01' },
    ]
    const rates = { USD: 94, INR: 1 }
    const inr = computeGhostSpend(subs, now, rates) // default INR
    expect(inr.monthlyTotal).toBe(9400)
    expect(inr.currency).toBe('INR')

    const usd = computeGhostSpend(subs, now, rates, 'USD') // US visitor
    expect(usd.currency).toBe('USD')
    expect(usd.monthlyTotal).toBeCloseTo(100) // 9400 INR / 94
    expect(usd.monthlyInr).toBe(9400) // INR-equivalent preserved
  })
})
