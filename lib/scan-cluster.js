// Stage-2 entity resolution: collapse the per-email verdicts (after mapVerdict + guards) into COMMITMENTS.
// A single real commitment is often smeared across 2–3 emails from 2–3 senders, each naming a different party
// (broker / clearing house / merchant). Name-only dedupe (lib/subscriptions.dedupeSubscriptions) can't merge
// those — it needs the JOIN KEYS that Session 1 attached to each verdict. See skills/scan_engine_plan.md §3.
//
// Two passes (chosen over naive pairwise to avoid over-merge):
//   1. STRONG merges (union-find): same mandate_ref · same merchant name (with same-kind OR amount agreement)
//      · same instrument (card/account) + amount + date. These are unambiguous.
//   2. ORPHAN ATTACH: a row that names only a clearing house / bank (the SIP NACH debit) attaches to the
//      SINGLE amount-matching recurring cluster (the fund). >1 candidate → a bounded LLM tie-break decides;
//      0 → it stays a pending row. This is the only place an LLM judges, and only for genuine ambiguity.
//
// Spines, by design: merchant identity is the cluster key (card/amount are corroboration, never identity —
// card 6593 is shared across GCP/Anthropic/OpenAI, which must stay 3 rows). Cancelled rows are NEVER merged
// here (cancellation→mandate matching is Session 3 reconcile) — they pass straight through.
import { serviceTokens, sameService } from '@/lib/subscriptions'
import { isClearingHouseName, isBankOnlyName } from '@/lib/parser'
import { parseISO, differenceInCalendarDays } from 'date-fns'

const recurringKind = (k) => k === 'subscription' || k === 'mandate'
const dateOf = (r) => r?.next_charge_date || r?.charge_date || r?.trial_end_date || null
// A row that does NOT confidently name a merchant — a clearing house ("Indian Clearing") or a bare bank.
const isOrphanRow = (r) => isClearingHouseName(r?.service_name) || isBankOnlyName(r?.service_name)

// Same currency, amounts within ₹1 or 3% (covers the ₹2,500 vs ₹2,499.88 SIP rounding).
function amountClose(a, b) {
  if (a?.amount == null || b?.amount == null) return false
  if ((a.currency || 'INR') !== (b.currency || 'INR')) return false
  const x = Number(a.amount)
  const y = Number(b.amount)
  if (!(x > 0) || !(y > 0)) return false
  const diff = Math.abs(x - y)
  return diff <= 1 || diff / Math.max(x, y) <= 0.03
}

function dateClose(a, b, days = 7) {
  const da = dateOf(a)
  const db = dateOf(b)
  if (!da || !db) return false
  try {
    return Math.abs(differenceInCalendarDays(parseISO(da), parseISO(db))) <= days
  } catch {
    return false
  }
}

function instrumentMatch(a, b) {
  if (a.card_last4 && b.card_last4 && a.card_last4 === b.card_last4) return true
  if (a.account_last4 && b.account_last4 && a.account_last4 === b.account_last4) return true
  return false
}

function merchantMatch(a, b) {
  const ta = serviceTokens(a.service_name)
  const tb = serviceTokens(b.service_name)
  if (!ta.size || !tb.size) return false
  return sameService(ta, tb)
}

// Pass-1 (deterministic, unambiguous) merge test.
export function shouldMerge(a, b) {
  // Exact mandate-reference match — the same mandate's emails (authoritative, overrides everything).
  if (a.mandate_ref && b.mandate_ref && a.mandate_ref === b.mandate_ref) return true

  const aOrphan = isOrphanRow(a)
  const bOrphan = isOrphanRow(b)

  // Two DIFFERENT real merchants NEVER merge — even if they share a bank account, card, amount and date.
  // (Two ₹2,500 SIPs debited from the same account are DIFFERENT funds: HDFC Silver ETF ≠ ICICI Prudential.)
  if (!aOrphan && !bOrphan && !merchantMatch(a, b)) return false

  if (merchantMatch(a, b)) {
    // Never merge two clearing-house / bank-only orphans on name alone (different mandates may share a bank).
    if (aOrphan && bOrphan) return false
    const aRec = recurringKind(a.kind)
    const bRec = recurringKind(b.kind)
    // Same kind, both recurring, or matching amount → same commitment (Anthropic receipt + "confirm monthly").
    if (a.kind === b.kind || (aRec && bRec) || amountClose(a, b)) return true
    // A no-amount echo (a same-merchant trial/marketing row with NO amount) folds into the paid row — so a
    // stray "Anthropic trial" merges into the real "Anthropic $23.60 subscription". A DIFFERENT amount stays
    // separate (Udemy course ₹612 ≠ Udemy Personal Plan ₹4500).
    if ((aRec && a.amount != null && b.amount == null) || (bRec && b.amount != null && a.amount == null)) return true
    return false
  }

  // At least one side is an orphan (no real merchant) → allow an instrument + amount + date charge match.
  if (instrumentMatch(a, b) && amountClose(a, b) && dateClose(a, b, 7)) return true
  return false
}

