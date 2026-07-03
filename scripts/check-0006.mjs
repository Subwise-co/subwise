// Checks whether migration 0006_dashboard.sql has been applied:
//   1) spend_snapshots table exists
//   2) profiles.reminder_days_default column exists
// Run: node scripts/check-0006.mjs
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
let applied = true

// 1) spend_snapshots table
{
  const { error, count } = await db.from('spend_snapshots').select('*', { count: 'exact', head: true })
  if (error) {
    applied = false
    console.error(`❌ spend_snapshots table   MISSING (${error.message})`)
  } else {
    console.log(`✅ spend_snapshots table   exists (rows: ${count ?? 0})`)
  }
}

// 2) profiles.reminder_days_default column
{
  const { error } = await db.from('profiles').select('reminder_days_default').limit(1)
  if (error) {
    applied = false
    console.error(`❌ profiles.reminder_days_default  MISSING (${error.message})`)
  } else {
    console.log(`✅ profiles.reminder_days_default  exists`)
  }
}

console.log('')
console.log(applied ? '🎉 Migration 0006 IS applied.' : '⚠️  Migration 0006 NOT (fully) applied — run supabase/migrations/0006_dashboard.sql in the Supabase SQL editor.')
process.exit(applied ? 0 : 1)
