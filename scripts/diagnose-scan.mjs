// One-off diagnostic for the scan pipeline. Run: node scripts/diagnose-scan.mjs <email>
// Checks: stored Gmail token + expiry, Gmail query match count + subjects, and a live Gemini call.
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { loadEnvLocal } from '../tests/setup/loadEnv.js'

loadEnvLocal()

const email = process.argv[2] || 'jayantbathla9@gmail.com'
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

console.log(`\n=== 1. Profile / token for ${email} ===`)
const { data: profile, error: pErr } = await db
  .from('profiles')
  .select('*')
  .eq('email', email)
  .single()
if (pErr || !profile) {
  console.error('❌ No profile row:', pErr?.message)
  process.exit(1)
}
console.log('has access_token:', Boolean(profile.gmail_access_token))
console.log('has refresh_token:', Boolean(profile.gmail_refresh_token))
console.log('token expiry:', profile.gmail_token_expiry)
console.log('expired?:', profile.gmail_token_expiry ? new Date(profile.gmail_token_expiry) < new Date() : 'unknown')
console.log('last_scanned_at:', profile.last_scanned_at)

console.log(`\n=== 2. Gmail query ===`)
let emails = []
try {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: profile.gmail_access_token })
  const gmail = google.gmail({ version: 'v1', auth })
  const q =
    'subject:(subscription OR renewal OR receipt OR invoice OR payment OR autopay OR mandate OR trial OR billing) newer_than:180d'
  const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 })
  const msgs = list.data.messages || []
  console.log('messages matched:', msgs.length)
  for (const m of msgs.slice(0, 15)) {
    const d = await gmail.users.messages.get({
      userId: 'me',
      id: m.id,
      format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    })
    const h = d.data.payload.headers
    const get = (n) => h.find((x) => x.name === n)?.value || ''
    const e = { subject: get('Subject'), sender: get('From'), date: get('Date') }
    emails.push(e)
    console.log(`  • ${e.subject}  —  ${e.sender}`)
  }
} catch (err) {
  console.error('❌ Gmail call failed:', err.message)
}

console.log(`\n=== 3. Gemini call ===`)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const sample = emails.length
  ? emails
  : [{ subject: 'Your Pro trial ends in 3 days', sender: 'Anthropic <support@anthropic.com>', date: 'Wed, 17 Jun 2026' }]
const emailList = sample
  .map((e, i) => `${i + 1}. Subject: ${e.subject} | From: ${e.sender} | Date: ${e.date}`)
  .join('\n')
const prompt = `Return ONLY a JSON array of subscriptions/trials from these emails. Each: {service_name, amount, currency, billing_cycle, is_trial, trial_end_date, next_charge_date}. Return [] if none.\n\nEmails:\n${emailList}`

const candidates = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest', 'gemini-2.5-flash']
for (const modelName of candidates) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName })
    const res = await model.generateContent(prompt)
    console.log(`✅ ${modelName} OK →`, res.response.text().trim().slice(0, 300))
  } catch (err) {
    console.error(`❌ ${modelName} FAILED →`, err.message?.split('\n')[0])
  }
}
process.exit(0)
