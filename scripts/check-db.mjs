// Verifies the Supabase schema is live and matches what the app expects.
// Run: node scripts/check-db.mjs
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from '../tests/setup/loadEnv.js'

loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })
const tables = ['profiles', 'subscriptions', 'alerts', 'feedback', 'scan_jobs']

let ok = true
for (const t of tables) {
  const { error, count } = await db.from(t).select('*', { count: 'exact', head: true })
  if (error) {
    ok = false
    console.error(`❌ ${t.padEnd(14)} ERROR: ${error.message}`)
  } else {
    console.log(`✅ ${t.padEnd(14)} exists (rows: ${count ?? 0})`)
  }
}

// Spot-check a couple of columns the routes rely on.
const colChecks = [
  ['profiles', 'whatsapp_opted_in'],
  ['subscriptions', 'trial_alerted'],
  ['subscriptions', 'reminder_days'],
  ['alerts', 'alert_days_before'],
  // 0002_kinds_and_payment_methods
  ['subscriptions', 'kind'],
  ['subscriptions', 'payment_method'],
  ['subscriptions', 'charge_date'],
  // 0003_confirmation_status
  ['subscriptions', 'status'],
  // 0004_weekly_scan_pause
  ['profiles', 'weekly_scan_paused'],
]
for (const [table, col] of colChecks) {
  const { error } = await db.from(table).select(col).limit(1)
  if (error) {
    ok = false
    console.error(`❌ ${table}.${col} missing: ${error.message}`)
  } else {
    console.log(`✅ ${table}.${col} present`)
  }
}

console.log(ok ? '\nSchema OK ✅' : '\nSchema has problems ❌')
process.exit(ok ? 0 : 1)
