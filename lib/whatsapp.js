// WhatsApp transport — provider-agnostic. The message BUILDERS below never change; only the
// transport switches via WHATSAPP_PROVIDER so we can migrate webjs → meta later untouched.
//
//   WHATSAPP_PROVIDER=webjs    → POST to the whatsapp-web.js worker (whatsapp-worker/), the MVP default
//   WHATSAPP_PROVIDER=meta     → Meta Cloud API (graph.facebook.com), for the eventual migration
//   WHATSAPP_PROVIDER=console  → log only (safe local dev / no creds) — the fallback default
// Env is read at call time so it works without a restart and is easy to test.

// Format an Indian mobile number to E.164 digits without "+": 91 + last 10 digits.
export const formatPhone = (phone) => `91${String(phone).replace(/\D/g, '').slice(-10)}`

function provider() {
  return (process.env.WHATSAPP_PROVIDER || 'console').toLowerCase()
}

// --- meta (Cloud API) transport ---
async function metaSend(to, body) {
  const version = process.env.WHATSAPP_API_VERSION || 'v19.0'
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    }),
  })
  if (!res.ok) throw new Error(`WhatsApp (meta) send failed: ${JSON.stringify(await res.json().catch(() => ({})))}`)
  return res.json()
}

// --- webjs (whatsapp-web.js worker) transport: enqueue a message on the always-on worker ---
async function webjsSend(to, body) {
  const url = process.env.WHATSAPP_WORKER_URL
  if (!url) throw new Error('WHATSAPP_WORKER_URL not set (whatsapp-web.js worker)')
  const res = await fetch(`${url.replace(/\/$/, '')}/enqueue`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_WORKER_SECRET || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to, body }),
  })
  if (!res.ok) throw new Error(`WhatsApp (webjs) enqueue failed: ${res.status} ${await res.text().catch(() => '')}`)
  return res.json().catch(() => ({ queued: true }))
}

// Low-level send to an already-formatted recipient (no reformatting).
export async function sendRaw(to, body) {
  const p = provider()
  if (p === 'meta') return metaSend(to, body)
  if (p === 'webjs') return webjsSend(to, body)
  console.log(`[whatsapp:console] → ${to}: ${String(body).replace(/\n/g, ' ').slice(0, 100)}`)
  return { ok: true, mock: true }
}

// App-initiated send — formats an Indian number before sending.
export async function sendText(to, body) {
  return sendRaw(formatPhone(to), body)
}

// Meta-only: approved templates (used only when WHATSAPP_PROVIDER=meta in production).
// Language must match the approved template's language (default English "en").
export async function sendTemplate(to, templateName, components = []) {
  const version = process.env.WHATSAPP_API_VERSION || 'v19.0'
  const lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en'
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: formatPhone(to),
      type: 'template',
      template: { name: templateName, language: { code: lang }, components },
    }),
  })
  if (!res.ok) throw new Error(`WhatsApp template send failed: ${JSON.stringify(await res.json().catch(() => ({})))}`)
  return res.json()
}

// Build a Cloud-API "body" component from ordered text params. WhatsApp forbids newlines/tabs/4+ spaces
// inside a template variable, so each param is collapsed to a single clean line.
function bodyComponents(params = []) {
  if (!params.length) return []
  return [
    {
      type: 'body',
      parameters: params.map((p) => ({ type: 'text', text: String(p ?? '').replace(/\s+/g, ' ').trim() || '—' })),
    },
  ]
}
const amountText = (sub) => (sub?.amount ? `₹${sub.amount}` : 'the set amount')

// ── PROACTIVE (business-initiated) message TEMPLATES the founder must create + get approved in
// WhatsApp Manager (category = Utility, language = English/en). Variable ORDER must match exactly:
//
//   subwise_optin   (0 vars)
//     "👋 Hi! You've signed up for Subwise. Reply YES to get WhatsApp reminders before your
//      payments are due, PAUSE to snooze, or STOP to opt out."
//   renewal_reminder ({{1}} service, {{2}} date, {{3}} amount)
//     "🔔 Reminder: your {{1}} renews on {{2}} for {{3}}. Reply CANCEL {{1}} for cancellation steps,
//      PAUSE to snooze, or STOP to opt out."
//   trial_ending     ({{1}} service, {{2}} date, {{3}} amount)
//     "⏳ Your {{1}} free trial ends on {{2}} — you'll be charged {{3}} unless you cancel.
//      Reply CANCEL {{1}} for steps, or STOP to opt out."
//   monthly_digest   ({{1}} count, {{2}} total, {{3}} biggest)
//     "📊 Your month ahead on Subwise: {{1}} upcoming payments totaling {{2}}. Biggest: {{3}}.
//      Open Subwise to see all. Reply STOP to opt out."
//   subwise_reconnect (0 vars)
//     "⚠️ Your Gmail connection expired, so your weekly Subwise scan was skipped. Open Subwise to reconnect."
//
// Day-1 critical: subwise_optin, renewal_reminder, trial_ending. (digest is monthly; reconnect is rare.)
const onMeta = () => provider() === 'meta'

export async function sendWhatsAppOptIn(phone) {
  // First contact → on Cloud API this MUST be a template (no open session yet).
  if (onMeta()) return sendTemplate(phone, 'subwise_optin', bodyComponents([]))
  return sendText(
    phone,
    `👋 Hi! You've signed up for Subwise.\n\nReply *YES* to start getting WhatsApp alerts before your subscriptions renew.\nReply NO to skip.\n\nYou can reply STOP anytime to unsubscribe immediately.`
  )
}

