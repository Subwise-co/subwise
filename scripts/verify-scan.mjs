// End-to-end verification of the scan pipeline with the configured model.
// Run: node scripts/verify-scan.mjs <email>
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { loadEnvLocal } from '../tests/setup/loadEnv.js'

loadEnvLocal()
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const email = process.argv[2] || 'jayantbathla9@gmail.com'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const { data: profile } = await db.from('profiles').select('*').eq('email', email).single()

const auth = new google.auth.OAuth2()
auth.setCredentials({ access_token: profile.gmail_access_token })
const gmail = google.gmail({ version: 'v1', auth })
const q =
  'subject:(subscription OR renewal OR receipt OR invoice OR payment OR autopay OR mandate OR trial OR billing) newer_than:180d'
const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 100 })
const emails = []
for (const m of list.data.messages || []) {
  const d = await gmail.users.messages.get({
    userId: 'me',
    id: m.id,
    format: 'metadata',
    metadataHeaders: ['Subject', 'From', 'Date'],
  })
  const h = d.data.payload.headers
  const get = (n) => h.find((x) => x.name === n)?.value || ''
  emails.push({ subject: get('Subject'), sender: get('From'), date: get('Date'), snippet: (d.data.snippet || '').slice(0, 200) })
}

const emailList = emails
  .map((e, i) => `${i + 1}. Subject: ${e.subject} | From: ${e.sender} | Date: ${e.date} | Preview: ${e.snippet}`)
  .join('\n')
const prompt = `Identify subscription/recurring-payment emails for Indian users. Each email has Subject, From, Date (received), Preview (body snippet).
Return ONLY a JSON array. Each: service_name, amount (read from Preview, number|null), currency, billing_cycle ("monthly"|"annual"|"weekly"|null), is_trial (bool), trial_end_date ("YYYY-MM-DD"|null), next_charge_date ("YYYY-MM-DD"|null).
Dates: anchor relative phrases to Date ("in N days"/"N days free" => Date + N days). Cycle: year/annual/12 months => "annual"; month => "monthly". If unsure, null.
Include ONLY genuine paid subscriptions or active/ending trials. EXCLUDE one-time purchases, order confirmations, marketing/feature emails, and already-ended trials. Deduplicate. Return [] if none. ONLY the JSON array.

Emails:
${emailList}`

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: MODEL })
const res = await model.generateContent(prompt)
const text = res.response.text().trim()
const match = text.match(/\[[\s\S]*\]/)
const parsed = match ? JSON.parse(match[0]) : []

console.log(`\nModel: ${MODEL}`)
console.log(`Emails fetched: ${emails.length}`)
console.log(`Subscriptions/trials parsed: ${parsed.length}\n`)
for (const s of parsed) {
  console.log(`  • ${s.service_name}  trial=${s.is_trial}  ends=${s.trial_end_date || '-'}  next=${s.next_charge_date || '-'}  ₹${s.amount ?? '?'}`)
}
process.exit(0)
