import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the provider boundary (lib/llm) so these tests are deterministic, offline, and
// provider-agnostic. mockState is hoisted so the vi.mock factory can close over it.
const mockState = vi.hoisted(() => ({ text: '[]', prompts: [], shouldThrow: false }))

vi.mock('@/lib/llm', () => ({
  generateText: vi.fn(async (prompt, meta = {}) => {
    mockState.prompts.push(prompt)
    if (mockState.shouldThrow) throw new Error('all providers failed')
    meta.provider = 'mock'
    return mockState.text
  }),
}))

import { parseSubscriptions, isBankOnlyName } from '@/lib/parser'

describe('isBankOnlyName (mandate must name the merchant, not the bank)', () => {
  it('flags bank-only names', () => {
    expect(isBankOnlyName('HDFC Bank')).toBe(true)
    expect(isBankOnlyName('IDFC FIRST Bank')).toBe(true)
    expect(isBankOnlyName('ICICI')).toBe(true)
  })
  it('passes real merchants', () => {
    expect(isBankOnlyName('Facebook India Online Services')).toBe(false)
    expect(isBankOnlyName('HDFC Silver ETF FoF')).toBe(false)
    expect(isBankOnlyName('Netflix')).toBe(false)
  })
})

beforeEach(() => {
  mockState.text = '[]'
  mockState.prompts = []
  mockState.shouldThrow = false
})

const email = (over = {}) => ({
  subject: 'Your Pro trial ends in 3 days',
  sender: 'Anthropic <no-reply@anthropic.com>',
  date: 'Wed, 17 Jun 2026 07:32:23 +0000',
  body: 'In 3 days these Pro features will no longer be available.',
  ...over,
})

describe('parseSubscriptions — prompt construction (regression guard)', () => {
  it('feeds the email body and received Date into the model prompt', async () => {
    await parseSubscriptions([email()])
    const p = mockState.prompts[0]
    expect(p).toContain('Body: In 3 days these Pro features')
    expect(p).toContain('Date: Wed, 17 Jun 2026')
  })

  it('keeps the per-email-category rules in the prompt', async () => {
    await parseSubscriptions([email()])
    const p = mockState.prompts[0]
    // If someone strips these instructions, segmentation/extraction silently regresses — fail loudly.
    expect(p).toMatch(/category/) // per-email category taxonomy
    expect(p).toMatch(/one per email|ONE per email/i) // one verdict per email (coverage)
    expect(p).toMatch(/ignore/) // non-subscriptions explicitly marked, not dropped
    expect(p).toMatch(/cancelled/) // cancellation segment
    expect(p).toMatch(/Date \+ N days/)
    expect(p).toMatch(/annual/)
    expect(p).toMatch(/week|weekly/)
    expect(p).toMatch(/mandate/i)
    expect(p).toMatch(/MERCHANT/i) // bank e-mandate → use merchant, not the bank
    expect(p).toMatch(/one_time/)
    expect(p).toMatch(/needs_confirmation/)
    expect(p).toMatch(/SIP/) // SIPs tracked, named by fund not broker
    expect(p).toMatch(/PMSBY/) // govt insurance / card-fee auto-debits excluded
    expect(p).toMatch(/WIN-BACK|come back/i) // win-back re-subscribe ads excluded (Spotify "₹99")
    expect(p).toMatch(/DIFFERENT SENDER/i) // brand merely mentioned by another sender excluded
  })

  it('batches in small groups (12) for reliable per-email coverage and reports stats', async () => {
    const emails = Array.from({ length: 30 }, (_, i) => email({ subject: `Svc ${i}` }))
    const stats = {}
    await parseSubscriptions(emails, stats)
    expect(mockState.prompts).toHaveLength(3) // 12 + 12 + 6
    expect(stats.batches).toBe(3)
    expect(stats.failed).toBe(0)
  })

  it('records failed batches in stats when the model throws', async () => {
    mockState.shouldThrow = true
    const stats = {}
    await parseSubscriptions([email()], stats)
    expect(stats.batches).toBe(1)
    expect(stats.failed).toBe(1)
  })
})

