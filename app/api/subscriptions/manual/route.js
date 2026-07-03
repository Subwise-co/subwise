import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateCommitment } from '@/lib/validation'
import { track } from '@/lib/analytics'
import { enforceIdentity } from '@/lib/ratelimit'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'subscriptions-manual', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  let payload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { valid, errors, value } = validateCommitment(payload)
  if (!valid) return Response.json({ error: errors.join('. ') }, { status: 400 })
  const { service_name, title, category, amount, billing_cycle, recurrence_rule, next_charge_date, reminder_days } = value
  // One-time payments are logged for the dashboard's financial picture — they don't recur or remind.
  const isOneTime = payload.kind === 'one_time'

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Upsert on (user_id, service_name) so re-adding the same commitment updates it (no duplicates).
  // category/recurrence_rule/title need migration 0008 — if it isn't applied yet, fall back to the
  // legacy column set so manual add still works (graceful degradation).
  const fullRow = {
    user_id: profile.id,
    service_name,
    title,
    category,
    amount,
    billing_cycle,
    recurrence_rule,
    next_charge_date,
    charge_date: next_charge_date,
    kind: isOneTime ? 'one_time' : 'subscription',
    source: 'manual',
    reminder_days,
    is_active: true,
  }
  let { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .upsert(fullRow, { onConflict: 'user_id,service_name' })
    .select()
    .single()
  if (error && /column .* does not exist|category|recurrence_rule|title/i.test(error.message || '')) {
    const { title: _t, category: _c, recurrence_rule: _r, ...legacy } = fullRow
    ;({ data: sub, error } = await supabaseAdmin
      .from('subscriptions')
      .upsert(legacy, { onConflict: 'user_id,service_name' })
      .select()
      .single())
  }

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Auto-create the renewal alert (one per subscription — unique on subscription_id). One-time payments
  // never remind, so they get no alert.
  if (!isOneTime) {
    await supabaseAdmin.from('alerts').upsert(
      {
        user_id: profile.id,
        subscription_id: sub.id,
        alert_type: 'renewal_reminder',
        alert_days_before: reminder_days,
        is_active: true,
      },
      { onConflict: 'subscription_id' }
    )
  }

  await track('manual_subscription_added', {
    user_email: session.user.email,
    service_name,
    category,
    amount,
    recurrence_rule,
  })

  return Response.json({ subscription: sub })
}
