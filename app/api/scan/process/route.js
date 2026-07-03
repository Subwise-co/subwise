import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { fetchEmailsByIds } from '@/lib/gmail'
import { parseSubscriptions } from '@/lib/parser'
import { getValidGmailToken } from '@/lib/google-auth'
import { upsertParsedSubscription } from '@/lib/scan-write'
import { reconcile } from '@/lib/scan-reconcile'
import { consolidatePending } from '@/lib/scan-consolidate'
import { sendTrialWatchdogAlert } from '@/lib/whatsapp'
import { writeMonthlySnapshot } from '@/lib/snapshots'
import { shouldAlertTrial } from '@/lib/subscriptions'
import { track } from '@/lib/analytics'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE) || 40

// POST /api/scan/process — process the NEXT batch of an active scan job.
// Auth: the worker (Bearer WHATSAPP_WORKER_SECRET) → oldest active job across users;
// or a logged-in user → their own active job. Processes exactly one batch then returns progress.
export async function POST(req) {
  const auth = req.headers.get('authorization') || ''
  const workerSecret = process.env.WHATSAPP_WORKER_SECRET
  const isWorker = Boolean(workerSecret) && auth === `Bearer ${workerSecret}`

  let job
  if (isWorker) {
    const { data } = await supabaseAdmin
      .from('scan_jobs')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    job = data
  } else {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', session.user.email)
      .single()
    if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })
    const { data } = await supabaseAdmin
      .from('scan_jobs')
      .select('*')
      .eq('user_id', profile.id)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    job = data
  }

  if (!job) return Response.json({ idle: true })

  // Already at/past the end → finalize.
  if (job.cursor >= job.total) {
    await finishJob(job)
    return Response.json({ jobId: job.id, status: 'done', total: job.total, cursor: job.total, found: job.found })
  }

  if (job.status !== 'running') {
    await supabaseAdmin
      .from('scan_jobs')
      .update({ status: 'running', updated_at: new Date().toISOString() })
      .eq('id', job.id)
  }

  const ids = (job.message_ids || []).slice(job.cursor, job.cursor + BATCH_SIZE)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', job.user_id)
    .single()

  const token = await getValidGmailToken(profile)
  if (!token) {
    await supabaseAdmin
      .from('scan_jobs')
      .update({ status: 'error', error: 'gmail_disconnected', updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return Response.json({ jobId: job.id, status: 'error', error: 'gmail_disconnected' })
  }

  const emails = await fetchEmailsByIds(token, ids)
  const stats = {}
  const parsed = await parseSubscriptions(emails, stats)

  // Whole batch's AI call failed (rate-limited) → DON'T advance; this exact batch retries next tick.
  if (stats.batches > 0 && stats.failed === stats.batches) {
    await supabaseAdmin
      .from('scan_jobs')
      .update({ failed_batches: (job.failed_batches || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', job.id)
    return Response.json({
      jobId: job.id,
      status: 'running',
      total: job.total,
      cursor: job.cursor,
      found: job.found,
      retryAfterMs: stats.retryAfterMs || 15000,
    })
  }

  // Write results — fuzzy dedupe-on-write against the user's existing rows (no duplicates).
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', job.user_id)
  const existingRows = existing || []
  let newCount = 0
  for (const sub of parsed) {
    const { isNew } = await upsertParsedSubscription(job.user_id, sub, existingRows, {
      reminderDays: profile?.reminder_days_default,
    })
    if (isNew) newCount += 1
  }

  const cursor = Math.min(job.cursor + ids.length, job.total)
  const found = job.found + newCount
  const done = cursor >= job.total
  // Stay 'running' even when we've consumed the last batch — the job is only 'done' once finishJob's
  // reconcile + consolidation have committed (set below). This is what fixes cancellations (e.g. a cancelled
  // Google Cloud mandate) appearing only on the NEXT login: the client refetches on 'done', so 'done' must
  // mean "fully reconciled", not "last batch parsed".
  await supabaseAdmin
    .from('scan_jobs')
    .update({ cursor, found, status: 'running', updated_at: new Date().toISOString() })
    .eq('id', job.id)

  if (done) await finishJob({ ...job, found })

  return Response.json({ jobId: job.id, status: done ? 'done' : 'running', total: job.total, cursor, found })
}

// On completion: run reconcile + consolidation, stamp last_scanned_at, fire the Trial Watchdog, record
// analytics — and ONLY THEN mark the job 'done'. The client refetches the dashboard on 'done', so marking
// done before reconcile finishes is what made a cancelled mandate show up only on the next login.
async function finishJob(job) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', job.user_id)
    .single()
  if (!profile) {
    await supabaseAdmin.from('scan_jobs').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', job.id)
    return
  }

  // Whole-account reconciliation: apply cancellations the per-email pass couldn't match (a cancel email
  // that doesn't name the app) and collapse bank-only duplicates into their merchant row.
  try {
    const { data: allRows } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', profile.id)
    // Manually-added rows are user ground truth — the scanner must never cancel or delete them.
    const manualIds = new Set((allRows || []).filter((r) => r.source === 'manual').map((r) => r.id))
    const { cancelIds, deleteIds } = reconcile(allRows || [])
    const safeCancelIds = cancelIds.filter((id) => !manualIds.has(id))
    const safeDeleteIds = deleteIds.filter((id) => !manualIds.has(id))
    if (safeCancelIds.length) {
      await supabaseAdmin.from('subscriptions').update({ is_active: false, status: 'confirmed' }).in('id', safeCancelIds)
      await supabaseAdmin.from('alerts').update({ is_active: false }).in('subscription_id', safeCancelIds)
    }
    if (safeDeleteIds.length) await supabaseAdmin.from('subscriptions').delete().in('id', safeDeleteIds)

    // Scan-QA: one LLM call to resolve the "needs confirmation" pile AND re-check active mandates for
    // junk the per-email pass let through (personal transfers, govt insurance). Fail-safe (no change on error).
    const { data: review } = await supabaseAdmin
      .from('subscriptions')
      .select('id, service_name, kind, amount, currency, billing_cycle, next_charge_date, status, is_active')
      .eq('user_id', profile.id)
      .or('status.eq.pending,kind.eq.mandate')
    const reviewRows = (review || []).filter((r) => r.is_active !== false) // never re-touch cancelled rows
    if (reviewRows.length) {
      const decisions = await consolidatePending(reviewRows)
      const confirmIds = reviewRows.filter((r) => decisions[r.id] === 'confirm' && r.status === 'pending').map((r) => r.id)
      const dropIds = reviewRows.filter((r) => decisions[r.id] === 'drop' && !manualIds.has(r.id)).map((r) => r.id)
      if (confirmIds.length) await supabaseAdmin.from('subscriptions').update({ status: 'confirmed' }).in('id', confirmIds)
      if (dropIds.length) await supabaseAdmin.from('subscriptions').delete().in('id', dropIds)
    }
  } catch (e) {
    console.error('[scan] reconcile failed (non-fatal):', e?.message || e)
  }

  await supabaseAdmin
    .from('profiles')
    .update({ last_scanned_at: new Date().toISOString() })
    .eq('id', profile.id)

  await writeMonthlySnapshot(profile.id) // record this month's run-rate for the trend chart

  if (profile.whatsapp_opted_in && profile.phone_number) {
    const { data: newTrials } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', profile.id)
      .eq('is_trial', true)
      .eq('trial_alerted', false)
      .eq('status', 'confirmed')
    for (const trial of newTrials || []) {
      // Skip trials that have already ended (they've converted/charged) — mark handled so we don't
      // reconsider them on every scan, but never send a useless "trial ended in the past" alert.
      if (!shouldAlertTrial(trial)) {
        await supabaseAdmin.from('subscriptions').update({ trial_alerted: true }).eq('id', trial.id)
        continue
      }
      try {
        await sendTrialWatchdogAlert(profile.phone_number, trial)
        await supabaseAdmin.from('subscriptions').update({ trial_alerted: true }).eq('id', trial.id)
        await track('trial_watchdog_fired', {
          user_email: profile.email,
          service_name: trial.service_name,
          trial_end_date: trial.trial_end_date,
        })
      } catch {
        /* a single failed alert must not abort completion */
      }
    }
  }
  await track('gmail_scan_completed', { user_email: profile.email, subscriptions_found: job.found })

  // Mark 'done' LAST — now that reconcile + consolidation have committed, the client's refetch sees the
  // fully-reconciled dashboard (cancellations applied, duplicates collapsed) on this scan, not the next one.
  await supabaseAdmin
    .from('scan_jobs')
    .update({ status: 'done', updated_at: new Date().toISOString() })
    .eq('id', job.id)
}
