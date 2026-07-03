// Second pass ("scan-QA"): after per-email extraction + deterministic reconcile, resolve the
// "needs confirmation" pile with ONE structured LLM call so the user isn't asked to confirm a long list.
//
// SAFETY: this ONLY looks at pending rows. It never touches confirmed/active/cancelled items, so the worst
// case is that a pending item stays pending. Fail-safe: any error → no changes (deterministic result stands).
import { generateText } from '@/lib/llm'
import { extractJsonArray } from '@/lib/subscriptions'

// pendingRows: [{ id, service_name, kind, amount, currency, billing_cycle, next_charge_date }]
// Returns { [id]: 'confirm' | 'drop' | 'ask' } — only ids the model decided on.
export async function consolidatePending(pendingRows = []) {
  if (!pendingRows.length) return {}
  const list = pendingRows
    .map(
      (r, i) =>
        `${i + 1}. id=${r.id} | name=${r.service_name} | kind=${r.kind || 'subscription'} | amount=${
          r.amount ?? 'none'
        } ${r.currency || ''} | cycle=${r.billing_cycle || 'none'} | next=${r.next_charge_date || 'none'}`
    )
    .join('\n')

  const prompt = `You are cleaning up a user's detected recurring payments for a finance app. For EACH item decide exactly one:
- "confirm" — clearly a REAL recurring subscription / auto-pay / SIP the user holds with a COMPANY/MERCHANT (a real charged amount + a plausible paid service, e.g. "Udemy ₹4500 annual", a mutual-fund SIP).
- "drop" — NOT a real subscription the user chose. Includes: a newsletter/blog, a free signup, a ₹0/no-amount item, marketing, a one-off; a **personal transfer to an INDIVIDUAL PERSON** (a human name like "Jayant"/"Rahul" — money sent to self/family/landlord/friend, NOT a company); and **government insurance/pension or balance notices** (PMSBY, PMJJBY, APY/Atal Pension, "maintain minimum balance").
- "ask" — genuinely ambiguous; keep asking the user. This INCLUDES a row named only by a BANK / payment processor with no merchant (e.g. "HDFC Bank", "IDFC FIRST Bank", "ICICI", "Axis Bank", "Paytm", "Razorpay") — a real mandate names the MERCHANT, not the bank, so NEVER "confirm" a bare bank name as if it were the subscription; use "ask" so the user names it.
Be decisive: prefer "confirm" or "drop" over "ask" (except bank-only names, which are always "ask"). A name that is a person's name (not a brand) or a govt scheme → ALWAYS "drop". Return ONLY a JSON array, one object per item:
[{"id":"<id>","decision":"confirm|drop|ask"}]
Items:
${list}`

  try {
    const meta = {}
    const text = (await generateText(prompt, meta, { pool: 'analytics' })).trim()
    const out = extractJsonArray(text)
    const map = {}
    for (const o of out) {
      if (o?.id && ['confirm', 'drop', 'ask'].includes(o.decision)) map[String(o.id)] = o.decision
    }
    return map
  } catch (e) {
    console.error('[scan] consolidate failed (non-fatal):', e?.message || e)
    return {}
  }
}
