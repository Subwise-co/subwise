// LIVE regression test for the AI extraction RULES (kind classification, merchant extraction,
// date anchoring, annual detection, investment exclusion). Calls the real Gemini model with
// fixture emails — no Gmail/DB needed. Fixtures mirror the user's real inbox screenshots.
// Opt-in: RUN_LIVE_GEMINI=1 npm run test:integration   (skipped by default).
import { describe, it, expect } from 'vitest'
import { parseSubscriptions } from '@/lib/parser'

// Calls whichever provider lib/llm selects (Groq primary, Gemini fallback).
const enabled = Boolean(
  (process.env.RUN_LIVE_LLM || process.env.RUN_LIVE_GEMINI) &&
    (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY)
)

describe.runIf(enabled)('LIVE Gemini extraction rules', () => {
  it('anchors a relative trial length to the email date and detects an annual plan', async () => {
    const out = await parseSubscriptions([
      {
        subject: 'Your free trial has started',
        sender: 'Acme Cloud <no-reply@acme.test>',
        date: 'Wed, 10 Jun 2026 10:00:00 +0530',
        body: "Welcome! Your 7-day free trial started today. You won't be charged until the trial ends.",
      },
      {
        subject: 'Your subscription receipt',
        sender: 'Globex Pro <billing@globex.test>',
        date: 'Wed, 10 Jun 2026 11:00:00 +0530',
        body: 'Thanks for subscribing to Globex Pro. You were charged ₹8900 for your annual plan (1 year). Next renewal 10 Jun 2027.',
      },
    ])
    expect(out.find((s) => s.is_trial && s.trial_end_date === '2026-06-17'), JSON.stringify(out)).toBeTruthy()
    expect(out.find((s) => s.billing_cycle === 'annual'), JSON.stringify(out)).toBeTruthy()
  })

  it('handles e-mandate merchant, one-time, SIP (included), and a promo (not auto-confirmed)', async () => {
    const out = await parseSubscriptions([
      {
        subject: 'E-mandate Set',
        sender: 'IDFC FIRST Bank <noreply@idfcfirst.bank.in>',
        date: 'Wed, 18 Jun 2026 14:10:00 +0530',
        body: 'Dear Customer, Greetings from IDFC FIRST Bank! Your recurring transaction on your Debit Card ending 6593 is now active. Merchant: FACEBOOK INDIA ONLINE SE Description: SI Transaction Amount (Rs): 15000.00 Frequency: As Presented Start date: 18/06/2026 Cancel date: 15/06/2036',
      },
      {
        subject: 'Your receipt from Udemy',
        sender: 'Udemy <receipt@udemy.com>',
        date: 'Wed, 29 Apr 2026 17:31:00 +0530',
        body: 'Thanks for your purchase! Order summary: The Complete Claude Code & Claude Cowork Masterclass [2026] — ₹499. This is a one-time course purchase.',
      },
      {
        subject: 'SIP: Units allocated',
        sender: 'Groww <noreply@groww.in>',
        date: 'Sat, 14 Jun 2026 09:00:00 +0530',
        body: 'ICICI Prudential Multi Asset Fund Direct Growth. SIP AMOUNT ₹2499.88. Units allocated to your portfolio.',
      },
      {
        subject: 'Unlock Jira Premium',
        sender: 'Atlassian <marketing@atlassian.com>',
        date: 'Mon, 15 Jun 2026 09:00:00 +0530',
        body: 'Upgrade to Jira Premium and get advanced roadmaps, unlimited storage and more. Start your free trial today — no commitment.',
      },
      {
        subject: 'Get Loom Business + AI',
        sender: 'Loom <hello@loom.com>',
        date: 'Mon, 15 Jun 2026 10:00:00 +0530',
        body: 'Sign up for Loom Business + AI at just ₹24/month to unlock unlimited recordings, AI summaries and more. Upgrade now!',
      },
      {
        subject: 'PMSBY premium debited',
        sender: 'HDFC Bank <alerts@hdfcbank.net>',
        date: 'Fri, 05 Jun 2026 08:00:00 +0530',
        body: 'Rs 20 has been debited from your account towards Pradhan Mantri Suraksha Bima Yojana (PMSBY) annual premium.',
      },
    ])

    // E-mandate → merchant as service, debit-card e-mandate, ₹15000, NOT "IDFC".
    const mandate = out.find((s) => s.kind === 'mandate')
    expect(mandate, JSON.stringify(out)).toBeTruthy()
    expect(mandate.service_name.toLowerCase()).toContain('facebook')
    expect(mandate.service_name.toLowerCase()).not.toContain('idfc')
    expect(Number(mandate.amount)).toBe(15000)
    expect((mandate.payment_method || '').toLowerCase()).toMatch(/debit card.*mandate|e-mandate/)

    // Udemy course → one-time purchase.
    expect(out.find((s) => s.kind === 'one_time'), JSON.stringify(out)).toBeTruthy()

    // SIP → now INCLUDED as a (confirmed) subscription.
    const sip = out.find((s) => /icici|prudential|sip/i.test(s.service_name || ''))
    expect(sip, JSON.stringify(out)).toBeTruthy()
    expect(sip.confidence).toBe('confirmed')

    // Pure promo → never auto-confirmed (either excluded, or pending for the user to decide).
    const jira = out.find((s) => /jira/i.test(s.service_name || ''))
    if (jira) expect(jira.confidence).toBe('needs_confirmation')

    // Loom "sign up for ₹24" pricing offer → excluded (or at most pending, never confirmed).
    const loom = out.find((s) => /loom/i.test(s.service_name || ''))
    if (loom) expect(loom.confidence).toBe('needs_confirmation')

    // PMSBY govt-insurance / card-fee auto-debit → excluded entirely.
    expect(out.some((s) => /pmsby|suraksha|bima/i.test(s.service_name || ''))).toBe(false)
  })
})
