// DETERMINISTIC regression for the real-inbox failure modes (no live LLM). For each real email we feed
// mapVerdict the IDEAL verdict the model is meant to return, run the deterministic guards (refineWithGuards),
// then assert the stored row (kind/status/amount/cancelled/name) is correct. This locks the Session-1
// behaviour — tense/auto-renew/clearing-house guards + the join-key fields — so a future prompt edit can't
// silently regress them. The live model judgment is covered separately by tests/real-inbox-eval.live.test.js.
import { describe, it, expect, vi } from 'vitest'
import {
  mapVerdict,
  refineWithGuards,
  isClearingHouseName,
  isPastReceipt,
  hasAutoRenew,
  isDunning,
  isTrialOffer,
  isTrialStarted,
  isTrialExpired,
  isObviousNoise,
  isCappedMandate,
  isMarketingPromo,
} from '@/lib/parser'
import { REAL_INBOX } from './fixtures/real-inbox.js'

// scan-write imports the Supabase server client at module load (throws without env). We only test the pure
// status helper here, so stub the server client (same pattern as tests/parser-scenarios.test.js).
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: {} }))
const { decideNewRowStatus } = await import('@/lib/scan-write')

// Simulate the parseSubscriptions per-email path WITHOUT a model: ideal verdict → mapVerdict → guards → status.
function process(entry) {
  const m = mapVerdict(entry.verdict)
  if (!m) return null
  const refined = refineWithGuards(m, entry.email)
  if (!refined) return null // guard dropped it as noise
  return { ...refined, status: decideNewRowStatus(refined, refined.kind) }
}

const lower = (s) => String(s || '').toLowerCase()

describe('real-inbox fixtures — mapVerdict + guards produce the right stored row', () => {
  for (const entry of REAL_INBOX.filter((e) => !e.liveOnly)) {
    it(`${entry.id} → ${entry.expect.kind ?? 'ignore'}`, () => {
      const row = process(entry)

      if (entry.expect.kind === null) {
        expect(row).toBeNull()
        return
      }
      expect(row).not.toBeNull()

      if (entry.expect.kind === 'cancelled') {
        expect(row.cancelled).toBe(true)
      } else {
        expect(row.kind).toBe(entry.expect.kind)
        expect(row.cancelled).toBeFalsy()
      }
      if (entry.expect.status) expect(row.status).toBe(entry.expect.status)
      if (entry.expect.amount != null) expect(row.amount).toBe(entry.expect.amount)
      if (entry.expect.match) expect(lower(row.service_name)).toContain(lower(entry.expect.match))
    })
  }
})

describe('join keys ride along on the verdict (Stage-2 hooks)', () => {
  it('extracts card_last4, account_last4, mandate_ref, merchant_aliases', () => {
    const r = mapVerdict({
      category: 'mandate',
      service_name: 'Google Cloud',
      amount: 75000,
      card_last4: 'card ending 6593',
      account_last4: 'XXXXXXXX4777',
      mandate_ref: 'YWHxYSeJ0E',
      merchant_aliases: ['IDFC FIRST Bank', ' '],
    })
    expect(r.card_last4).toBe('6593')
    expect(r.account_last4).toBe('4777')
    expect(r.mandate_ref).toBe('YWHxYSeJ0E')
    expect(r.merchant_aliases).toEqual(['IDFC FIRST Bank'])
  })

  it('renewal_amount and is_recurring_signal normalize; ₹0 renewal → null', () => {
    const r = mapVerdict({ category: 'one_time', service_name: 'GoDaddy', amount: 499, renewal_amount: 749, is_recurring_signal: ' AutoRenews ' })
    expect(r.renewal_amount).toBe(749)
    expect(r.is_recurring_signal).toBe('autorenews')
    expect(mapVerdict({ category: 'one_time', service_name: 'X', amount: 10, renewal_amount: 0 }).renewal_amount).toBeNull()
  })
})

describe('guard predicates', () => {
  it('isClearingHouseName matches NACH clearing entities (incl. the cleaned form)', () => {
    expect(isClearingHouseName('Indian Clearing Corporation Ltd')).toBe(true)
    expect(isClearingHouseName('Indian Clearing')).toBe(true) // after cleanServiceName strips Corporation/Ltd
    expect(isClearingHouseName('NPCI')).toBe(true)
    expect(isClearingHouseName('HDFC Silver ETF FoF')).toBe(false)
    expect(isClearingHouseName('Netflix')).toBe(false)
  })

  it('isPastReceipt: past receipt with no recurring language → true; with it → false', () => {
    expect(isPastReceipt('Payment receipt for your Airtel postpaid. We received your payment of ₹300.')).toBe(true)
    expect(isPastReceipt('Your receipt from Anthropic. $23.60. Order placed.')).toBe(true)
    // recurring language present → not a one-off
    expect(isPastReceipt('Payment received ₹649. Your subscription renews on 5 Jul.')).toBe(false)
    expect(isPastReceipt('₹2500 debited towards Indian Clearing Corporation with UMRN HDFC70209.')).toBe(false)
  })

  it('hasAutoRenew detects auto-renew phrasing', () => {
    expect(hasAutoRenew('Auto-renews on 15-06-2027 for ₹749.00')).toBe(true)
    expect(hasAutoRenew('autorenewal enabled')).toBe(true)
    expect(hasAutoRenew('Thank you for your order.')).toBe(false)
  })
})

