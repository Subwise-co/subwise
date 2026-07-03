// AI parser — provider-agnostic via lib/llm (Groq Llama 4 Scout primary, Gemini fallback).
//
// Process (redesigned for reliability + clear segmentation):
//   • SMALL batches (default 12). At larger sizes the model silently collapses a batch to a few rows
//     and drops the rest — and which it drops varies per run, so the dashboard was inconsistent and
//     lost real items (the Facebook mandate, Google Workspace trial). Small batches make it classify
//     EVERY email.
//   • ONE verdict per email, each tagged with a `category`:
//       active | mandate | trial | one_time | cancelled | needs_confirmation | ignore
//     "ignore" forces the model to account for marketing/ads/mentions explicitly instead of dropping
//     them, which is what keeps real items from being dropped alongside them.
//   • We map the category to the stored schema (kind / confidence / cancelled), then platform-filter
//     and fuzzy-dedupe across batches.
import { generateText } from '@/lib/llm'
import { extractJsonArray } from '@/lib/subscriptions'
import { clusterCommitments } from '@/lib/scan-cluster'

// Keep batches small so the model gives a verdict for EVERY email (see note above). Env-tunable.
const BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE) || 12

// Bank/processor roots — a mandate named ONLY by the bank (e.g. "HDFC Bank", "IDFC FIRST Bank") names
// the wrong thing: a mandate must identify the MERCHANT, not the bank that executes it. We don't trust
// such a row as Active — it becomes Needs-confirmation so the user decides.
const BANK_ROOTS = new Set([
  'hdfc', 'icici', 'axis', 'sbi', 'statebank', 'kotak', 'idfc', 'indusind', 'yes', 'au', 'federal', 'rbl',
  'baroda', 'bob', 'pnb', 'canara', 'union', 'boi', 'idbi', 'bandhan', 'dbs', 'citi', 'hsbc', 'standard',
  'chartered', 'amex', 'paytm', 'razorpay',
])
// True when the whole name is essentially just a bank/processor (after dropping bank/first/the/etc.).
export function isBankOnlyName(name) {
  const toks = String(name || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !['bank', 'first', 'the', 'of', 'ltd', 'limited', 'and'].includes(t))
  return toks.length > 0 && toks.every((t) => BANK_ROOTS.has(t))
}

// Corporate-entity noise to strip from a merchant's legal name for a clean display label
// ("FACEBOOK INDIA ONLINE SERVICES PRIVATE LIMITED" → "Facebook").
const CORP_SUFFIX = new Set([
  'india', 'online', 'services', 'service', 'private', 'limited', 'pvt', 'ltd', 'llp', 'inc', 'llc',
  'corporation', 'corp', 'incorporated', 'technologies', 'technology', 'solutions', 'co', 'company',
])
export function cleanServiceName(name) {
  const raw = String(name || '').trim()
  if (!raw) return raw
  const toks = raw.split(/\s+/)
  const kept = toks.filter((t) => !CORP_SUFFIX.has(t.toLowerCase().replace(/[^a-z]/g, '')))
  const result = (kept.length ? kept : toks.slice(0, 1)).join(' ')
  // Title-case names that arrived ALL-CAPS (legal names usually are).
  return raw === raw.toUpperCase() ? result.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : result
}

// Prepaid mobile/DTH RECHARGE deterministic guard. A prepaid recharge is a ONE-TIME payment even though
// it buys "monthly"/"28-day" validity — the model often mislabels it "active monthly" off the validity
// window. If a recurring row is a known telecom/DTH brand and the email body reads like a prepaid recharge
// (recharge/prepaid/validity/data pack/talktime) with NO standing-instruction/autopay set up, flip it to a
// one-time payment. Postpaid/AutoPay (which DO say mandate/autopay/standing instruction) are left alone.
const TELECOM_BRAND = /\b(airtel|jio|vodafone|\bvi\b|idea|bsnl|mtnl|tata\s*play|tataplay|dish\s*tv|d2h|sun\s*direct|videocon)\b/i
const RECHARGE_SIGNAL = /\b(recharge|prepaid|top[\s-]?up|validity|data\s*pack|talktime|talk\s*time|plan voucher)\b/i
const AUTOPAY_SIGNAL = /\b(autopay|auto[\s-]?pay|auto[\s-]?debit|mandate|standing instruction|e-?nach|nach|si\b|subscription renew)\b/i
export function isPrepaidRecharge(serviceName, emailText) {
  const text = String(emailText || '')
  if (!TELECOM_BRAND.test(`${serviceName || ''} ${text}`)) return false
  return RECHARGE_SIGNAL.test(text) && !AUTOPAY_SIGNAL.test(text)
}

// Last 4 digits of a card/account identifier ("XXXX4777", "ending 6593", "card-6593") or null.
const last4 = (v) => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length >= 4 ? d.slice(-4) : null
}

// Clearing-house / NACH settlement entities name the INTERMEDIARY that moves the money, never the merchant
// (a SIP bank-debit reads "… debited towards Indian Clearing Corporation Ltd"). Such a row must never be
// asserted as a confident subscription — it's downgraded to needs_confirmation and its account_last4 /
// mandate_ref kept so Stage-2 clustering can attach it to the real fund (from the "units allocated" email).
// Match the CLEANED name too: cleanServiceName strips "Corporation"/"Ltd", so "Indian Clearing Corporation
// Ltd" arrives here as "Indian Clearing" — hence the bare "indian clearing" / "clearing corp" alternatives.
const CLEARING_HOUSE = /\b(indian\s+clearing|clearing\s+corp|n\.?p\.?c\.?i\b|national\s+payments?\s+corporation|bharat\s+bill\s*pay|\bbbps\b)\b/i
export function isClearingHouseName(name) {
  return CLEARING_HOUSE.test(String(name || ''))
}