describe('parseSubscriptions — category mapping + output fidelity (regression guard)', () => {
  it('maps active/trial categories and preserves billing_cycle + trial_end_date', async () => {
    mockState.text = `Here you go:
\`\`\`json
[
  { "n": 1, "category": "active", "service_name": "Udemy Personal Plan", "amount": 8900, "currency": "INR", "billing_cycle": "annual", "trial_end_date": null, "next_charge_date": "2027-06-10" },
  { "n": 2, "category": "trial", "service_name": "Zoho Mail", "amount": null, "currency": "INR", "billing_cycle": null, "trial_end_date": "2026-06-25", "next_charge_date": null }
]
\`\`\``
    const out = await parseSubscriptions([email(), email()])
    expect(out).toHaveLength(2)

    const udemy = out.find((s) => s.service_name === 'Udemy Personal Plan')
    expect(udemy.kind).toBe('subscription')
    expect(udemy.billing_cycle).toBe('annual')
    expect(udemy.amount).toBe(8900)

    const zoho = out.find((s) => s.service_name === 'Zoho Mail')
    expect(zoho.kind).toBe('trial')
    expect(zoho.is_trial).toBe(true)
    expect(zoho.trial_end_date).toBe('2026-06-25')
  })

  it('maps the mandate category (merchant as name, payment_method, charge_date)', async () => {
    mockState.text = JSON.stringify([
      {
        n: 1,
        category: 'mandate',
        service_name: 'Facebook',
        amount: 15000,
        currency: 'INR',
        billing_cycle: null,
        payment_method: 'Debit card e-mandate (ending 6593)',
        next_charge_date: '2026-06-18',
        charge_date: '2026-06-18',
      },
    ])
    // A real e-mandate with a usage CAP ("up to … as presented") stays a mandate (a fixed-amount mandate
    // without cap language is treated as a subscription — see the SIP/EMI behaviour).
    const [m] = await parseSubscriptions([email({ body: 'Your e-mandate on Debit Card ending 6593 is active. Amount up to ₹15000 as presented.' })])
    expect(m.kind).toBe('mandate')
    expect(m.service_name).toBe('Facebook') // merchant, not "IDFC Bank"
    expect(m.payment_method).toBe('Debit card e-mandate (ending 6593)')
    expect(m.amount).toBe(15000)
    expect(m.charge_date).toBe('2026-06-18')
    expect(m.confidence).toBe('confirmed')
  })

  it('reclassifies a "trial" carrying paid-subscription data as an active subscription (Udemy guard)', async () => {
    mockState.text = JSON.stringify([
      {
        n: 1,
        category: 'trial',
        service_name: 'Udemy',
        amount: 4500,
        currency: 'INR',
        billing_cycle: 'annual',
        trial_end_date: null,
        next_charge_date: '2027-04-16',
      },
    ])
    const [u] = await parseSubscriptions([email()])
    expect(u.kind).toBe('subscription')
    expect(u.is_trial).toBeFalsy()
    expect(u.billing_cycle).toBe('annual')
  })

  it('normalizes a "yearly" billing cycle to "annual" (ghost-spend amortization relies on it)', async () => {
    mockState.text = JSON.stringify([
      { n: 1, category: 'active', service_name: 'Udemy', amount: 4500, billing_cycle: 'yearly', next_charge_date: '2027-04-16' },
    ])
    const [u] = await parseSubscriptions([email()])
    expect(u.billing_cycle).toBe('annual')
  })

  it('keeps a genuine free trial (trial_end_date, no charge) as a trial', async () => {
    mockState.text = JSON.stringify([
      { n: 1, category: 'trial', service_name: 'Notion', amount: null, trial_end_date: '2026-07-01' },
    ])
    const [t] = await parseSubscriptions([email()])
    expect(t.kind).toBe('trial')
    expect(t.is_trial).toBe(true)
  })

  it('maps the cancelled category to an inactive subscription', async () => {
    mockState.text = JSON.stringify([
      { n: 1, category: 'cancelled', service_name: 'Jira', amount: null, currency: null },
    ])
    const [c] = await parseSubscriptions([email()])
    expect(c.kind).toBe('subscription')
    expect(c.cancelled).toBe(true)
    expect(c.service_name).toBe('Jira')
  })

  it('drops "ignore" verdicts (marketing/ads/mentions) entirely', async () => {
    mockState.text = JSON.stringify([
      { n: 1, category: 'ignore', service_name: null },
      { n: 2, category: 'active', service_name: 'Netflix', billing_cycle: 'monthly', amount: 649, next_charge_date: '2026-07-05' },
    ])
    const out = await parseSubscriptions([email(), email()])
    expect(out).toHaveLength(1)
    expect(out[0].service_name).toBe('Netflix')
  })

  it('parses fenced ```json output (gemini format)', async () => {
    mockState.text = '```json\n[{"n":1,"category":"active","service_name":"Netflix","billing_cycle":"monthly","amount":649,"next_charge_date":"2026-07-05"}]\n```'
    const out = await parseSubscriptions([email()])
    expect(out).toHaveLength(1)
    expect(out[0].service_name).toBe('Netflix')
    expect(out[0].billing_cycle).toBe('monthly')
  })

  it('dedupes the same service returned more than once', async () => {
    mockState.text = JSON.stringify([
      { n: 1, category: 'active', service_name: 'Netflix', amount: 199 },
      { n: 2, category: 'active', service_name: 'netflix', amount: 499 },
    ])
    const out = await parseSubscriptions([email(), email()])
    expect(out).toHaveLength(1)
    expect(out[0].amount).toBe(199) // first wins
  })

  it('returns [] (never throws) when the model call fails', async () => {
    mockState.shouldThrow = true
    await expect(parseSubscriptions([email()])).resolves.toEqual([])
  })

  it('short-circuits with no model call when there are no emails', async () => {
    const out = await parseSubscriptions([])
    expect(out).toEqual([])
    expect(mockState.prompts).toHaveLength(0)
  })
})
