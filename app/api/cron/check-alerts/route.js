// Daily renewal-alert cron (Vercel: 0 2 * * * = 7:30 AM IST).
// Groups due alerts by user, batches same-day renewals into one WhatsApp message,
// and falls back to email when the user isn't opted in (or the WhatsApp send fails).
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendRenewalWhatsApp, sendBatchedRenewalWhatsApp, sendBudgetAlert } from '@/lib/whatsapp'
import { sendRenewalEmail } from '@/lib/alerts'
import { track } from '@/lib/analytics'
import { isAlertDueToday } from '@/lib/subscriptions'
import { commitmentTotals } from '@/lib/dashboard'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: alerts } = await supabaseAdmin
    .from('alerts')
    .select('*, subscriptions(*), profiles(*)')
    .eq('is_active', true)

  const grouped = {}
  for (const alert of alerts || []) {
    const sub = alert.subscriptions
    if (!sub?.next_charge_date || !sub?.is_active) continue
    if (!isAlertDueToday(sub.next_charge_date, alert.alert_days_before)) continue
    const email = alert.profiles?.email
    if (!email) continue
    if (!grouped[email]) grouped[email] = { profile: alert.profiles, subs: [] }
    grouped[email].subs.push(sub)
  }

  for (const [email, { profile, subs }] of Object.entries(grouped)) {
    try {
      const viaWhatsApp = profile.whatsapp_opted_in && profile.phone_number
      if (viaWhatsApp) {
        if (subs.length > 1) await sendBatchedRenewalWhatsApp(profile.phone_number, subs)
        else await sendRenewalWhatsApp(profile.phone_number, subs[0])
      } else {
        for (const sub of subs) await sendRenewalEmail(email, sub)
      }
      await supabaseAdmin
        .from('alerts')
        .update({ last_sent_at: new Date().toISOString() })
        .in(
          'subscription_id',
          subs.map((s) => s.id)
        )
      await track('renewal_alert_sent', {
        user_email: email,
        subscriptions_count: subs.length,
        channel: viaWhatsApp ? 'whatsapp' : 'email',
      })
      // Metering (instrument, no paywall): count reminders delivered per user → sets pricing later.
      // Error ignored (the column exists only once migration 0008 is applied).
      await supabaseAdmin
        .from('profiles')
        .update({ reminders_sent: (profile.reminders_sent || 0) + subs.length })
        .eq('id', profile.id)
    } catch {
      // WhatsApp failed — fall back to email so the user is never silently dropped.
      for (const sub of subs) await sendRenewalEmail(email, sub).catch(() => {})
    }
  }

  // ── Over-budget nudge: once per month, if a user's recurring commitment exceeds their budget.
  let budgetAlerts = 0
  try {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    const { data: budgeters } = await supabaseAdmin
      .from('profiles')
      .select('id, phone_number, whatsapp_opted_in, monthly_budget, budget_alert_month')
      .gt('monthly_budget', 0)
    for (const p of budgeters || []) {
      if (!p.whatsapp_opted_in || !p.phone_number) continue
      if (p.budget_alert_month === month) continue // already nudged this month
      const { data: subs } = await supabaseAdmin.from('subscriptions').select('*').eq('user_id', p.id)
      const { monthlyInr } = commitmentTotals(subs || [], new Date(), null, 'INR')
      if (monthlyInr <= Number(p.monthly_budget)) continue
      try {
        await sendBudgetAlert(p.phone_number, { commitment: monthlyInr, budget: Number(p.monthly_budget) })
        await supabaseAdmin.from('profiles').update({ budget_alert_month: month }).eq('id', p.id)
        budgetAlerts += 1
      } catch {
        /* best-effort (template may not be approved yet) */
      }
    }
  } catch {
    /* budget columns may not exist until migration 0009 is applied */
  }

  return Response.json({ processed: Object.keys(grouped).length, budgetAlerts })
}
