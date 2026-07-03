// Wipe all user data so onboarding can be re-run from scratch (Gmail scan + email/password).
// Deletes subscriptions, alerts, scan_jobs, spend_snapshots, feedback, and profiles. DESTRUCTIVE.
// Usage: node scripts/reset-db.mjs            (asks for confirmation via the CONFIRM env)
//        CONFIRM=yes node scripts/reset-db.mjs
import { loadEnvLocal } from '../tests/setup/loadEnv.js'
import { createClient } from '@supabase/supabase-js'

loadEnvLocal()
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

if (process.env.CONFIRM !== 'yes') {
  console.log('This will DELETE all profiles + subscriptions + alerts + scan_jobs + snapshots + feedback.')
  console.log('Re-run with:  CONFIRM=yes node scripts/reset-db.mjs')
  process.exit(0)
}

// Child tables first (FKs cascade on user_id anyway, but be explicit + order-safe).
const tables = ['alerts', 'spend_snapshots', 'scan_jobs', 'subscriptions', 'feedback', 'profiles']
for (const t of tables) {
  const { error, count } = await sb.from(t).delete({ count: 'exact' }).not('id', 'is', null)
  if (error && !/does not exist|relation/i.test(error.message)) {
    console.error(`✗ ${t}:`, error.message)
  } else {
    console.log(`✓ cleared ${t}${typeof count === 'number' ? ` (${count})` : ''}`)
  }
}
console.log('Done. Onboarding can be re-run fresh.')