export async function sendTrialWatchdogAlert(phone, sub) {
  if (onMeta())
    return sendTemplate(
      phone,
      'trial_ending',
      bodyComponents([sub.service_name, sub.trial_end_date || sub.next_charge_date || 'soon', amountText(sub)])
    )
  return sendText(
    phone,
    `⚠️ *Trial Watchdog Alert*\n\n*${sub.service_name}* free trial ends on ${sub.trial_end_date}.\nAmount: ₹${sub.amount || 'unknown'}\n\nReply *CANCEL ${sub.service_name}* for step-by-step cancellation including UPI mandate revocation.`
  )
}

export async function sendRenewalWhatsApp(phone, sub) {
  if (onMeta())
    return sendTemplate(
      phone,
      'renewal_reminder',
      bodyComponents([sub.service_name, sub.next_charge_date || 'soon', amountText(sub)])
    )
  const isManual = sub.source === 'manual'
  const label = isManual ? ' (Manual)' : ''
  // Cancellation steps only make sense for DETECTED (Gmail) subscriptions — we can't give steps to
  // "cancel" a manually-added reminder like rent, so we omit that line for manual items.
  const cancelLine = isManual ? '' : `Reply *CANCEL ${sub.service_name}* for cancellation steps\n`
  return sendText(
    phone,
    `🔔 *Renewal Reminder*\n\n*${sub.service_name}*${label} renews on ${sub.next_charge_date}\nAmount: ₹${sub.amount || 'unknown'}\n\n${cancelLine}Reply PAUSE to stop weekly scans · STOP to unsubscribe`
  )
}

export async function sendBatchedRenewalWhatsApp(phone, subs) {
  // Cloud API templates can't carry a multi-line list, so on meta we send one template per renewal
  // (same-day batches are rare). Off meta, one combined free-form message.
  if (onMeta()) {
    for (const s of subs) await sendRenewalWhatsApp(phone, s)
    return { ok: true, count: subs.length }
  }
  const lines = subs
    .map(
      (s) =>
        `• *${s.service_name}*${s.source === 'manual' ? ' (Manual)' : ''} — ₹${s.amount || '?'} on ${s.next_charge_date}`
    )
    .join('\n')
  // Only offer cancellation steps if the batch contains a DETECTED (non-manual) subscription;
  // manual items like rent have no cancellation flow.
  const hasCancellable = subs.some((s) => s.source !== 'manual')
  const cancelLine = hasCancellable ? 'Reply *CANCEL [service name]* for cancellation steps\n' : ''
  return sendText(
    phone,
    `🔔 *${subs.length} renewals coming up:*\n\n${lines}\n\n${cancelLine}Reply PAUSE to stop weekly scans · STOP to unsubscribe`
  )
}

export async function sendMonthlyDigest(phone, subs) {
  const total = subs.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  if (onMeta()) {
    const biggest = [...subs].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0]
    return sendTemplate(
      phone,
      'monthly_digest',
      bodyComponents([String(subs.length), `₹${total.toFixed(0)}`, biggest ? biggest.service_name : '—'])
    )
  }
  const top8 = subs.slice(0, 8)
  const lines = top8
    .map((s) => `• ${s.service_name} — ₹${s.amount || '?'}/${s.billing_cycle || 'month'}`)
    .join('\n')
  // Phase 2 monetisation: set MONTHLY_DIGEST_SPONSOR_LINE to "Powered by [Brand]." once you have a sponsor.
  const sponsorLine = process.env.MONTHLY_DIGEST_SPONSOR_LINE || ''
  return sendText(
    phone,
    `📊 *Monthly Subscription Digest*\n\n${lines}\n\n*Estimated monthly total: ₹${total.toFixed(0)}*\n\nReply PAUSE to stop weekly scans · STOP to unsubscribe.${sponsorLine ? '\n\n' + sponsorLine : ''}`
  )
}

// Over-budget nudge (once per month). On meta needs an approved template `budget_exceeded`
// ({{1}} commitment, {{2}} budget); free-form otherwise.
export async function sendBudgetAlert(phone, { commitment, budget }) {
  const c = `₹${Math.round(commitment).toLocaleString('en-IN')}`
  const b = `₹${Math.round(budget).toLocaleString('en-IN')}`
  if (onMeta()) return sendTemplate(phone, 'budget_exceeded', bodyComponents([c, b]))
  return sendText(
    phone,
    `📈 Heads up — your recurring commitments are now *${c}*, over your *${b}* monthly budget.\n\nOpen Subwise to review what to trim. Reply STOP to opt out.`
  )
}

export async function sendReconnectRequest(phone) {
  if (onMeta()) return sendTemplate(phone, 'subwise_reconnect', bodyComponents([]))
  return sendText(
    phone,
    `⚠️ Your Gmail connection has expired. Your weekly subscription scan was skipped.\n\nVisit your Subwise dashboard to reconnect Gmail and resume automatic scanning.`
  )
}

// Early-beta "please re-scan" nudge. During Google's Testing phase we can't auto-scan Gmail
// (tokens expire in 7 days), so instead of a silent skip we send this: rescan if you've added
// anything new, otherwise existing reminders keep coming. (Free-form; webjs only for now.)
export async function sendBetaRescanNudge(phone) {
  return sendText(
    phone,
    `👋 *Subwise* — a quick beta note.\n\nWe're in early access, so we can't auto-scan your Gmail just yet.\n\n• Started a *new* subscription or free trial? Open https://subwise.co.in and tap *Scan* to add it.\n• Nothing new? You're all set — you'll keep getting reminders for everything we found in your first scan.\n\nReply PAUSE to stop these · STOP to opt out.`
  )
}