describe('refineWithGuards — the four flips', () => {
  const sub = (over) => ({ kind: 'subscription', confidence: 'confirmed', service_name: 'X', amount: 100, billing_cycle: 'monthly', mandate_ref: null, renewal_amount: null, ...over })

  it('postpaid receipt → one_time (clears cycle/next date, sets charge_date)', () => {
    const r = refineWithGuards(sub({ service_name: 'Airtel' }), { subject: 'Payment receipt', body: 'We received your payment of ₹300 for your Airtel postpaid account.', date: '2026-06-18' })
    expect(r.kind).toBe('one_time')
    expect(r.billing_cycle).toBeNull()
    expect(r.charge_date).toBe('2026-06-18')
  })

  it('clearing-house SIP debit → needs_confirmation (fixed → subscription, not a capped mandate)', () => {
    const r = refineWithGuards(sub({ kind: 'mandate', service_name: 'Indian Clearing', mandate_ref: 'HDFC70209', billing_cycle: null }), { body: '₹2500 debited towards Indian Clearing Corporation with UMRN HDFC70209.' })
    expect(r.kind).toBe('subscription') // fixed amount, no "up to" cap
    expect(r.confidence).toBe('needs_confirmation')
  })

  it('auto-renew order → annual subscription at the RENEWAL amount', () => {
    const r = refineWithGuards({ kind: 'one_time', confidence: 'confirmed', service_name: 'GoDaddy', amount: 499, billing_cycle: null, mandate_ref: null, renewal_amount: 749, next_charge_date: '2027-06-15' }, { body: 'Auto-renews on 15-06-2027 for ₹749.00' })
    expect(r.kind).toBe('subscription')
    expect(r.billing_cycle).toBe('annual')
    expect(r.amount).toBe(749)
  })

  it('a ref-bearing fixed mandate execution stays recurring (not one_time)', () => {
    const r = refineWithGuards(sub({ kind: 'mandate', service_name: 'Spotify', mandate_ref: 'ABC123', billing_cycle: null }), { body: 'Payment of ₹119 received via your UPI AutoPay mandate.' })
    expect(r.kind).not.toBe('one_time') // fixed → subscription; the point is it's not a one-off
  })

  it('capped mandate ("up to … as presented") STAYS a mandate', () => {
    const r = refineWithGuards(sub({ kind: 'mandate', service_name: 'Google Cloud', amount: 75000, billing_cycle: null }), { body: 'Your e-mandate is set up. Amount up to ₹75000 will be debited as presented.' })
    expect(r.kind).toBe('mandate')
  })

  it('fixed SIP/EMI mandate (no cap) → subscription, exact amount', () => {
    const r = refineWithGuards(sub({ kind: 'mandate', service_name: 'HDFC Silver ETF FoF', amount: 2500, billing_cycle: 'monthly' }), { body: 'Your SIP instalment of ₹2500 has been processed.' })
    expect(r.kind).toBe('subscription')
    expect(r.amount).toBe(2500)
  })

  it('explicit "monthly payment" promotes a model-mislabelled one_time → subscription', () => {
    const r = refineWithGuards({ kind: 'one_time', confidence: 'confirmed', service_name: 'Anthropic', amount: 23.6, currency: 'USD', billing_cycle: null, mandate_ref: null, renewal_amount: null }, { subject: 'Confirm your $23.60 payment', body: 'Confirm your monthly payment to Anthropic using your card ending 6593.' })
    expect(r.kind).toBe('subscription')
    expect(r.billing_cycle).toBe('monthly')
  })

  it('a past-tense receipt that merely names a cycle stays one_time (Airtel postpaid)', () => {
    const r = refineWithGuards({ kind: 'one_time', confidence: 'confirmed', service_name: 'Airtel', amount: 300, billing_cycle: null, mandate_ref: null }, { subject: 'Payment receipt', body: 'We received your monthly payment of ₹300 for your Airtel postpaid account. Payment receipt.' })
    expect(r.kind).toBe('one_time')
  })

  it('does not touch a cancellation', () => {
    const r = refineWithGuards({ kind: 'subscription', cancelled: true, service_name: 'Cancelled mandate', mandate_ref: 'YWHxYSeJ0E' }, { body: 'e-mandate cancelled' })
    expect(r.cancelled).toBe(true)
  })
})

