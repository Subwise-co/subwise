// Whole-account reconciliation, run once after a scan finishes. The per-email pass can't see the whole
// picture: a mandate-cancellation email often doesn't name the app (just "your mandate was cancelled" +
// an amount), so it can't be matched to the active mandate one email at a time. This pure pass looks at
// ALL the user's rows together and:
//   • applies each cancellation to the matching ACTIVE recurring row (by merchant name, else by amount),
//   • removes the now-redundant placeholder "Cancelled mandate" rows,
//   • collapses a bank-only mandate row (e.g. "IDFC FIRST Bank") into the real merchant row of the same
//     amount (e.g. "Facebook").
// Returns { cancelIds, deleteIds } — ids to mark cancelled (is_active=false) and ids to delete.
import { serviceTokens } from '@/lib/subscriptions'

const RECURRING_KINDS = new Set(['subscription', 'mandate'])
const BANK_ROOTS = new Set([
  'hdfc', 'icici', 'axis', 'sbi', 'kotak', 'idfc', 'indusind', 'yes', 'au', 'federal', 'rbl', 'baroda',
  'bob', 'pnb', 'canara', 'union', 'boi', 'idbi', 'bandhan', 'dbs', 'citi', 'hsbc', 'amex', 'paytm', 'razorpay',
])

const num = (v) => (v == null || v === '' ? null : Number(v))
// Mandate reference (SI ID / UMN / SiHubId) stored in payment_method as "… · ref:<ID>" — the PRIMARY,
// reliable key: it is stable across a mandate's creation and cancellation and is the only thing that
// disambiguates several mandates cancelled on the same card in the same session (the IDFC card-6593 case).
const refOf = (r) => {
  const m = /ref:([A-Za-z0-9]+)/i.exec(r?.payment_method || '')
  return m ? m[1].toLowerCase() : null
}
// Card / account last-4 parsed from the instrument text ("Debit card e-mandate (ending 6593)"). A WEAK key —
// shared across merchants (card 6593 = GCP + Anthropic + OpenAI) — so it only ever CORROBORATES, never
// identifies on its own. Requires a keyword (ending/card/a-c/account/masking) so a UMRN's digits aren't read.
const cardOf = (r) => {
  const m = /(?:ending|card|a\/c|acct|account|x{2,}|\*{2,})[^0-9a-z]{0,6}(\d{4})\b/i.exec(r?.payment_method || '')
  return m ? m[1] : null
}
// From a set of candidate active rows, return the SINGLE best match for a cancellation, narrowing an
// ambiguous set by card then amount. Returns null if it can't get down to exactly one (→ leave for the user;
// never guess-cancel the wrong mandate).
function pickOne(cands, ccard, camt) {
  if (cands.length === 1) return cands[0]
  if (!cands.length) return null
  let n = cands
  if (ccard) {
    const byCard = n.filter((a) => cardOf(a) === ccard)
    if (byCard.length) n = byCard
  }
  if (n.length > 1 && camt != null) {
    const byAmt = n.filter((a) => num(a.amount) === camt)
    if (byAmt.length) n = byAmt
  }
  return n.length === 1 ? n[0] : null
}
const isCancelled = (r) => r.is_active === false || r.cancelled === true
const isActiveRecurring = (r) =>
  !isCancelled(r) && r.status !== 'rejected' && RECURRING_KINDS.has(r.kind || 'subscription')

function isBankOnly(name) {
  const toks = String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !['bank', 'first', 'the', 'of', 'ltd', 'limited', 'and'].includes(t))
  return toks.length > 0 && toks.every((t) => BANK_ROOTS.has(t))
}

// Do two names share a meaningful token (so "Facebook" ~ "Facebook Se")? serviceTokens returns a Set.
function nameOverlap(a, b) {
  const ta = serviceTokens(a)
  for (const t of serviceTokens(b)) if (ta.has(t)) return true
  return false
}

export function reconcile(rows = []) {
  const cancelIds = new Set()
  const deleteIds = new Set()

  // A cancellation is useful if it carries a matching key: a mandate ref OR an amount.
  const cancellations = rows.filter((r) => isCancelled(r) && (num(r.amount) != null || refOf(r)))
  const actives = rows.filter(isActiveRecurring)

  // 1) Apply each cancellation to a matching active recurring row. Matching order = reliability order:
  //    ref (exact) → merchant name (corroborated by card/amount if several share the name) → refless
  //    fallback (card-last4 + amount, but ONLY when exactly one active matches — never guess on a tie).
  for (const c of cancellations) {
    const placeholder = /^cancelled mandate$/i.test(c.service_name || '')
    const cref = refOf(c)
    const ccard = cardOf(c)
    const camt = num(c.amount)
    let match = null

    // (a) Mandate reference — exact + stable across create↔cancel; the only thing that separates several
    // mandates cancelled on the same card. When it matches, stop (don't second-guess with weaker keys).
    if (cref) match = actives.find((a) => a.id !== c.id && refOf(a) === cref)

    // (b) Merchant name overlap (only when the cancel names a real merchant), narrowed by card/amount if
    // multiple actives share the name.
    if (!match && !placeholder) {
      match = pickOne(actives.filter((a) => a.id !== c.id && nameOverlap(a.service_name, c.service_name)), ccard, camt)
    }

    // (c) Refless / merchant-less: corroborate with card-last4 + amount. Cancel ONLY if it narrows to exactly
    // one active (0 or >1 → leave the cancellation row for the user — never cancel the wrong mandate).
    if (!match && (ccard || camt != null)) {
      let cands = actives.filter((a) => a.id !== c.id)
      if (ccard) cands = cands.filter((a) => cardOf(a) === ccard)
      if (camt != null) cands = cands.filter((a) => num(a.amount) != null && num(a.amount) === camt)
      if (cands.length === 1) match = cands[0]
    }

    if (match) {
      cancelIds.add(match.id)
      // The cancellation row was just a signal — drop the placeholder so we don't show a duplicate.
      if (placeholder) deleteIds.add(c.id)
    }
  }

  // 2) Collapse a bank-only active mandate into the real merchant row of the same amount.
  for (const a of actives) {
    if (!isBankOnly(a.service_name)) continue
    const merchant = actives.find(
      (b) => b.id !== a.id && !isBankOnly(b.service_name) && num(b.amount) != null && num(b.amount) === num(a.amount)
    )
    if (merchant) deleteIds.add(a.id)
  }

  return { cancelIds: [...cancelIds].filter((id) => !deleteIds.has(id)), deleteIds: [...deleteIds] }
}
