import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { listSubscriptionMessageIds } from '@/lib/gmail'
import { getValidGmailToken } from '@/lib/google-auth'
import { track } from '@/lib/analytics'
import { enforce, enforceIdentity } from '@/lib/ratelimit'
import { scanWindowDays } from '@/lib/subscriptions'

export const maxDuration = 60

// POST /api/scan — START a scan job. Lists all matching message IDs in the window and creates a
// scan_jobs row; the actual parsing happens batch-by-batch in /api/scan/process (driven by the
// worker), so a large inbox is captured completely without timing out. Returns { jobId, total }.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Abuse guard. Per-IP AND per-email caps: the per-email bucket is keyed by the email string (not the
  // DB row), so it survives an account being deleted + re-created — throttling a test user who tries to
  // delete/recreate to trigger repeated fresh scans. (Best-effort per-instance; enough for the beta.)
  const limitedIp = enforce(req, 'scan', { limit: 10, windowMs: 60 * 60_000 })
  if (limitedIp) return limitedIp
  const limitedUser = enforceIdentity(session.user.email, 'scan-user', { limit: 6, windowMs: 60 * 60_000 })
  if (limitedUser) return limitedUser

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', session.user.email)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // If a scan is already in progress, just return it (idempotent — don't start a second).
  const { data: active } = await supabaseAdmin
    .from('scan_jobs')
    .select('id, total, cursor, found, status')
    .eq('user_id', profile.id)
    .in('status', ['pending', 'running'])
    .order('created_at', { ascending: false })
    .maybeSingle()
  if (active) return Response.json({ jobId: active.id, total: active.total, already: true })

  const accessToken = await getValidGmailToken(profile)
  if (!accessToken)
    return Response.json({ error: 'Gmail not connected. Please sign in again.' }, { status: 400 })

  // A first-ever scan (no last_scanned_at) looks back 90 days; a returning user only scans the window SINCE
  // their last scan (incremental, clamped 7–90d) — so re-logging-in or re-clicking "Scan" doesn't redo the
  // full 3-month scan. Mirrors the weekly cron (scanWindowDays). scan/process stamps last_scanned_at on done.
  const windowDays = scanWindowDays(profile.last_scanned_at)
  const messageIds = await listSubscriptionMessageIds(accessToken, { days: windowDays })

  const { data: job, error } = await supabaseAdmin
    .from('scan_jobs')
    .insert({
      user_id: profile.id,
      status: 'pending',
      message_ids: messageIds,
      total: messageIds.length,
      window_days: windowDays,
    })
    .select('id, total')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await track('gmail_scan_started', { user_email: session.user.email, total: messageIds.length })
  return Response.json({ jobId: job.id, total: job.total })
}
