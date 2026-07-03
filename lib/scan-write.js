// Shared "write a parsed subscription to the DB" logic, used by the progressive scan job and the
// weekly cron. Fuzzy-matches against the user's existing rows so re-processing across batches/steps
// MERGES instead of creating duplicates (e.g. SIP name variants), and preserves the user's
// confirm/reject decision (never resurrect a rejected item or downgrade a confirmed one).
import { supabaseAdmin } from '@/lib/supabase-server'
import { findAllMatchingSubscriptions } from '@/lib/subscriptions'
import { isBankOnlyName } from '@/lib/parser'
import { nextDueDate } from '@/lib/recurrence'

const MERGE_FIELDS = [
  'amount',
  'currency',
  'billing_cycle',
  'payment_method',
  'next_charge_date',
  'charge_date',
  'trial_end_date',
]
const isEmpty = (v) => v === null || v === undefined || v === ''
const today = () => new Date().toISOString().split('T')[0]

// Decide the status of a NEW scanned row (pure — exported for tests):
//  • A recurring item (subscription/mandate) with BOTH a known amount AND a next charge date is strong
//    proof of a real autopay (e.g. an ICICI/HDFC mutual-fund SIP) → CONFIRM even if the model said
//    "needs_confirmation", so genuine autopays don't sit in the manual-confirm list.
//  • Otherwise: a trial/subscription missing its usable date → pending (user supplies it);
//    model-flagged ambiguous → pending; everything else → confirmed.
export function decideNewRowStatus(sub, kind) {
  // A detected cancellation is a known fact (not something to ask about) — confirm it; the row is
  // marked inactive separately so it lands in the "Cancelled" section, not "Needs confirmation".
  if (sub.cancelled) return 'confirmed'
  const recurring = kind === 'subscription' || kind === 'mandate'
  // A mandate/subscription named only by the BANK (e.g. "HDFC Bank", "IDFC FIRST Bank") identifies the
  // wrong party — a real mandate names the MERCHANT, not the executing bank. Never assert it as Active even
  // with an amount + date; keep it pending so the user names/confirms it (it still shows in "Needs
  // confirmation", just not as a confident "HDFC Bank ₹17,000/mo" fact).
  if (recurring && isBankOnlyName(sub.service_name)) return 'pending'
  // A recurring item with an amount AND (a next date OR a billing cycle) is strong proof of a real plan
  // (e.g. Udemy ₹4,500/yr — annual cycle, no explicit next date) → confirm; we compute the date on write.
  const strongRecurring = recurring && !isEmpty(sub.amount) && (!isEmpty(sub.next_charge_date) || !isEmpty(sub.billing_cycle))
  if (strongRecurring) return 'confirmed'
  const needsDate =
    (kind === 'trial' && !sub.trial_end_date) ||
    (kind === 'subscription' && !sub.next_charge_date && isEmpty(sub.billing_cycle))
  return sub.confidence === 'needs_confirmation' || needsDate ? 'pending' : 'confirmed'
}

async function ensureRenewalAlert(profileId, row) {
  if (
    row.status === 'confirmed' &&
    row.is_active !== false && // never schedule a reminder for a cancelled subscription
    (row.kind === 'subscription' || row.kind === 'mandate') &&
    row.next_charge_date
  ) {
    await supabaseAdmin.from('alerts').upsert(
      {
        user_id: profileId,
        subscription_id: row.id,
        alert_type: 'renewal_reminder',
        alert_days_before: row.reminder_days || 3,
        is_active: true,
      },
      { onConflict: 'subscription_id' }
    )
  }
}