// A PAST-TENSE receipt of a payment already made, with NO autopay/mandate and NO future renewal/charge date,
// is a discrete one-time payment — even for a service that could be recurring (a postpaid Airtel
// "payment receipt ₹300"). Generalises the prepaid-recharge guard to any receipt. RECURRING_HINT keeps real
// plans/SIPs/mandates (anything stating a renewal, a mandate, or a next charge) classified as recurring.
const PAST_RECEIPT = /\b(payment\s+receipt|receipt\s+(for|from)|order\s+(placed|confirmed)|paid\s+successfully|payment\s+(of|received|successful)|successfully\s+(paid|charged)|has\s+been\s+(paid|debited)|we\s+charged|thank\s+you\s+for\s+your\s+(order|purchase|payment))\b/i
const RECURRING_HINT = /\b(renew(s|ed|al|ing)?|auto-?renew(s|ed|al|ing)?|subscription|subscribe|recurring|instal?ment|\bsip\b|mandate|auto-?pay|autopay|standing\s+instruction|e-?nach|\bnach\b|\bumrn\b|\bumn\b|next\s+(charge|billing|payment|instal?ment)|will\s+be\s+(charged|debited|renewed))\b/i
export function isPastReceipt(emailText) {
  const text = String(emailText || '')
  return PAST_RECEIPT.test(text) && !RECURRING_HINT.test(text)
}

// "Auto-renews on <date> for <amount>" is the strongest recurring signal — an order/receipt that is really a
// recurring registration (e.g. a GoDaddy domain: paid ₹499 now, auto-renews next year for ₹749).
const AUTO_RENEW = /\bauto-?renew(s|ed|al|ing)?\b/i
export function hasAutoRenew(emailText) {
  return AUTO_RENEW.test(String(emailText || ''))
}

// Explicit recurring cadence in the body ("your monthly payment", "billed annually", "per month") promotes a
// row the model called one_time to a subscription — e.g. Anthropic "Confirm your $23.60 monthly payment". This
// is NOT applied to a past-tense receipt (a one-off payment already made stays one_time even if it names a
// cycle, e.g. an Airtel postpaid receipt). Returns 'monthly' | 'annual' | null.
const CADENCE_ANNUAL = /\b(annual payment|billed (annually|yearly)|charged (annually|yearly)|per year|\/yr\b|every year|renews annually)\b/i
const CADENCE_MONTHLY = /\b(monthly payment|recurring payment|billed monthly|charged (monthly|every month)|per month|\/mo\b|every month|your monthly (payment|subscription|charge)|subscription renews)\b/i
export function recurringCadence(emailText) {
  const t = String(emailText || '')
  if (CADENCE_ANNUAL.test(t)) return 'annual'
  if (CADENCE_MONTHLY.test(t)) return 'monthly'
  return null
}

// Cheap pre-filter to skip emails that are NEVER a payment, BEFORE spending an LLM call on them — judged on
// the SUBJECT only (a real receipt never carries these in its subject), so it can't false-drop a payment.
// Saves Groq calls on a large inbox; bigger savings (verdict cache by message-id) come with the Phase-4
// evidence table. Deliberately narrow: OTP / verification codes / calendar invites.
const PREFILTER_NOISE =
  /\b(otp|one[\s-]?time\s*password|verification\s*code|security\s*code|login\s*code|2fa)\b|(calendar\s*invit|\.ics\b|meeting\s*invite|^(accepted|declined|invitation):)/i
export function isObviousNoise(email) {
  const subject = String(email?.subject || '').trim()
  return !!subject && PREFILTER_NOISE.test(subject)
}

