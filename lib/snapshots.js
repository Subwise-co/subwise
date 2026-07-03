// Write a monthly spend snapshot so the dashboard chart accrues REAL month-over-month history.
// Called at the end of each scan (manual job completion + weekly auto-scan). Idempotent per month.
import { startOfMonth, format } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase-server'
import { computeGhostSpend } from '@/lib/subscriptions'
import { fetchRatesToInr } from '@/lib/currency'

// Upsert this month's run-rate (INR) + active count for a user. Feature-detects the table: if the
// 0006 migration hasn't been applied yet, it no-ops silently instead of breaking the scan.
export async function writeMonthlySnapshot(userId) {
  if (!userId) return
  try {
    const { data: subs } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', userId)
    const rates = await fetchRatesToInr()
    const { monthlyInr, count } = computeGhostSpend(subs || [], new Date(), rates, 'INR')
    const month = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    await supabaseAdmin.from('spend_snapshots').upsert(
      { user_id: userId, month, monthly_total_inr: Math.round(monthlyInr), active_count: count },
      { onConflict: 'user_id,month' }
    )
  } catch {
    /* table missing (migration not applied) or transient error — snapshots are best-effort */
  }
}
