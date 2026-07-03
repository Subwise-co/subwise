// Test the weekly auto-scan cron locally (no waiting a week, no Vercel).
//
// Usage:
//   node scripts/test-auto-scan.mjs <daysAgo> [email]
//
//   <daysAgo>  backdate last_scanned_at to N days ago so the user becomes "due" (use 8 to simulate a
//              weekly run; use 0 to make them NOT due and confirm the filter skips them; "null" = never
//              scanned = first-time 90-day scan). If omitted, profiles are left as-is.
//   [email]    only affect this profile (default: all profiles).
//
// Requires the dev server running (npm run dev). Reads CRON_SECRET + Supabase creds from .env.local.
import { createClient } from '@supabase/supabase-js'
import { loadEnvLocal } from '../tests/setup/loadEnv.js'

loadEnvLocal()
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000'
const daysAgoArg = process.argv[2]
const emailArg = process.argv[3]

// 1) Optionally backdate last_scanned_at so the user is (or isn't) "due".
if (daysAgoArg !== undefined) {
  const value =
    daysAgoArg === 'null'
      ? null
      : new Date(Date.now() - Number(daysAgoArg) * 24 * 60 * 60 * 1000).toISOString()
  let q = db.from('profiles').update({ last_scanned_at: value })
  q = emailArg ? q.eq('email', emailArg) : q.neq('email', '')
  await q
  console.log(`set last_scanned_at = ${value ?? 'NULL'} for ${emailArg || 'ALL profiles'}`)
}

// Show who currently qualifies as "due" (mirrors the cron's filter).
const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const { data: profiles } = await db
  .from('profiles')
  .select('email,last_scanned_at,weekly_scan_paused,gmail_refresh_token')
console.log('\nprofiles:')
for (const p of profiles || []) {
  const due =
    Boolean(p.gmail_refresh_token) &&
    p.weekly_scan_paused === false &&
    (!p.last_scanned_at || p.last_scanned_at <= cutoff)
  console.log(
    `  ${p.email.padEnd(26)} last_scanned=${p.last_scanned_at ?? 'never'} paused=${p.weekly_scan_paused} refreshToken=${Boolean(p.gmail_refresh_token)} → ${due ? 'DUE' : 'not due'}`
  )
}

// 2) Call the cron exactly like Vercel would.
console.log(`\ncalling GET ${APP_URL}/api/cron/auto-scan ...`)
const res = await fetch(`${APP_URL}/api/cron/auto-scan`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
})
console.log('HTTP', res.status, '→', await res.text())

// 3) Show the resulting subscription counts per profile.
const { data: after } = await db.from('profiles').select('id,email,last_scanned_at')
for (const p of after || []) {
  const { count } = await db
    .from('subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', p.id)
  console.log(`  ${p.email.padEnd(26)} subscriptions=${count ?? 0}  last_scanned=${p.last_scanned_at}`)
}