// NOISE the model keeps mislabelling as a real item (live-eval misses). Deterministic drops:
// • DUNNING / failed-payment ("payment failed", "couldn't charge", "update your payment method") — a FAILURE
//   notice, not a successful recurring charge (the real row comes from the actual receipt/mandate).
// • TRIAL MARKETING ("start your free trial", "try X free", "no charge today") — an OFFER, not a trial the
//   user started. Distinguished from a STARTED trial ("your trial has begun", "trial ends on …") which we keep.
// • LAPSED trial ("trial expired/ended") with no charge — over, not an active commitment.
const DUNNING = /\b(payment (failed|declined|unsuccessful)|unable to (process|charge)|could ?n.?t charge|please update your (card|payment|billing)|update your (card|payment method|billing details)|payment (is )?(overdue|past due)|insufficient (balance|funds)|we (could ?n.?t|were unable to) (charge|process))\b/i
const TRIAL_OFFER = /\b(free trial|start (your |a )?trial|try\b[\w\s]{0,25}\bfree|unlock[\w\s]{0,30}for free|free for \d+ (day|week|month)|claim your free|no charge today)\b/i
// A trial the user actually STARTED (keep). Includes the billing-setup signals of a real trial account
// (Google Workspace: "set up billing", "won't be charged until your free trial ends", "billing info received").
const TRIAL_STARTED = /\b(trial (has )?(started|begun)|trial (is )?active|trial ends? (on|in)|days? (left|remaining)[\w\s]{0,14}trial|won'?t be charged until|until your (free )?trial ends|set up billing|billing (info|information)( was)? received|finish setting up)\b/i
const TRIAL_EXPIRED = /\b(trial (has |period |period has )?expired|trial (has )?ended|your trial is over)\b/i
// Real money was actually CHARGED (vs merely a price quoted in a promo, or a FUTURE "won't be charged"). The
// lookbehind excludes "be charged" so "you won't be charged until your trial ends" is NOT read as a charge.
const CHARGE_MADE = /\b(paid|debited|receipt|invoice|payment (of|received|successful)|order (placed|confirmed)|we charged|has been (paid|debited|charged)|successfully (paid|charged)|amount (paid|charged)|transaction (of|id))\b|(?<!\bbe )\bcharged\b/i
// Explicit FREE-TRIAL / billing-setup language (a trial the user started, no money yet) used to flip a row the
// model called a paid subscription back to a trial. Narrow on purpose (NOT a bare "trial ends in N days", which
// a real renewal reminder can also say) — requires free-trial or billing-setup wording.
const TRIAL_NOCHARGE = /\b(free trial|won'?t be charged until|until your (free )?trial ends|trial period|set up billing|finish setting up)\b/i
// OWNERSHIP / renewal language that proves the user actually HOLDS this plan (vs a marketing email that merely
// names a brand + a price). Combined with CHARGE_MADE / trial signals, this is what lets a row be CONFIRMED;
// without ANY of them, a "subscription" the model invented from a feature-promo stays needs_confirmation.
const OWNERSHIP = /\b(your (subscription|plan|membership|policy|premium|account|monthly payment|annual payment|sip|order|booking)|you'?re subscribed|renew(s|ed|al|ing)?|next (billing|charge|payment|instal?ment)|auto-?renew|standing instruction|e-?mandate|auto-?pay|\bnach\b|\bumrn\b|units (allocated|allotted)|instal?ment|\bsip\b|premium (due|reminder)|has renewed|will be (charged|debited|renewed))\b/i
export function hasConfirmSignal(emailText) {
  const t = String(emailText || '')
  return CHARGE_MADE.test(t) || OWNERSHIP.test(t) || TRIAL_NOCHARGE.test(t)
}
// A FEATURE-ANNOUNCEMENT / product-update / upsell marketing email — even if it names a plan or a price, it is
// NOT a subscription the user holds. Drop it UNLESS it shows a real charge OR a trial/billing signal (those are
// real commitments we keep). Phrases taken from the founder's actual mis-scanned emails (Atlassian "Extend Jira
// with…", Claude "Run multiple tasks with Cowork / Let Cowork do something", Replit/Notion "what's new/recap").
const PROMO = /\b(what'?s new|see what you can do|get the most out of|explore your|explore what|take[\w\s]{1,24}further|extend[\w\s]{1,24}with|run multiple tasks|week in review|[\w]{0,12}\s?recap\b|introducing |new episode|let[\w\s]{1,20}do something|come back to|we miss you|level up|discover what)\b/i
const TRIAL_BILLING = /\b(free trial|trial (ends|period|started|begun)|set up billing|add (a )?(form of )?payment|won'?t be charged until|billing (info|information)|days? (left|remaining))\b/i
// A mandate whose email uses CAP language ("up to … as presented") is a usage cap; one without it is a FIXED
// recurring debit (a SIP / EMI / fixed card SI) and should be treated as a subscription (exact amount, counted).
const MANDATE_CAP = /\b(up\s?to|upto|as\s+presented|a\s+maximum|maximum\s+of|max\b)\b/i
export function isCappedMandate(emailText) {
  return MANDATE_CAP.test(String(emailText || ''))
}
export function isMarketingPromo(emailText) {
  const t = String(emailText || '')
  return PROMO.test(t) && !CHARGE_MADE.test(t) && !TRIAL_BILLING.test(t)
}
export function isDunning(emailText) {
  return DUNNING.test(String(emailText || ''))
}
export function isTrialOffer(emailText) {
  return TRIAL_OFFER.test(String(emailText || ''))
}
export function isTrialStarted(emailText) {
  return TRIAL_STARTED.test(String(emailText || ''))
}
export function isTrialExpired(emailText) {
  return TRIAL_EXPIRED.test(String(emailText || ''))
}

// Apply the deterministic guards to a mapped verdict, reading the source email. Ordered so the stronger
// signal wins. Exported so the logic is unit-testable without a live model. Mutates + returns `mapped`.
export function refineWithGuards(mapped, email) {
  if (!mapped || mapped.cancelled) return mapped
  const body = `${email?.subject || ''} ${email?.body || ''}`
  const date = email?.date || null

  // NOISE DROP (return null): the model keeps tagging these as a real item. A failed/owed payment is not a
  // commitment; a feature-promo/upsell is not a held plan; a "start your free trial" offer is not a started
  // trial; a lapsed trial (no charge) is over.
  if (isDunning(body)) return null
  if (isMarketingPromo(body)) return null
  if (isTrialExpired(body) && mapped.amount == null) return null
  if (mapped.kind === 'trial' && isTrialOffer(body) && !isTrialStarted(body)) return null

  // A subscription the model invented from "free trial / won't be charged until trial ends / set up billing"
  // (no actual charge) is really a TRIAL, not a paid plan — e.g. Google Workspace Business Base trial.
  if (mapped.kind === 'subscription' && TRIAL_NOCHARGE.test(body) && !CHARGE_MADE.test(body)) {
    mapped.kind = 'trial'
    mapped.is_trial = true
  }

  const recurring = mapped.kind === 'subscription' || mapped.kind === 'mandate'

  // Clearing-house name → ask, never assert (keep the kind + join keys for clustering).
  if (recurring && isClearingHouseName(mapped.service_name)) mapped.confidence = 'needs_confirmation'

  // A mandate WITHOUT cap language ("up to … as presented") is a FIXED recurring debit (a SIP / EMI / fixed
  // card SI) — store it as a subscription so it shows the EXACT amount and counts toward the monthly total.
  // Only a true usage cap stays a "mandate" (shown "up to ₹X", excluded from the definite total).
  if (mapped.kind === 'mandate' && mapped.amount != null && !isCappedMandate(body)) {
    mapped.kind = 'subscription'
  }

  // Prepaid telecom/DTH recharge → one-time.
  if (recurring && isPrepaidRecharge(mapped.service_name, body)) {
    mapped.kind = 'one_time'
    mapped.billing_cycle = null
    mapped.next_charge_date = null
    mapped.charge_date = mapped.charge_date || date || null
  }

  // Past-tense receipt with no autopay/mandate/renewal → one-time (skip clearing-house + ref'd mandate rows).
  if (
    (mapped.kind === 'subscription' || mapped.kind === 'mandate') &&
    !mapped.mandate_ref &&
    !isClearingHouseName(mapped.service_name) &&
    isPastReceipt(body)
  ) {
    mapped.kind = 'one_time'
    mapped.billing_cycle = null
    mapped.next_charge_date = null
    mapped.charge_date = mapped.charge_date || date || null
  }

  // "Auto-renews on <date> for <amount>" → an annual (or stated-cycle) subscription, not a one-off order.
  if (mapped.kind === 'one_time' && hasAutoRenew(body) && (mapped.renewal_amount != null || mapped.next_charge_date)) {
    mapped.kind = 'subscription'
    mapped.billing_cycle = mapped.billing_cycle || 'annual'
    if (mapped.renewal_amount != null) mapped.amount = mapped.renewal_amount
    if (!mapped.confidence) mapped.confidence = 'confirmed'
  }

  // Explicit recurring cadence ("your monthly payment", "billed annually") on a non-receipt → subscription.
  // Catches the Anthropic "Confirm your $23.60 monthly payment" the model sometimes mislabels one_time.
  if (mapped.kind === 'one_time' && mapped.amount != null && !isPastReceipt(body)) {
    const cad = recurringCadence(body)
    if (cad) {
      mapped.kind = 'subscription'
      mapped.billing_cycle = mapped.billing_cycle || cad
      mapped.charge_date = null
      if (!mapped.confidence) mapped.confidence = 'confirmed'
    }
  }

  // CONFIRMATION GATE: a subscription/trial the model produced with NO charge, ownership/renewal, or trial
  // signal is very likely invented from a marketing/feature-promo email (a brand + a price, but the user
  // doesn't hold it). Don't auto-assert it — drop to needs_confirmation so it lands in "needs confirmation"
  // (excluded from totals) for the user to reject, instead of counting as a real active subscription.
  if ((mapped.kind === 'subscription' || mapped.kind === 'trial') && !hasConfirmSignal(body)) {
    mapped.confidence = 'needs_confirmation'
  }

  return mapped
}

// Map a model verdict (category + fields) to the stored schema, or null to drop it.
export function mapVerdict(o) {
  const cat = String(o?.category || '').toLowerCase().replace(/[\s-]/g, '_')
  if (!cat || cat === 'ignore') return null
  // Normalize the billing cycle to the canonical set the rest of the app expects (the model sometimes
  // returns "yearly"/"per year"/"month"); a stray "yearly" would break annual amortization in ghost spend.
  const cycleRaw = String(o.billing_cycle || '').toLowerCase()
  let billing_cycle = /year|annual/.test(cycleRaw)
    ? 'annual'
    : /month/.test(cycleRaw)
      ? 'monthly'
      : /week/.test(cycleRaw)
        ? 'weekly'
        : null
  // Treat ₹0 as "no amount" — a zero charge is a notification, not a payment.
  const amt = o.amount == null || Number(o.amount) === 0 ? null : Number(o.amount)
  // Mandate reference (SI ID / UMN / e-mandate id) links a creation email to its cancellation. Store it
  // inside payment_method as "… · ref:<ID>" (no schema change) so reconcile can match by reference.
  const ref = o.mandate_ref ? String(o.mandate_ref).trim().replace(/[^A-Za-z0-9]/g, '') : ''
  const payment_method = [o.payment_method || null, ref ? `ref:${ref}` : null].filter(Boolean).join(' · ') || null
  const base = {
    service_name: cleanServiceName(o.service_name),
    amount: amt,
    currency: o.currency ?? null,
    billing_cycle,
    payment_method,
    trial_end_date: o.trial_end_date ?? null,
    next_charge_date: o.next_charge_date ?? null,
    charge_date: o.charge_date ?? null,
    // ── Stage-2 clustering join keys. In-memory only — scan-write.js inserts an explicit column list, so
    // these ride along on the verdict (and feed the future clustering pass) without touching the DB. ──
    mandate_ref: ref || null,
    card_last4: last4(o.card_last4),
    account_last4: last4(o.account_last4),
    merchant_aliases: Array.isArray(o.merchant_aliases)
      ? o.merchant_aliases.map((s) => String(s || '').trim()).filter(Boolean)
      : [],
    renewal_amount: o.renewal_amount == null || Number(o.renewal_amount) === 0 ? null : Number(o.renewal_amount),
    is_recurring_signal: o.is_recurring_signal ? String(o.is_recurring_signal).toLowerCase().trim() : null,
  }
  const hasDate = !!(base.next_charge_date || base.trial_end_date || base.charge_date)
  const hasSignal = base.amount != null || hasDate || !!ref
  // DROP NOISE: a recurring/trial candidate with neither an amount nor any date isn't actionable
  // (newsletters, "welcome to Premium", free signups). Mandates can stay (a standing authorization is
  // itself the signal), everything else needs a real signal.
  if (!hasSignal && cat !== 'mandate' && cat !== 'cancelled') return null
  // A recurring item with a charge date but no detected cycle is almost always monthly (e.g. SIPs) —
  // default it so it stays "active" and rolls forward instead of being treated as a one-off that expires.
  if (!billing_cycle && base.next_charge_date && (cat === 'active' || cat === 'mandate')) {
    billing_cycle = 'monthly'
    base.billing_cycle = 'monthly'
  }
  // Deterministic backstop: a mandate/subscription named only by the bank (the merchant wasn't resolved)
  // is downgraded to needs_confirmation rather than asserted as an active charge.
  const bankOnly = isBankOnlyName(base.service_name)

  switch (cat) {
    case 'active':
      return { ...base, kind: 'subscription', confidence: bankOnly ? 'needs_confirmation' : 'confirmed' }
    case 'mandate':
      return { ...base, kind: 'mandate', confidence: bankOnly ? 'needs_confirmation' : 'confirmed' }
    case 'trial':
      // Guard: a "trial" that carries paid-subscription data — a real amount + a billing cycle + a
      // renewal date but NO trial-end date — is actually a paid plan the model mislabeled (e.g. Udemy
      // "your paid subscription started", ₹4500/yr). Reclassify it as an active subscription.
      if (base.trial_end_date == null && base.amount != null && base.billing_cycle && base.next_charge_date) {
        return { ...base, kind: 'subscription', confidence: 'confirmed' }
      }
      return { ...base, kind: 'trial', is_trial: true, confidence: 'confirmed' }
    case 'one_time':
      return { ...base, kind: 'one_time', confidence: 'confirmed' }
    case 'cancelled':
    case 'canceled':
      // A cancellation email may not name the app (just "e-mandate <ref> is cancelled"). Keep it with a
      // placeholder name when it carries a matching key (mandate ref OR amount) so reconciliation can link
      // it to the active mandate; without any key it's not useful → drop.
      if (!base.service_name) {
        if (ref || base.amount != null) base.service_name = 'Cancelled mandate'
        else return null
      }
      return { ...base, kind: 'subscription', cancelled: true, confidence: 'confirmed' }
    case 'needs_confirmation':
      return { ...base, kind: 'subscription', confidence: 'needs_confirmation' }
    default:
      return null // unknown category → drop
  }
}

// `stats` (optional) collects { batches, failed, provider } so the caller can distinguish
// "genuinely nothing found" from "every AI call was rate-limited / failed".
export async function parseSubscriptions(emails, stats = {}) {
  stats.batches = 0
  stats.failed = 0
  if (!emails.length) return []
  const allResults = []

  // Pre-filter: skip emails that are never a payment (OTP / verification / calendar invites), judged on the
  // subject only so a real receipt is never dropped. Saves Groq calls before we ever batch.
  const candidates = emails.filter((e) => !isObviousNoise(e))
  stats.prefiltered = emails.length - candidates.length

  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE)
    const emailList = batch
      .map(
        (e, idx) =>
          `${idx + 1}. Subject: ${e.subject} | From: ${e.sender} | Date: ${e.date}\n   Body: ${e.body || ''}`
      )
      .join('\n')

    const prompt = `You classify emails for an Indian subscription tracker. You receive a numbered list of emails (Subject, From, Date received, Body).
Output a JSON array with EXACTLY ${batch.length} objects — ONE per email, in order, each carrying the email's "n". Never skip, merge, or summarize; classify EVERY email (use "ignore" for anything that is not the user's own subscription/payment).

Each object:
- n: the email's number (1-based)
- category: one of
  • "active" — a recurring paid plan the user CURRENTLY holds (incl. a mutual-fund/ETF SIP, or a wallet/UPI recurring charge). Evidence of a real PAYMENT/plan: a receipt, "your paid subscription", "payment of", "your subscription renews", "units allocated", "instalment due", "membership is active", a recurring auto-debit that was executed, or any amount actually charged together with a billing cycle. A future date on a paid plan is the NEXT charge (use next_charge_date), NOT a trial end.
  • "mandate" — ANY standing authorization to AUTO-DEBIT the user on a recurring basis, in ANY of its Indian forms: UPI AutoPay (NPCI), e-NACH / NACH, debit/credit-card Standing Instruction (SI), a bank e-mandate (HDFC / ICICI / Axis / SBI / Kotak / IDFC / IndusInd / Yes / AU / Federal …), or wallet autopay (Paytm / PhonePe / Google Pay / Amazon Pay). Signals: "mandate registered / approved / created / executed / successful", "AutoPay set up", "you have authorised", "an amount of up to ₹X will be debited", "standing instruction set". INCLUDE these even though the email is FROM a bank / payment processor / wallet — service_name = the MERCHANT or biller named in the body (e.g. "Facebook", "Google", a fund house, a SaaS tool), NEVER the bank/processor/wallet. Judge by the BEHAVIOUR (a recurring auto-debit the user set up), not by whether you recognise the provider — new/unfamiliar billers count too. The service_name MUST be the MERCHANT — NEVER a bank/processor name. If the email only names the bank (e.g. "HDFC Bank", "IDFC FIRST Bank") and you cannot find the merchant in the body, set category to "needs_confirmation" (do NOT output the bank as the service_name). A bare bank "Standing Instruction Through NEFT"/IMPS transfer with NO third-party merchant is usually the user's OWN transfer (rent/savings/family) → use "needs_confirmation" with the beneficiary name if present, never the bank. Use ONE consistent merchant name across that merchant's emails (don't vary "Facebook" vs "Facebook India Online Services Pvt Ltd").
  • "trial" — a FREE trial the user started (no money charged yet): "your free trial", "trial ends", "N days left in your trial", "your trial started". A trial has NO amount charged. If the user is actually PAYING (a receipt, "paid subscription", or a charged amount with a billing cycle), it is "active", NOT "trial".
  • "one_time" — a single non-recurring purchase, order/receipt, or account/wallet TOP-UP (e.g. "we charged $5.90 to fund your OpenAI credits"). ALSO a one-off **prepaid mobile / DTH RECHARGE** or a one-time **utility bill payment** (Airtel / Jio / Vi / Tata Play / electricity / gas) where NO autopay mandate was set up — a recharge/bill paid once is "one_time", NOT a subscription. (Only classify telecom/utility as "mandate" if the email explicitly says an AutoPay/mandate/standing-instruction was registered.) A purchase with NO amount (or ₹0) is not a payment → "ignore".
  • "cancelled" — an email confirming a subscription/mandate was CANCELLED / ended / revoked / "will not renew" / "your membership has ended" / "has been canceled". THIS INCLUDES a bank e-mandate / UPI AutoPay / standing-instruction being cancelled or revoked, EVEN WHEN it names no merchant and no amount — e.g. "your e-mandate SiHubId XXXX is cancelled" → category "cancelled", and put XXXX in mandate_ref. Never mark such a cancellation "ignore".
  • "needs_confirmation" — plausibly the user's subscription but the email is genuinely ambiguous (a generic product/feature email that could be a free tier).
  • "ignore" — everything else: MARKETING/ADS; WIN-BACK / "come back" / "restart" / promo-price offers to (re)subscribe (e.g. Spotify "Come back to Premium for ₹99" — the ₹99 is an OFFER, not a charge); a brand merely MENTIONED inside a newsletter/blog/podcast/ad sent by a DIFFERENT sender (e.g. "Netflix" inside someone else's newsletter); pricing offers the user never bought; GOVERNMENT micro-insurance/pension only (PMSBY, PMJJBY, APY) and bank/card FEES; OTP/login/security; shipping/delivery; pure newsletters; reward-credited notices; a LAPSED/EXPIRED trial that asks you to upgrade with NO charge ("your trial has expired", "upgrade now" — NOT an active trial and NOT a paid plan); a FREE signup / "your account is ready" / "your free plan is ready" / "account funded with credits" where NO real money was charged ($0); a DUNNING / failed-payment notice ("payment failed", "action required", "update your card", "your payment is overdue").
- service_name: the PRODUCT/MERCHANT being paid for — never the bank/email sender. null when category is "ignore". For a mutual-fund/ETF SIP, use the FUND/SCHEME name from the body (e.g. "HDFC Silver ETF FoF"), NEVER the broker ("Groww"/"Zerodha"/"Kuvera"). Use ONE consistent name per fund.
- amount: number or null — the TOTAL actually charged, INCLUDING taxes/fees (if body shows "20 + 3.60 tax = 23.60", use 23.60) and NET of any voucher/discount/credit ("Subtotal ₹150.40 − voucher ₹100 = Total ₹50.40" → use 50.40). Leave null for an unpaid promo/offer price.
- currency: ISO code matching the body — "INR" for ₹/Rs, "USD" for $, "EUR" for €, "GBP" for £. Don't assume INR for a non-₹ amount.
- billing_cycle: "monthly" | "annual" | "weekly" | null (year/yearly/12 months → "annual"; don't guess).
- payment_method: for "mandate", describe the instrument, e.g. "Debit card e-mandate (ending 6593)"; else null.
- mandate_ref: for a "mandate" creation OR a mandate "cancelled" email, the exact mandate reference shown — SI ID / E-Mandate Id / UMN / SiHubId / mandate reference / reference number (e.g. "YWI0O4Sdsv"); else null. This is the ONLY reliable way a cancellation is matched back to its creation, so ALWAYS extract it on BOTH the creation AND the cancellation email whenever ANY such identifier appears — even when the cancellation names no merchant and no amount (just "e-mandate <ID> is cancelled"). If several IDs appear, use the one labelled SI ID / UMN / SiHubId / e-mandate id (the mandate's own id), not a transaction/order id.
- trial_end_date / next_charge_date / charge_date: "YYYY-MM-DD" or null. Anchor relative dates ("in N days", "N-day trial") to the email Date (= Date + N days); output a real date, never a relative phrase. For a "one_time" payment, ALWAYS set charge_date to the date the payment was actually made — the order/receipt date in the body, or the email's Date if the body has none — NEVER leave a one-time charge_date null.
- is_recurring_signal: the tense/intent of the email — "due" | "renews" | "autorenews" | "receipt" | "charged" | null. A receipt/charged/paid/debited (a charge that ALREADY happened) leans one_time UNLESS it's a plan/SIP/mandate; due/renews/autorenews (a FUTURE charge) leans recurring.
- card_last4 / account_last4: the last 4 digits of the card / bank account named in the body ("card ending 6593" → "6593"; "A/c XXXXXXXX4777" → "4777"), else null.
- merchant_aliases: an ARRAY of every OTHER party named in the body besides service_name — the broker, payment processor, clearing house, bank, or full legal-entity name (e.g. ["Groww","Indian Clearing Corporation Ltd"]). [] if none. This lets us merge emails that describe the SAME payment under different names.
- renewal_amount: when the body says "auto-renews on <date> for <amount>" and that renewal price differs from what was paid now, the RENEWAL amount (e.g. paid ₹499, "auto-renews … for ₹749" → 749); else null.

Important:
- DROP NOISE: if an email has NO amount AND NO charge/renewal/trial date, it is NOT actionable → use "ignore" (newsletters, "welcome to Premium / you're now Pro" with no price, free signups, generic product emails). Only use "needs_confirmation" when there is a REAL signal — an amount OR a charge/renewal/trial date. Never emit a row with ₹0 / no amount and no date.
- PERSONAL TRANSFERS ARE NOT SUBSCRIPTIONS: a NEFT / IMPS / UPI / standing-instruction transfer whose beneficiary is an INDIVIDUAL PERSON (a human name like "Jayant", "Rahul Sharma", "Mom" — i.e. NOT a company / brand / merchant / fund / SaaS / biller) is the user's OWN money movement (to self, family, a landlord, or a friend) → "ignore". Only money going to a COMPANY/MERCHANT/biller can be a subscription or mandate.
- GOVERNMENT INSURANCE / PENSION + BALANCE NOTICES ARE NOT PAYMENTS: PMSBY, PMJJBY, APY (Atal Pension), Pradhan Mantri Suraksha/Jeevan Jyoti Bima, and "maintain / keep a minimum balance of ₹X" notices → "ignore" (they're statutory micro-debits or balance reminders, not a subscription the user chose).
- CANCELLATIONS: on a "cancelled"/"mandate revoked"/"will not renew" email, STILL fill the amount and any merchant / bank / mandate-reference named in the body, so the cancellation can be matched to the right active mandate even if the merchant isn't obvious.
- TRANSACTIONAL emails from a BANK, PAYMENT PROCESSOR, or the SERVICE itself about a real charge/mandate/receipt are INCLUDED even when they name a third-party merchant (that is the mandate case). The "mentioned by a DIFFERENT SENDER" exclusion applies ONLY to editorial/marketing senders, never to a bank/processor/service transaction.
- COVER THE WHOLE INDIAN AUTO-PAY LANDSCAPE: UPI AutoPay, e-NACH/NACH, card Standing Instruction, bank e-mandates, wallet autopay (Paytm/PhonePe/GPay/Amazon Pay), broker SIP mandates (Groww/Zerodha/Kuvera/INDmoney/Coin/Paytm Money), telecom autopay (Airtel/Jio/Vi), and OTT/SaaS subscriptions. Brands not listed here still count — decide by the BEHAVIOUR, not brand recognition.
- IN SCOPE — these ARE the user's recurring commitments, classify them (NOT "ignore"): **loan / personal / home / car EMIs** (active or mandate — the user wants to be reminded), **private insurance premiums** (LIC, term, health, car, e.g. "premium due ₹X") as "active" (or "mandate" if auto-debited), **utility / broadband / electricity / gas bills**, **rent**, and **credit-card bill due** reminders. Only GOVERNMENT micro-insurance/pension (PMSBY/PMJJBY/APY) is out.
- RECALL OVER PRECISION: if an email looks like the user's OWN subscription / mandate / recurring charge / EMI / insurance / bill but you are not fully sure, classify it as "needs_confirmation" with your best-guess service_name — NEVER silently drop a plausible recurring payment. Reserve "ignore" for things that are clearly NOT the user's own recurring/paid item (ads, win-back offers, OTP/security, shipping, newsletters, a brand merely mentioned by a different sender, GOVERNMENT micro-insurance/pension, bank fees, personal transfers to an individual).
- ONE-TIME vs RECURRING (TENSE): a PAST-TENSE receipt of a payment already made ("payment receipt", "order placed", "paid", "we charged", "has been debited") with NO autopay/mandate AND NO stated next-charge/renewal date is "one_time" — even for a service that could be recurring (a postpaid Airtel "payment receipt ₹300" is one_time, not a monthly plan). A FUTURE charge ("due", "will be debited", "renews on", "auto-renews on <date> for <amount>") is recurring ("active"/"mandate"). For "auto-renews on <date> for <amount>": classify "active", set billing_cycle (usually annual), next_charge_date = that renewal date, and renewal_amount = that price (NOT the promo first-year price paid now).
- MARKETING / PRODUCT-PROMO IS NOT A SUBSCRIPTION: a feature-announcement, "what's new", product-update, "recap"/"week in review", or UPSELL email from a brand's marketing address — EVEN IF it names a plan or a price (e.g. Atlassian "Extend Jira with Teamwork Collection", Claude "Run multiple tasks with Cowork", a "$24/mo" upsell) — is NOT something the user pays for → "ignore". Only count a charge you can see was MADE (receipt / paid / debited / invoice) or a plan the user clearly HOLDS or a trial they STARTED.
- FIXED auto-debit vs USAGE CAP: a mandate/SIP/EMI/standing-instruction for a FIXED amount (a mutual-fund SIP "₹2500", a loan EMI "₹4999", a card SI "₹649 monthly") is "active" (a fixed recurring charge with that EXACT amount). Only use "mandate" when the email states a CAP — "up to ₹X" / "as presented" / "a maximum of" (e.g. Google Cloud "up to ₹75000 as presented", a UPI AutoPay "up to ₹500"). A SIP is "active" by FUND name with the exact instalment, NEVER a "mandate" capped amount.
- A FREE TRIAL with billing set up is a TRIAL, not a paid plan: "your free trial", "you won't be charged until your trial ends", "set up billing to retain access", "finish setting up by <date>" (e.g. Google Workspace Business Base trial) → "trial" (no money charged yet), NOT "active".
- "CONFIRM YOUR PAYMENT" emails are REAL charges, not noise: an email asking the user to confirm/authorise a payment to a NAMED merchant for a stated amount (e.g. "Confirm your $23.60 monthly payment to Anthropic", a 3-D-Secure / Visa-Secure / bank OTP-authorisation for a merchant charge) is the user's own payment → classify "active" (or "mandate"), NEVER "ignore". If it says "monthly"/"recurring", it is recurring.
- SIP / NACH DEBITS span up to THREE emails for ONE commitment: a broker "instalment due" (names the broker), a bank NACH "₹X debited … towards Indian Clearing Corporation Ltd / NPCI" (names the CLEARING HOUSE, with an account ending + a UMRN), and a broker "units allocated" (names the FUND). The FUND name (e.g. "HDFC Silver ETF FoF") is the service_name. NEVER output the broker (Groww/Zerodha/Kuvera) or the clearing house (Indian Clearing Corporation / NPCI / NACH) as service_name — put those in merchant_aliases; on the bank debit set account_last4 + mandate_ref (the UMRN). If only the broker or clearing house is named and you cannot find the fund, use "needs_confirmation".
- Return ONLY the JSON array of ${batch.length} objects, no explanation.

Emails:
${emailList}`

    stats.batches += 1
    try {
      const meta = {}
      const text = (await generateText(prompt, meta, { pool: 'scan' })).trim()
      stats.provider = meta.provider
      const verdicts = extractJsonArray(text)
      for (const v of verdicts) {
        const mapped = mapVerdict(v)
        if (!mapped) continue
        // Deterministic guards (drop dunning/trial-marketing noise; recharge → one-time, clearing-house →
        // ask, past-receipt → one-time, auto-renew → annual). Pair the verdict back to its source email
        // (1-based `n`) so the guards can read the body. refineWithGuards may return null (noise drop).
        const refined = refineWithGuards(mapped, batch[Number(v.n) - 1])
        if (refined) allResults.push(refined)
      }
    } catch (err) {
      // Record the failure so the caller never silently loses a batch. The scan job uses
      // rateLimited/retryAfterMs to retry this exact batch later instead of advancing past it.
      stats.failed += 1
      if (err?.rateLimited) stats.rateLimited = true
      if (err?.retryAfterMs) stats.retryAfterMs = Math.max(stats.retryAfterMs || 0, err.retryAfterMs)
      console.error('[parser] LLM batch failed (all providers):', err?.message || err)
    }

    if (i + BATCH_SIZE < candidates.length) await new Promise((r) => setTimeout(r, 1000))
  }

  // Drop bare broker/platform entries (e.g. a generic "Groww" SIP) that duplicate the real fund rows.
  const PLATFORM_ONLY = new Set(['groww', 'zerodha', 'kuvera', 'upstox', 'coin', 'paytmmoney', 'indmoney'])
  // Government insurance/pension micro-debits + balance notices — never a chosen subscription.
  const GOVT_SCHEME = /pmsby|pmjjby|\bapy\b|atal\s*pension|jeevan\s*jyoti|suraksha\s*bima/i
  const cleaned = allResults.filter((s) => {
    const name = s?.service_name || ''
    const key = name.toLowerCase().replace(/\b(sip|app)\b/g, '').replace(/[^a-z0-9]+/g, '')
    if (!key || PLATFORM_ONLY.has(key)) return false
    if (GOVT_SCHEME.test(name)) return false
    // A one-time "payment" with no money (₹0 / null) is a notification, not a payment → drop it.
    if (s.kind === 'one_time' && (s.amount == null || Number(s.amount) === 0)) return false
    return true
  })

  // Stage-2 entity resolution: collapse the rows into commitments — merges the SIP trio (units-allocated +
  // bank NACH debit) and the Anthropic receipt+confirm pair, keeps card-shared merchants separate, and
  // attaches clearing-house orphans to the right fund. The cluster-pool LLM is used only for ambiguous
  // orphan tie-breaks; a failure there degrades to leaving the orphan unmerged (never throws the scan).
  return clusterCommitments(cleaned, { llm: (p) => generateText(p, {}, { pool: 'cluster' }) })
}