// The member that best identifies the cluster: a real merchant (not an orphan), confident, most identifying
// tokens, longest name.
function chooseRep(members) {
  const merchants = members.filter((m) => !isOrphanRow(m))
  const pool = merchants.length ? merchants : members
  return [...pool].sort((a, b) => {
    const ca = a.confidence === 'needs_confirmation' ? 1 : 0
    const cb = b.confidence === 'needs_confirmation' ? 1 : 0
    if (ca !== cb) return ca - cb
    const ta = serviceTokens(a.service_name).size
    const tb = serviceTokens(b.service_name).size
    if (ta !== tb) return tb - ta
    return String(b.service_name || '').length - String(a.service_name || '').length
  })[0]
}

function resolveCluster(members) {
  if (members.length === 1) return members[0]
  const rep = chooseRep(members)
  // first non-null value for a field, checking the rep first, then (optionally) recurring members first.
  const firstNonNull = (field, recurringFirst = false) => {
    const ordered = recurringFirst
      ? [...members].sort((a, b) => (recurringKind(b.kind) ? 1 : 0) - (recurringKind(a.kind) ? 1 : 0))
      : members
    for (const m of [rep, ...ordered]) if (m[field] != null && m[field] !== '') return m[field]
    return null
  }
  const kind = members.some((m) => m.kind === 'subscription')
    ? 'subscription'
    : members.some((m) => m.kind === 'mandate')
      ? 'mandate'
      : members.some((m) => m.kind === 'trial')
        ? 'trial'
        : 'one_time'
  const aliases = new Set()
  for (const m of members) {
    ;(m.merchant_aliases || []).forEach((a) => aliases.add(a))
    if (m !== rep && m.service_name) aliases.add(m.service_name)
  }
  const confident = members.some((m) => !isOrphanRow(m) && m.confidence !== 'needs_confirmation')
  return {
    ...rep,
    service_name: rep.service_name,
    kind,
    is_trial: kind === 'trial',
    amount: firstNonNull('amount'),
    currency: firstNonNull('currency'),
    billing_cycle: kind === 'one_time' ? null : firstNonNull('billing_cycle', true),
    next_charge_date: firstNonNull('next_charge_date', true),
    charge_date: firstNonNull('charge_date'),
    trial_end_date: firstNonNull('trial_end_date'),
    card_last4: firstNonNull('card_last4'),
    account_last4: firstNonNull('account_last4'),
    mandate_ref: firstNonNull('mandate_ref'),
    payment_method: firstNonNull('payment_method'),
    merchant_aliases: [...aliases],
    confidence: confident ? 'confirmed' : rep.confidence || 'needs_confirmation',
  }
}

// Ask the model which existing commitment an amount-matching orphan debit belongs to (only when >1 candidate).
async function tieBreak(orphan, candidates, llm) {
  const list = candidates
    .map((c, i) => {
      const r = chooseRep(c.members)
      return `${i + 1}. ${r.service_name} — ${r.currency || 'INR'} ${r.amount}`
    })
    .join('\n')
  const prompt = `An auto-debit of ${orphan.currency || 'INR'} ${orphan.amount} was executed; the bank email names only a clearing house ("${orphan.service_name}"), not the merchant. Which of these existing commitments is this debit paying? Reply with ONLY the number, or 0 if none.\n${list}`
  const text = await llm(prompt)
  const m = String(text || '').match(/\d+/)
  const idx = m ? Number(m[0]) : 0
  return idx >= 1 && idx <= candidates.length ? candidates[idx - 1] : null
}

// Attach lone clearing-house/bank orphans to the single amount-matching recurring cluster (LLM tie-break only
// when >1 candidate). Mutates `clusters`; returns the surviving clusters.
async function attachOrphans(clusters, llm) {
  const isLoneOrphan = (c) => c.members.length === 1 && isOrphanRow(c.members[0])
  for (const o of clusters.filter(isLoneOrphan)) {
    const orow = o.members[0]
    const targets = clusters.filter(
      (t) => t !== o && !t._attached && t.members.some((m) => recurringKind(m.kind)) && amountClose(orow, chooseRep(t.members))
    )
    let chosen = null
    if (targets.length === 1) chosen = targets[0]
    else if (targets.length > 1 && llm) chosen = await tieBreak(orow, targets, llm).catch(() => null)
    if (chosen) {
      chosen.members.push(orow)
      o._attached = true
    }
  }
  return clusters.filter((c) => !c._attached)
}

// Collapse parsed rows into commitments. `llm` (optional) is the cluster-pool text generator used ONLY for the
// rare >1-candidate orphan tie-break; without it the engine is fully deterministic (and unit-testable).
export async function clusterCommitments(rows, { llm } = {}) {
  const list = (rows || []).filter(Boolean)
  const cancelled = list.filter((r) => r.cancelled)
  const active = list.filter((r) => !r.cancelled)

  // Pass 1 — union-find over the strong, unambiguous merges.
  const parent = active.map((_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (shouldMerge(active[i], active[j])) {
        const ri = find(i)
        const rj = find(j)
        if (ri !== rj) parent[rj] = ri
      }
    }
  }
  const byRoot = new Map()
  active.forEach((row, i) => {
    const r = find(i)
    if (!byRoot.has(r)) byRoot.set(r, { members: [] })
    byRoot.get(r).members.push(row)
  })

  // Pass 2 — attach orphans, then resolve each cluster to one row.
  const clusters = await attachOrphans([...byRoot.values()], llm)
  const resolved = clusters.map((c) => resolveCluster(c.members))
  return [...resolved, ...cancelled]
}
