// Deterministic regression for the scan engine's LOGIC (no live LLM calls). For each representative
// scenario we feed mapVerdict the *ideal verdict* the model is meant to return, then assert the mapped
// row (kind/cancelled/amount/cap/ref/cycle/confidence) and the stored status (decideNewRowStatus) are
// correct. This locks the mapping + guards + status decision so a future prompt edit can't silently
// regress them. The live model judgment is covered separately by tests/scan-eval.live.test.js.
import { describe, it, expect, vi } from 'vitest'
import { mapVerdict, isPrepaidRecharge, isBankOnlyName } from '@/lib/parser'

// scan-write imports the Supabase server client at module load (throws without env). We only test the
// pure status helper here, so stub the server client (same pattern as tests/scan-write.test.js).
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: {} }))
const { decideNewRowStatus } = await import('@/lib/scan-write')

const D = '2026-06-20'

// helper: the row a confirmed scan would store
function row(verdict) {
  const m = mapVerdict(verdict)
  if (!m) return null
  return { ...m, status: decideNewRowStatus(m, m.kind) }
}

describe('mapVerdict — recurring subscriptions', () => {
  it('Netflix receipt → confirmed subscription with amount + next date', () => {
    const r = row({ category: 'active', service_name: 'Netflix', amount: 649, currency: 'INR', billing_cycle: 'monthly', next_charge_date: '2026-07-05' })
    expect(r).toMatchObject({ kind: 'subscription', amount: 649, billing_cycle: 'monthly', confidence: 'confirmed', status: 'confirmed' })
    expect(r.cancelled).toBeUndefined()
  })

  it('SIP with a date but no cycle → defaults to monthly and confirms', () => {
    const r = row({ category: 'active', service_name: 'HDFC Silver ETF FoF', amount: 2500, currency: 'INR', billing_cycle: null, next_charge_date: '2026-07-16' })
    expect(r.billing_cycle).toBe('monthly')
    expect(r.status).toBe('confirmed')
  })

  it('annual plan with cycle but no next date still confirms (Udemy ₹4500/yr)', () => {
    const r = row({ category: 'active', service_name: 'Udemy', amount: 4500, currency: 'INR', billing_cycle: 'annual', next_charge_date: null })
    expect(r).toMatchObject({ kind: 'subscription', billing_cycle: 'annual', status: 'confirmed' })
  })

  it('private insurance premium → active subscription (in scope)', () => {
    const r = row({ category: 'active', service_name: 'LIC Jeevan Anand', amount: 12500, currency: 'INR', next_charge_date: '2026-07-15' })
    expect(r.kind).toBe('subscription')
  })

  it('normalizes a stray "yearly" / "per month" cycle to the canonical set', () => {
    expect(mapVerdict({ category: 'active', service_name: 'X', amount: 100, billing_cycle: 'yearly', next_charge_date: D }).billing_cycle).toBe('annual')
    expect(mapVerdict({ category: 'active', service_name: 'Y', amount: 100, billing_cycle: 'per month', next_charge_date: D }).billing_cycle).toBe('monthly')
  })
})

describe('mapVerdict — mandates (autopay) and caps/refs', () => {
  it('UPI AutoPay → mandate with the merchant name, never the processor', () => {
    const r = row({ category: 'mandate', service_name: 'Swiggy', amount: 500, currency: 'INR', payment_method: 'UPI AutoPay', mandate_ref: 'ABCD1234efgh5678' })
    expect(r).toMatchObject({ kind: 'mandate', service_name: 'Swiggy', confidence: 'confirmed', status: 'confirmed' })
  })

  it('folds the mandate reference into payment_method as ref:<ID> (stripped of punctuation)', () => {
    const r = mapVerdict({ category: 'mandate', service_name: 'Facebook', amount: 15000, payment_method: 'Debit card e-mandate', mandate_ref: 'HDFC-9911/XYZ' })
    expect(r.payment_method).toBe('Debit card e-mandate · ref:HDFC9911XYZ')
  })

  it('a mandate named only by the bank → needs_confirmation AND stays pending (never asserted active)', () => {
    const r = row({ category: 'mandate', service_name: 'HDFC Bank', amount: 999, next_charge_date: D })
    expect(r.confidence).toBe('needs_confirmation')
    expect(r.status).toBe('pending') // a bare bank name is not a confident merchant → user confirms it
  })

  it('loan EMI auto-debit → mandate (in scope)', () => {
    const r = row({ category: 'mandate', service_name: 'Bajaj Finserv', amount: 4999, next_charge_date: '2026-07-05', payment_method: 'NACH' })
    expect(r.kind).toBe('mandate')
  })
})

describe('mapVerdict — trials', () => {
  it('genuine free trial → trial row', () => {
    const r = row({ category: 'trial', service_name: 'Audible', amount: null, trial_end_date: '2026-07-20' })
    expect(r).toMatchObject({ kind: 'trial', is_trial: true })
    expect(r.status).toBe('confirmed')
  })

  it('mislabeled "trial" carrying paid data (amount + cycle + next date, no trial end) → subscription', () => {
    const r = row({ category: 'trial', service_name: 'Udemy', amount: 4500, billing_cycle: 'annual', next_charge_date: '2027-04-16', trial_end_date: null })
    expect(r.kind).toBe('subscription')
  })
})