// Upsert one parsed subscription. `existingRows` is the user's current rows (id, service_name, status,
// + merge fields); it is MUTATED so later items in the same batch see prior writes. Returns { saved, isNew }.
export async function upsertParsedSubscription(profileId, sub, existingRows, opts = {}) {
  if (!sub?.service_name) return { saved: null, isNew: false }
  const reminderDays = Number(opts.reminderDays) || 3
  const kind = sub.kind || (sub.is_trial ? 'trial' : 'subscription')

  // Usually 0 or 1 match; >1 means earlier scans left duplicate rows for the same fund/service.
  // Keep the first as the canonical row and collapse the rest into it (self-healing on re-scan).
  const matches = findAllMatchingSubscriptions(existingRows, sub.service_name)
  const match = matches[0] || null
  if (matches.length > 1) {
    const dupes = matches.slice(1)
    // Fill any blanks on the keeper from its duplicates before removing them.
    const fill = {}
    for (const f of MERGE_FIELDS) {
      if (!isEmpty(match[f])) continue
      const donor = dupes.find((d) => !isEmpty(d[f]))
      if (donor) fill[f] = donor[f]
    }
    if (Object.keys(fill).length) {
      const { data } = await supabaseAdmin.from('subscriptions').update(fill).eq('id', match.id).select().single()
      if (data) Object.assign(match, data)
    }
    // Never delete a user's manually-added row as a "duplicate" — manual entries are ground truth.
    const deletable = dupes.filter((d) => d.source !== 'manual')
    const dupeIds = deletable.map((d) => d.id)
    if (dupeIds.length) await supabaseAdmin.from('subscriptions').delete().in('id', dupeIds) // alerts cascade
    // Drop the removed rows from the in-memory list so later items don't re-match them.
    for (const d of deletable) {
      const idx = existingRows.indexOf(d)
      if (idx !== -1) existingRows.splice(idx, 1)
    }
  }

  if (match) {
    // Merge + keep the longer name + preserve status (user's decision).
    // For scanned (gmail) rows, let the latest scan CORRECT fields (amount/currency/dates) — re-scans
    // are self-healing. For MANUAL rows, only fill blanks so we never clobber what the user typed.
    const overwrite = match.source !== 'manual'
    const patch = { last_seen_date: today() }
    for (const f of MERGE_FIELDS) {
      if (isEmpty(sub[f])) continue
      if (overwrite || isEmpty(match[f])) patch[f] = sub[f]
    }
    // Let a re-scan self-correct the kind of a SCANNED row (e.g. a paid sub once mislabeled "trial");
    // for manual rows, only fill it if it was blank.
    if (kind && (overwrite || isEmpty(match.kind))) {
      patch.kind = kind
      patch.is_trial = kind === 'trial'
    }
    if (String(sub.service_name).length > String(match.service_name || '').length)
      patch.service_name = sub.service_name
    // A re-scan that finds a cancellation flips the existing row to inactive (→ "Cancelled" section).
    if (sub.cancelled) patch.is_active = false

    // Price-change detection: when a scanned row's amount actually changes, append to price_history.
    if (
      overwrite &&
      !isEmpty(sub.amount) &&
      !isEmpty(match.amount) &&
      Number(sub.amount) !== Number(match.amount)
    ) {
      const hist = Array.isArray(match.price_history) ? match.price_history : []
      patch.price_history = [...hist, { date: today(), from: Number(match.amount), to: Number(sub.amount) }]
    }

    let { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update(patch)
      .eq('id', match.id)
      .select()
      .single()
    // Graceful degradation if migration 0008 (price_history) isn't applied yet.
    if (error && /price_history|column .* does not exist/i.test(error.message || '')) {
      delete patch.price_history
      ;({ data } = await supabaseAdmin.from('subscriptions').update(patch).eq('id', match.id).select().single())
    }
    if (data) Object.assign(match, data) // keep in-memory copy current for subsequent matches
    await ensureRenewalAlert(profileId, match)
    return { saved: match, isNew: false }
  }

  const status = decideNewRowStatus(sub, kind)

  // A recurring item with a cycle but no detected next date → compute one so it gets a calendar slot
  // + a reminder (e.g. an annual plan whose email didn't state the renewal date).
  let nextChargeDate = sub.next_charge_date ?? null
  if (!nextChargeDate && (kind === 'subscription' || kind === 'mandate') && sub.billing_cycle) {
    try {
      nextChargeDate = nextDueDate(sub.billing_cycle, sub.charge_date || today(), new Date()) || null
    } catch {
      /* leave null */
    }
  }

  const { data: saved, error } = await supabaseAdmin
    .from('subscriptions')
    .insert({
      user_id: profileId,
      service_name: sub.service_name,
      kind,
      amount: sub.amount ?? null,
      currency: sub.currency || 'INR',
      billing_cycle: sub.billing_cycle ?? null,
      payment_method: sub.payment_method ?? null,
      next_charge_date: nextChargeDate,
      charge_date: sub.charge_date ?? null,
      last_seen_date: today(),
      is_trial: kind === 'trial',
      trial_end_date: sub.trial_end_date ?? null,
      is_active: sub.cancelled ? false : true, // cancelled detections land in the "Cancelled" section
      source: 'gmail',
      reminder_days: reminderDays,
      status,
    })
    .select()
    .single()

  if (error || !saved) return { saved: null, isNew: false }
  existingRows.push(saved)
  await ensureRenewalAlert(profileId, saved)
  return { saved, isNew: true }
}