describe('noise drop predicates + refineWithGuards drops', () => {
  it('isDunning matches failed/owed-payment notices', () => {
    expect(isDunning('We were unable to process your payment. Please update your payment method.')).toBe(true)
    expect(isDunning("We couldn't charge your card for Loom.")).toBe(true)
    expect(isDunning('Your Google Cloud payment failed.')).toBe(true)
    expect(isDunning('Your Netflix receipt. ₹649 charged.')).toBe(false)
  })

  it('trial-offer vs trial-started vs expired', () => {
    expect(isTrialOffer('Start your 14-day free trial — no charge today.')).toBe(true)
    expect(isTrialOffer('Try LinkedIn Premium free for 1 month.')).toBe(true)
    expect(isTrialStarted('Your 30-day free trial has begun. Your trial ends on 20 Jul 2026.')).toBe(true)
    expect(isTrialExpired('Your trial period has expired. Upgrade now.')).toBe(true)
  })

  it('a marketing "start your free trial" (no started signal) → dropped', () => {
    const r = refineWithGuards({ kind: 'trial', is_trial: true, service_name: 'LinkedIn', amount: null }, { subject: 'unlock LinkedIn Premium for free', body: 'Start your free trial offer today.' })
    expect(r).toBeNull()
  })

  it('a STARTED trial is kept', () => {
    const r = refineWithGuards({ kind: 'trial', is_trial: true, service_name: 'Audible', amount: null }, { body: 'Your 30-day free trial of Audible has begun. Your trial ends on 20 Jul 2026.' })
    expect(r).not.toBeNull()
    expect(r.kind).toBe('trial')
  })

  it('a dunning email the model called a subscription → dropped', () => {
    const r = refineWithGuards({ kind: 'subscription', service_name: 'Google Cloud', amount: 75000 }, { subject: 'payment failed', body: 'We were unable to process your payment. Update your payment method.' })
    expect(r).toBeNull()
  })
})

describe('marketing-promo + capped-mandate guards', () => {
  it('isMarketingPromo drops feature-promo/upsell with no charge or trial', () => {
    expect(isMarketingPromo('Extend Jira with Teamwork Collection. Add docs, async video and more.')).toBe(true)
    expect(isMarketingPromo('Run multiple tasks at once with Cowork. Let Claude work while you focus.')).toBe(true)
    expect(isMarketingPromo("Your Replit week in review. Discover what's new.")).toBe(true)
  })
  it('isMarketingPromo does NOT drop a real receipt or a trial/billing email', () => {
    expect(isMarketingPromo('Your Netflix receipt. ₹649 charged. See what you can do next.')).toBe(false) // charge
    expect(isMarketingPromo('Get the most out of your free trial. Set up billing by July 4.')).toBe(false) // trial
    expect(isMarketingPromo('Your SIP units have been allocated.')).toBe(false) // no promo phrase
  })
  it('isCappedMandate detects "up to / as presented" caps only', () => {
    expect(isCappedMandate('Amount up to ₹75000 will be debited as presented.')).toBe(true)
    expect(isCappedMandate('Up to ₹500 will be debited.')).toBe(true)
    expect(isCappedMandate('₹2500 has been debited towards your SIP.')).toBe(false)
  })

  const sub = (over) => ({ kind: 'subscription', confidence: 'confirmed', service_name: 'X', amount: 100, billing_cycle: 'monthly', mandate_ref: null, renewal_amount: null, ...over })
  it('a marketing/upsell email the model called a subscription → dropped', () => {
    const r = refineWithGuards(sub({ service_name: 'Atlassian Loom Business + AI', amount: 24, currency: 'USD' }), { subject: 'Extend Jira with Teamwork Collection', body: 'Take Jira further. Add docs, async video, AI and more.' })
    expect(r).toBeNull()
  })
  it('Google Workspace "won\'t be charged until trial ends / set up billing" → trial, not subscription', () => {
    const r = refineWithGuards(sub({ service_name: 'Google Workspace', amount: null }), { subject: 'Set up billing for Google Workspace', body: "You won't be charged until your free trial ends. Add a form of payment to retain access." })
    expect(r.kind).toBe('trial')
  })
})

describe('isObviousNoise — subject-only pre-filter (never drops a payment)', () => {
  it('drops OTP / verification / calendar by subject', () => {
    expect(isObviousNoise({ subject: 'Your OTP is 449122' })).toBe(true)
    expect(isObviousNoise({ subject: 'Your verification code' })).toBe(true)
    expect(isObviousNoise({ subject: 'Invitation: Standup @ Mon 10am' })).toBe(true)
  })
  it('keeps real payment/receipt subjects', () => {
    expect(isObviousNoise({ subject: 'Your Netflix receipt' })).toBe(false)
    expect(isObviousNoise({ subject: 'Confirm your $23.60 payment to Anthropic' })).toBe(false)
    expect(isObviousNoise({ subject: 'SIP: Units allocated' })).toBe(false)
    expect(isObviousNoise({ subject: '' })).toBe(false)
  })
})
