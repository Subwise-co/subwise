// Verify the WhatsApp Cloud API wiring AND satisfy Meta's "Testing your use cases" requirement.
// Reads creds from .env.local. Read-only by default; pass --to to also do a messaging test call.
//
//   node scripts/check-whatsapp.mjs                       # read-only checks (ticks management perms)
//   node scripts/check-whatsapp.mjs --create-templates    # submit all Subwise templates via Graph API
//   node scripts/check-whatsapp.mjs --to 919876543210     # also sends a text (ticks messaging perm)
//   node scripts/check-whatsapp.mjs --to 919876543210 --template hello_world
//
// What each call proves to Meta:
//   GET /<WABA_ID>/phone_numbers        → whatsapp_business_management
//   GET /<WABA_ID>/message_templates    → whatsapp_business_management
//   POST /<PHONE_NUMBER_ID>/messages    → whatsapp_business_messaging  (only with --to)
import { loadEnvLocal } from '../tests/setup/loadEnv.js'

loadEnvLocal()

const V = process.env.WHATSAPP_API_VERSION || 'v19.0'
const TOKEN = process.env.WHATSAPP_ACCESS_TOKEN
const WABA = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID

const args = process.argv.slice(2)
const getArg = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}
const to = getArg('--to')
const template = getArg('--template')
const text = getArg('--text') || 'Subwise test ✅ — Cloud API wiring works.'

function need(name, val) {
  if (!val) {
    console.error(`❌ Missing ${name} in .env.local`)
    return false
  }
  return true
}

const ok = [need('WHATSAPP_ACCESS_TOKEN', TOKEN), need('WHATSAPP_BUSINESS_ACCOUNT_ID', WABA), need('WHATSAPP_PHONE_NUMBER_ID', PHONE_ID)]
if (ok.includes(false)) process.exit(1)

async function graph(method, path, body) {
  const url = `https://graph.facebook.com/${V}/${path}`
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

const LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

// The Subwise templates, defined once. `ex` = ordered sample values for the {{n}} variables (required
// by Meta for any template that has variables). Bodies MUST match lib/whatsapp.js exactly.
const TEMPLATES = [
  { name: 'subwise_optin', category: 'UTILITY', text: "Hi! You've signed up for Subwise. Reply YES to get WhatsApp reminders before your payments are due, PAUSE to snooze, or STOP to opt out.", ex: [] },
  { name: 'renewal_reminder', category: 'UTILITY', text: 'Reminder: your {{1}} renews on {{2}} for {{3}}. Reply CANCEL {{1}} for cancellation steps, PAUSE to snooze, or STOP to opt out.', ex: ['Netflix', '5 Jul 2026', '₹649'] },
  { name: 'trial_ending', category: 'UTILITY', text: "Your {{1}} free trial ends on {{2}} — you'll be charged {{3}} unless you cancel. Reply CANCEL {{1}} for steps, or STOP to opt out.", ex: ['Claude Pro', '29 Jun 2026', '₹1990'] },
  { name: 'budget_exceeded', category: 'UTILITY', text: 'Heads up — your recurring commitments are now {{1}}, over your {{2}} monthly budget. Open Subwise to review what to trim. Reply STOP to opt out.', ex: ['₹50,120', '₹45,000'] },
  { name: 'monthly_digest', category: 'UTILITY', text: 'Your month ahead on Subwise: {{1}} upcoming payments totaling {{2}}. Biggest: {{3}}. Open Subwise to see all. Reply STOP to opt out.', ex: ['11', '₹50,120', 'Rent'] },
  { name: 'subwise_reconnect', category: 'UTILITY', text: 'Your Gmail connection expired, so your weekly Subwise scan was skipped. Open Subwise to reconnect.', ex: [] },
]

function templateBody(t) {
  const body = { type: 'BODY', text: t.text }
  if (t.ex.length) body.example = { body_text: [t.ex] }
  return { name: t.name, language: LANG, category: t.category, components: [body] }
}

// --create-templates: submit all templates via the Graph API (the Cloud-API side that Coexistence
// allows, even when the WhatsApp Manager UI blocks template management on a Business-app WABA).
if (args.includes('--create-templates')) {
  console.log(`Submitting ${TEMPLATES.length} templates to WABA ${WABA} (lang=${LANG})…\n`)
  let created = 0
  for (const t of TEMPLATES) {
    const r = await graph('POST', `${WABA}/message_templates`, templateBody(t))
    if (r.ok) {
      console.log(`✅ ${t.name} — submitted (id: ${r.data.id}, status: ${r.data.status || 'PENDING'})`)
      created += 1
    } else {
      const e = r.data.error || r.data
      console.error(`❌ ${t.name} — ${r.status}: ${e.error_user_msg || e.message || JSON.stringify(e)}`)
      // If it already exists, Meta returns an error — that's fine.
    }
  }
  console.log(`\n${created}/${TEMPLATES.length} submitted. Check status in WhatsApp Manager → Message templates (approval ~24–48h).`)
  console.log('If these fail with a permission/Coexistence error, the WABA cannot manage templates → use a full Cloud-API WABA, or bridge on web.js for launch.')
  process.exit(created > 0 ? 0 : 1)
}

// 1) management permission — list phone numbers under the WABA
{
  const r = await graph('GET', `${WABA}/phone_numbers`)
  if (r.ok) {
    const nums = (r.data.data || []).map((n) => `${n.display_phone_number} (id: ${n.id})`).join(', ')
    console.log(`✅ whatsapp_business_management — WABA reachable. Numbers: ${nums || '(none)'}`)
  } else {
    console.error(`❌ phone_numbers failed (${r.status}): ${JSON.stringify(r.data.error || r.data)}`)
  }
}

// 2) management permission — list message templates (also shows what's approved)
{
  const r = await graph('GET', `${WABA}/message_templates?fields=name,status,category&limit=50`)
  if (r.ok) {
    const t = (r.data.data || []).map((x) => `${x.name}[${x.status}]`).join(', ')
    console.log(`✅ message_templates readable. Templates: ${t || '(none yet — create renewal_reminder / trial_ending / monthly_digest)'}`)
  } else {
    console.error(`⚠️ message_templates failed (${r.status}): ${JSON.stringify(r.data.error || r.data)}`)
  }
}

// 3) messaging permission — only if --to is given (sends a REAL message; uses a paid/free conversation)
if (to) {
  const body = template
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: template, language: { code: 'en_US' } } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }
  const r = await graph('POST', `${PHONE_ID}/messages`, body)
  if (r.ok) {
    console.log(`✅ whatsapp_business_messaging — sent to ${to}. message id: ${r.data.messages?.[0]?.id}`)
  } else {
    console.error(`❌ send failed (${r.status}): ${JSON.stringify(r.data.error || r.data)}`)
    console.error('   (A plain text only delivers within a 24h window or to test numbers; otherwise use --template with an APPROVED template.)')
  }
} else {
  console.log('ℹ️  Skipped the messaging test call. Re-run with  --to <number>  to tick whatsapp_business_messaging.')
}

console.log('\nDone. The successful calls above will tick the matching rows in Meta → app → Testing your use cases.')
