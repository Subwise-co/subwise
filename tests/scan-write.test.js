import { describe, it, expect, vi } from 'vitest'

// scan-write imports the Supabase server client at module load (throws without env). We only test the
// pure status helper here, so stub the server client.
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: {} }))

const { decideNewRowStatus } = await import('@/lib/scan-write')

describe('decideNewRowStatus', () => {
  it('auto-confirms a recurring autopay with amount + next charge date (e.g. ICICI/HDFC SIP), even if model is unsure', () => {
    const sip = { amount: 2499.88, next_charge_date: '2026-05-16', confidence: 'needs_confirmation' }
    expect(decideNewRowStatus(sip, 'subscription')).toBe('confirmed')
  })

  it('auto-confirms a mandate with amount + next charge date', () => {
    const mandate = { amount: 15000, next_charge_date: '2026-06-18', confidence: 'needs_confirmation' }
    expect(decideNewRowStatus(mandate, 'mandate')).toBe('confirmed')
  })

  it('keeps a subscription with amount but NO date pending (needs the renewal date)', () => {
    const noDate = { amount: 99, next_charge_date: null, confidence: 'confirmed' }
    expect(decideNewRowStatus(noDate, 'subscription')).toBe('pending')
  })

  it('keeps a model-ambiguous subscription pending', () => {
    const ambiguous = { amount: null, next_charge_date: null, confidence: 'needs_confirmation' }
    expect(decideNewRowStatus(ambiguous, 'subscription')).toBe('pending')
  })

  it('keeps a trial without an end date pending', () => {
    const trial = { trial_end_date: null, confidence: 'confirmed' }
    expect(decideNewRowStatus(trial, 'trial')).toBe('pending')
  })

  it('confirms a trial that has an end date', () => {
    const trial = { trial_end_date: '2026-07-04', confidence: 'confirmed' }
    expect(decideNewRowStatus(trial, 'trial')).toBe('confirmed')
  })

  it('confirms a clear one-time payment', () => {
    const oneTime = { amount: 641.44, confidence: 'confirmed' }
    expect(decideNewRowStatus(oneTime, 'one_time')).toBe('confirmed')
  })

  it('confirms a cancelled subscription (a known fact — not something to ask about)', () => {
    const cancelled = { cancelled: true, amount: null, next_charge_date: null, confidence: 'confirmed' }
    expect(decideNewRowStatus(cancelled, 'subscription')).toBe('confirmed')
  })
})