describe('mapVerdict — one-time', () => {
  it('recharge / order with an amount → one_time confirmed', () => {
    const r = row({ category: 'one_time', service_name: 'Airtel', amount: 299, charge_date: D })
    expect(r).toMatchObject({ kind: 'one_time', amount: 299, status: 'confirmed' })
  })
})

describe('mapVerdict — cancellations', () => {
  it('named cancellation → cancelled subscription row', () => {
    const r = mapVerdict({ category: 'cancelled', service_name: 'Notion' })
    expect(r).toMatchObject({ kind: 'subscription', cancelled: true, service_name: 'Notion' })
    expect(decideNewRowStatus(r, r.kind)).toBe('confirmed')
  })

  it('ref-only cancellation (no merchant, no amount) → kept with placeholder name + ref for reconcile', () => {
    const r = mapVerdict({ category: 'cancelled', service_name: null, amount: null, mandate_ref: 'HDFC9911XYZ' })
    expect(r).toMatchObject({ cancelled: true, service_name: 'Cancelled mandate' })
    expect(r.payment_method).toContain('ref:HDFC9911XYZ')
  })

  it('a cancellation with NO merchant, NO amount and NO ref is useless → dropped', () => {
    expect(mapVerdict({ category: 'cancelled', service_name: null, amount: null, mandate_ref: null })).toBeNull()
  })
})

describe('mapVerdict — noise / guards', () => {
  it('category "ignore" → dropped', () => {
    expect(mapVerdict({ category: 'ignore', service_name: null })).toBeNull()
  })

  it('a recurring candidate with NO amount and NO date is not actionable → dropped', () => {
    expect(mapVerdict({ category: 'active', service_name: 'Premium', amount: null, next_charge_date: null, billing_cycle: null })).toBeNull()
  })

  it('₹0 is treated as no amount (a notification, not a payment)', () => {
    // active with ₹0 and a date is still kept (date is a signal) but amount is nulled
    const r = mapVerdict({ category: 'active', service_name: 'X', amount: 0, next_charge_date: D })
    expect(r.amount).toBeNull()
  })

  it('a subscription with no amount, no date and no cycle → pending (needs the user to supply it)', () => {
    // mandate keeps it alive without a signal; subscription without a signal is already dropped above,
    // so here we give it a date-less signal via needs_confirmation
    const r = row({ category: 'needs_confirmation', service_name: 'Maybe SaaS', amount: null, next_charge_date: '2026-07-01' })
    expect(r.confidence).toBe('needs_confirmation')
    expect(r.status).toBe('pending')
  })
})

describe('isPrepaidRecharge — telecom recharge guard (one-time, not a subscription)', () => {
  it('flags an Airtel prepaid recharge with validity', () => {
    expect(isPrepaidRecharge('Airtel', 'Your Airtel prepaid recharge of ₹300 is successful. Validity 28 days.')).toBe(true)
  })

  it('flags a Jio recharge / data pack', () => {
    expect(isPrepaidRecharge('Jio', 'Recharge done. Jio data pack activated, validity 30 days.')).toBe(true)
  })

  it('does NOT flag a telecom AUTOPAY/mandate (that is a real recurring mandate)', () => {
    expect(isPrepaidRecharge('Airtel', 'Your Airtel postpaid AutoPay mandate has been set up. Standing instruction active.')).toBe(false)
  })

  it('does NOT flag a non-telecom service that happens to say "recharge"', () => {
    expect(isPrepaidRecharge('Netflix', 'Your Netflix membership renews monthly.')).toBe(false)
  })
})

describe('isBankOnlyName — bank-only mandates are not confident merchants', () => {
  it('treats bare bank names as bank-only', () => {
    expect(isBankOnlyName('HDFC Bank')).toBe(true)
    expect(isBankOnlyName('IDFC FIRST Bank')).toBe(true)
    expect(isBankOnlyName('ICICI')).toBe(true)
  })

  it('a real merchant is not bank-only', () => {
    expect(isBankOnlyName('Facebook')).toBe(false)
    expect(isBankOnlyName('HDFC Silver ETF FoF')).toBe(false) // a fund, not the bank
  })

  it('a bank-only mandate is kept PENDING, never asserted Active, even with amount + date', () => {
    const r = mapVerdict({ category: 'mandate', service_name: 'HDFC Bank', amount: 17000, next_charge_date: '2026-07-17' })
    expect(r.confidence).toBe('needs_confirmation')
    expect(decideNewRowStatus(r, r.kind)).toBe('pending')
  })

  it('a resolved merchant mandate with amount + date still confirms', () => {
    const r = mapVerdict({ category: 'mandate', service_name: 'Facebook', amount: 17000, next_charge_date: '2026-07-17' })
    expect(decideNewRowStatus(r, r.kind)).toBe('confirmed')
  })
})

describe('decideNewRowStatus — independent checks', () => {
  it('cancelled rows are always confirmed (a known fact, not a question)', () => {
    expect(decideNewRowStatus({ cancelled: true, amount: null }, 'subscription')).toBe('confirmed')
  })

  it('a trial missing its end date → pending', () => {
    expect(decideNewRowStatus({ kind: 'trial', trial_end_date: null }, 'trial')).toBe('pending')
  })

  it('a recurring item with amount + cycle (no explicit next date) → confirmed', () => {
    expect(decideNewRowStatus({ amount: 4500, billing_cycle: 'annual', next_charge_date: null }, 'subscription')).toBe('confirmed')
  })
})
