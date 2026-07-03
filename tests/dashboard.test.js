import { describe, it, expect } from 'vitest'
import {
  upcomingChargesByMonth,
  spendTrend,
  nextCharge,
  chargeDaysInMonth,
  spendByCategory,
  categorize,
  reminderSummary,
} from '@/lib/dashboard'
import { MOCK_SUBS, MOCK_SNAPSHOTS, MOCK_TODAY } from '@/lib/dashboard-mock'

const NOW = MOCK_TODAY

describe('upcomingChargesByMonth', () => {
  it('returns one bucket per month starting at the current month', () => {
    const b = upcomingChargesByMonth(MOCK_SUBS, NOW, 6)
    expect(b).toHaveLength(6)
    expect(b[0].key).toBe('2026-06')
    expect(b[1].key).toBe('2026-07')
  })

  it('counts monthly subs every month at their run-rate', () => {
    // Netflix 649 + Spotify 119 + SIP 2000 + YouTube 149 + iCloud 75 = 2992 baseline.
    const b = upcomingChargesByMonth(MOCK_SUBS, NOW, 6)
    expect(b[0].totalInr).toBe(2992) // June baseline (no annual that month)
    expect(b[1].totalInr).toBe(2992) // July baseline
  })

  it('spikes the month an annual sub renews', () => {
    const b = upcomingChargesByMonth(MOCK_SUBS, NOW, 6)
    const aug = b.find((x) => x.key === '2026-08')
    const sep = b.find((x) => x.key === '2026-09')
    expect(aug.totalInr).toBe(2992 + 4500) // Udemy annual lands in August
    expect(sep.totalInr).toBe(2992 + 4230) // Adobe annual lands in September
  })

  it('excludes trials, one-time, cancelled and pending items', () => {
    const b = upcomingChargesByMonth(MOCK_SUBS, NOW, 6)
    const names = b.flatMap((x) => x.items.map((i) => i.name))
    expect(names).not.toContain('Claude Pro') // trial
    expect(names).not.toContain('KFC') // one_time
    expect(names).not.toContain('Jira') // cancelled
    expect(names).not.toContain('Disney+ Hotstar') // pending
  })

  it('converts the display total via rates', () => {
    const b = upcomingChargesByMonth(MOCK_SUBS, NOW, 6, null, 'USD')
    expect(b[0].total).toBeGreaterThan(0)
    expect(b[0].total).toBeLessThan(b[0].totalInr) // USD figure smaller than INR figure
  })
})

describe('spendTrend', () => {
  it('prepends past snapshots before the current/projected months', () => {
    const s = spendTrend(MOCK_SNAPSHOTS, MOCK_SUBS, NOW, { past: 3, future: 6 })
    expect(s[0]).toMatchObject({ key: '2026-04', kind: 'actual', totalInr: 2210 })
    expect(s[1]).toMatchObject({ key: '2026-05', kind: 'actual' })
    const current = s.find((x) => x.kind === 'current')
    expect(current.key).toBe('2026-06')
    expect(s.some((x) => x.kind === 'projected')).toBe(true)
  })

  it('starts at the current month when there are no snapshots', () => {
    const s = spendTrend([], MOCK_SUBS, NOW, { past: 3, future: 6 })
    expect(s[0].kind).toBe('current')
  })
})

describe('nextCharge', () => {
  it('finds the soonest upcoming charge (trial end counts)', () => {
    const nc = nextCharge(MOCK_SUBS, NOW)
    expect(nc.date).toBe('2026-06-29') // Claude Pro trial ends first
    expect(nc.items).toContain('Claude Pro')
    expect(nc.daysAway).toBe(3)
  })

  it('returns null when nothing is upcoming', () => {
    expect(nextCharge([], NOW)).toBeNull()
  })
})

describe('chargeDaysInMonth', () => {
  it('maps recurring billing days for July', () => {
    const map = chargeDaysInMonth(MOCK_SUBS, 2026, 6, NOW) // month 6 = July
    expect(map[5].map((i) => i.name)).toContain('Netflix') // 5th
    expect(map[2].map((i) => i.name)).toContain('Spotify') // 2nd
    expect(map[10].map((i) => i.name)).toContain('HDFC Silver ETF FoF SIP') // 10th
  })

  it('only shows an annual sub in its renewal month', () => {
    const julMap = chargeDaysInMonth(MOCK_SUBS, 2026, 6, NOW) // July
    const augMap = chargeDaysInMonth(MOCK_SUBS, 2026, 7, NOW) // August
    const julNames = Object.values(julMap).flat().map((i) => i.name)
    const augNames = Object.values(augMap).flat().map((i) => i.name)
    expect(julNames).not.toContain('Udemy Personal Plan')
    expect(augNames).toContain('Udemy Personal Plan')
  })
})

describe('categorize / spendByCategory', () => {
  it('maps known services to categories', () => {
    expect(categorize('Netflix')).toBe('Streaming')
    expect(categorize('Spotify')).toBe('Music')
    expect(categorize('Claude Pro')).toBe('AI & Tools')
    expect(categorize('HDFC Silver ETF FoF SIP')).toBe('Finance & SIP')
    expect(categorize('Something Unknown')).toBe('Other')
  })

  it('groups active spend by category, sorted high→low, monthly-equivalent', () => {
    const cats = spendByCategory(MOCK_SUBS, NOW)
    expect(cats[0].totalInr).toBeGreaterThanOrEqual(cats[cats.length - 1].totalInr)
    const finance = cats.find((c) => c.category === 'Finance & SIP')
    expect(finance.totalInr).toBe(2000) // SIP monthly
    const streaming = cats.find((c) => c.category === 'Streaming')
    expect(streaming.totalInr).toBe(649 + 149) // Netflix + YouTube
  })
})

describe('reminderSummary', () => {
  it('reports the most common reminder lead-time among active subs', () => {
    const r = reminderSummary(MOCK_SUBS, NOW)
    expect(r.mostCommon).toBe(3) // Netflix/Spotify/YouTube/iCloud = 3 days
    expect(r.total).toBe(7) // 7 active recurring subs
  })
})
