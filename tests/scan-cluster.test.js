// Acceptance tests for the Stage-2 clustering engine (scan_engine_plan.md §3c). Deterministic — no live LLM
// (clusterCommitments only calls the model for a >1-candidate orphan tie-break, which we drive with a stub).
import { describe, it, expect, vi } from 'vitest'
import { clusterCommitments, shouldMerge } from '@/lib/scan-cluster'

// scan-cluster imports parser.js (isClearingHouseName/isBankOnlyName); parser pulls in scan-write at no point,
// but it does import lib/llm at module load. No Supabase needed here. (parser's generateText isn't invoked.)
const row = (o) => ({ currency: 'INR', confidence: 'confirmed', merchant_aliases: [], ...o })

describe('clusterCommitments — the four worked examples', () => {
  it('SIP trio → ONE commitment named by the fund, absorbing the NACH debit keys', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'HDFC Silver ETF FoF Direct Growth', kind: 'subscription', amount: 2499.88, billing_cycle: 'monthly', next_charge_date: '2026-07-16' }),
      row({ service_name: 'Indian Clearing', kind: 'mandate', amount: 2500, charge_date: '2026-06-16', account_last4: '4777', mandate_ref: 'HDFC7020912251036911', confidence: 'needs_confirmation', merchant_aliases: ['HDFC Bank'] }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].service_name.toLowerCase()).toContain('hdfc silver etf fof')
    expect(out[0].kind).toBe('subscription')
    expect(out[0].account_last4).toBe('4777')
    expect(out[0].mandate_ref).toBe('HDFC7020912251036911')
    expect(out[0].confidence).toBe('confirmed')
  })

  it('Anthropic receipt + confirm → ONE monthly subscription (recurring kind wins)', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Anthropic', kind: 'one_time', amount: 23.6, currency: 'USD', charge_date: '2026-06-20' }),
      row({ service_name: 'Anthropic', kind: 'subscription', amount: 23.6, currency: 'USD', billing_cycle: 'monthly', card_last4: '6593' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].kind).toBe('subscription')
    expect(out[0].billing_cycle).toBe('monthly')
    expect(out[0].card_last4).toBe('6593')
  })

  it('card 6593 shared across GCP / Anthropic / OpenAI → STAYS 3 separate commitments', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Google Cloud', kind: 'mandate', amount: 75000, card_last4: '6593', mandate_ref: 'YWHxYSeJ0E' }),
      row({ service_name: 'Anthropic', kind: 'subscription', amount: 23.6, currency: 'USD', card_last4: '6593' }),
      row({ service_name: 'OpenAI', kind: 'one_time', amount: 5.9, currency: 'USD', card_last4: '6593', charge_date: '2026-06-10' }),
    ])
    expect(out).toHaveLength(3)
  })

  it('Udemy course (one_time ₹612) and Udemy Personal Plan (sub ₹4500) → STAY 2 (same brand, diff commitment)', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Udemy', kind: 'one_time', amount: 612.42, charge_date: '2026-06-15' }),
      row({ service_name: 'Udemy Personal Plan', kind: 'subscription', amount: 4500, billing_cycle: 'annual', next_charge_date: '2027-06-16' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('three same-card cancellations pass through as 3 (clustering never merges cancellations)', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Cancelled mandate', cancelled: true, kind: 'subscription', card_last4: '6593', mandate_ref: 'YWI0O4Sdsv' }),
      row({ service_name: 'Cancelled mandate', cancelled: true, kind: 'subscription', card_last4: '6593', mandate_ref: 'YWHxYSeJ0E' }),
      row({ service_name: 'Cancelled mandate', cancelled: true, kind: 'subscription', card_last4: '6593', mandate_ref: 'YW6vQ9P8dZ' }),
    ])
    expect(out).toHaveLength(3)
    expect(out.every((r) => r.cancelled)).toBe(true)
  })
})

describe('clusterCommitments — guard rails', () => {
  it('different merchants with the same amount but different instruments do NOT merge', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Facebook', kind: 'mandate', amount: 15000, card_last4: '4321' }),
      row({ service_name: 'Spotify', kind: 'mandate', amount: 15000, card_last4: '7788' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('an orphan with NO amount-matching recurring cluster stays its own pending row', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Netflix', kind: 'subscription', amount: 649, next_charge_date: '2026-07-05' }),
      row({ service_name: 'Indian Clearing', kind: 'mandate', amount: 2500, charge_date: '2026-06-16', account_last4: '4777', confidence: 'needs_confirmation' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('exact mandate_ref match merges even when names differ', async () => {
    const out = await clusterCommitments([
      row({ service_name: 'Google Cloud', kind: 'mandate', amount: 75000, mandate_ref: 'YWHxYSeJ0E' }),
      row({ service_name: 'IDFC FIRST Bank', kind: 'mandate', amount: 75000, mandate_ref: 'YWHxYSeJ0E', confidence: 'needs_confirmation' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].service_name).toBe('Google Cloud')
  })
})

describe('clusterCommitments — bounded LLM tie-break for an ambiguous orphan', () => {
  const orphan = () => row({ service_name: 'Indian Clearing', kind: 'mandate', amount: 2500, charge_date: '2026-06-16', account_last4: '4777', confidence: 'needs_confirmation' })
  const fundA = () => row({ service_name: 'HDFC Silver ETF FoF', kind: 'subscription', amount: 2500, billing_cycle: 'monthly' })
  const fundB = () => row({ service_name: 'ICICI Prudential Multi Asset', kind: 'subscription', amount: 2500, billing_cycle: 'monthly' })

  it('with two ₹2500 candidates and NO llm → orphan stays separate (3 rows)', async () => {
    const out = await clusterCommitments([fundA(), fundB(), orphan()])
    expect(out).toHaveLength(3)
  })

  it('with two candidates and an llm picking #2 → attaches to that fund (2 rows)', async () => {
    const llm = vi.fn().mockResolvedValue('2')
    const out = await clusterCommitments([fundA(), fundB(), orphan()], { llm })
    expect(llm).toHaveBeenCalledOnce()
    expect(out).toHaveLength(2)
    const icici = out.find((r) => r.service_name.includes('ICICI'))
    expect(icici.account_last4).toBe('4777') // absorbed the orphan's key
  })

  it('llm failure degrades gracefully (orphan left unmerged, no throw)', async () => {
    const llm = vi.fn().mockRejectedValue(new Error('groq down'))
    const out = await clusterCommitments([fundA(), fundB(), orphan()], { llm })
    expect(out).toHaveLength(3)
  })
})

describe('shouldMerge — unit', () => {
  it('merges same-merchant rows when amount agrees, not when it diverges across kinds', () => {
    expect(shouldMerge({ service_name: 'Anthropic', kind: 'one_time', amount: 23.6, currency: 'USD' }, { service_name: 'Anthropic', kind: 'subscription', amount: 23.6, currency: 'USD' })).toBe(true)
    expect(shouldMerge({ service_name: 'Udemy', kind: 'one_time', amount: 612 }, { service_name: 'Udemy Personal Plan', kind: 'subscription', amount: 4500 })).toBe(false)
  })

  it('does not merge two bank/clearing-house orphans on name alone', () => {
    expect(shouldMerge({ service_name: 'HDFC Bank', kind: 'mandate', amount: 2500 }, { service_name: 'HDFC Bank', kind: 'mandate', amount: 9999 })).toBe(false)
  })
})
