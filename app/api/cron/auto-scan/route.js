// Daily auto-scan cron (Vercel: 0 3 * * * = 8:30 AM IST). Runs each user on a rolling WEEKLY
// cadence: a user is scanned only when their last scan was ≥7 days ago. Zero-touch — uses the
// stored refresh token to mint a fresh Gmail access token (no user login). Each weekly scan only
// looks at emails since the last scan (incremental window). Respects weekly_scan_paused. 2s/user.
import { supabaseAdmin } from '@/lib/supabase-server'
import { fetchSubscriptionEmails } from '@/lib/gmail'
import { parseSubscriptions } from '@/lib/parser'
import { sendTrialWatchdogAlert, sendReconnectRequest, sendBetaRescanNudge } from '@/lib/whatsapp'
import { getValidGmailToken } from '@/lib/google-auth'
import { scanWindowDays, shouldAlertTrial } from '@/lib/subscriptions'
import { upsertParsedSubscription } from '@/lib/scan-write'
import { writeMonthlySnapshot } from '@/lib/snapshots'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000

export async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Due = has a refresh token, not paused, and last scanned ≥7 days ago (or never).
  const cutoff = new Date(Date.now() - WEEKLY_MS).toISOString()
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .not('gmail_refresh_token', 'is', null)
    .eq('weekly_scan_paused', false)
    .or(`last_scanned_at.is.null,last_scanned_at.lte.${cutoff}`)

  // Early-beta mode: while the app is in Google "Testing" (refresh tokens die after 7 days), we can't
  // reliably auto-scan. Instead of a silent failed scan, nudge opted-in users on the weekly cadence to
  // re-scan manually if they've added anything new. Flip BETA_RESCAN_NUDGE=0 (or unset) post-verification
  // to resume real auto-scanning.
  const BETA_NUDGE = process.env.BETA_RESCAN_NUDGE === '1'
  if (BETA_NUDGE) {
    let nudged = 0
    for (const user of users || []) {
      if (user.whatsapp_opted_in && user.phone_number) {
        await sendBetaRescanNudge(user.phone_number).catch(() => {})
        nudged += 1
      }
      // Stamp so the same user isn't nudged again until ~7 days later (reuses the weekly cadence).
      await supabaseAdmin
        .from('profiles')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', user.id)
      await new Promise((r) => setTimeout(r, 2000))
    }
    return Response.json({ due: users?.length || 0, nudged, mode: 'beta-rescan-nudge' })
  }

  let scanned = 0
  for (const user of users || []) {
    // Refresh the access token server-side (no login). If we can't, ask the user to reconnect.
    const accessToken = await getValidGmailToken(user)
    if (!accessToken) {
      if (user.whatsapp_opted_in && user.phone_number)
        await sendReconnectRequest(user.phone_number).catch(() => {})
      continue
    }

    try {
      const emails = await fetchSubscriptionEmails(accessToken, { days: scanWindowDays(user.last_scanned_at) })
      const subs = await parseSubscriptions(emails)

      // Fuzzy dedupe-on-write against existing rows (shared with the manual scan job).
      const { data: existing } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
      const existingRows = existing || []
      for (const sub of subs) {
        await upsertParsedSubscription(user.id, sub, existingRows, {
          reminderDays: user.reminder_days_default,
        })
      }

      // Trial Watchdog for newly confirmed, un-alerted trials.
      if (user.whatsapp_opted_in && user.phone_number) {
        const { data: newTrials } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_trial', true)
          .eq('trial_alerted', false)
          .eq('status', 'confirmed')
        for (const trial of newTrials || []) {
          // Skip already-ended trials (mark handled so we don't reconsider them each week).
          if (!shouldAlertTrial(trial)) {
            await supabaseAdmin.from('subscriptions').update({ trial_alerted: true }).eq('id', trial.id)
            continue
          }
          try {
            await sendTrialWatchdogAlert(user.phone_number, trial)
            await supabaseAdmin.from('subscriptions').update({ trial_alerted: true }).eq('id', trial.id)
          } catch {
            /* skip a single failed alert */
          }
        }
      }

      // Mark scanned so the next weekly run is ~7 days out (rolling per-user cadence).
      await supabaseAdmin
        .from('profiles')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('id', user.id)
      await writeMonthlySnapshot(user.id)
      scanned += 1
    } catch {
      /* one user's scan failure must not stop the cron */
    }

    await new Promise((r) => setTimeout(r, 2000))
  }

  return Response.json({ due: users?.length || 0, scanned })
}
