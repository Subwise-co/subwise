import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { track } from '@/lib/analytics'
import { enforceIdentity } from '@/lib/ratelimit'
import { statusSchema, parseBody } from '@/lib/schemas'

// POST { id, status: 'confirmed' | 'rejected' } — user confirms/rejects a pending item.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'subscriptions-status', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const parsed = parseBody(statusSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
  const { id, status, trial_end_date, next_charge_date } = parsed.value

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // When confirming, the user can supply the date(s) we couldn't detect.
  const patch = { status, is_active: status !== 'rejected' }
  if (status === 'confirmed' && trial_end_date) patch.trial_end_date = trial_end_date
  if (status === 'confirmed' && next_charge_date) patch.next_charge_date = next_charge_date

  // Update only if the row belongs to this user (ownership guard).
  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', profile.id)
    .select()
    .single()

  if (error || !sub) return Response.json({ error: 'Subscription not found' }, { status: 404 })

  if (status === 'confirmed') {
    // Now that it's confirmed, wire up a renewal alert for recurring items with a charge date.
    if ((sub.kind === 'subscription' || sub.kind === 'mandate') && sub.next_charge_date) {
      await supabaseAdmin.from('alerts').upsert(
        {
          user_id: profile.id,
          subscription_id: sub.id,
          alert_type: 'renewal_reminder',
          alert_days_before: sub.reminder_days || 3,
          is_active: true,
        },
        { onConflict: 'subscription_id' }
      )
    }
  } else {
    // Rejected: deactivate any alert so the cron stops reminding.
    await supabaseAdmin.from('alerts').update({ is_active: false }).eq('subscription_id', sub.id)
  }

  await track('subscription_confirmation', {
    user_email: session.user.email,
    service_name: sub.service_name,
    decision: status,
  })

  return Response.json({ subscription: sub })
}
