import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { enforceIdentity } from '@/lib/ratelimit'
import { updateReminderSchema, parseBody } from '@/lib/schemas'

// POST /api/subscriptions/update { id, reminder_days } — per-subscription reminder override.
// Owner-checked; also syncs the subscription's alert row.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'subscriptions-update', { limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const parsed = parseBody(updateReminderSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
  const { id, reminder_days: value } = parsed.value

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Scope the update to the caller's own row.
  const { data: updated } = await supabaseAdmin
    .from('subscriptions')
    .update({ reminder_days: value })
    .eq('id', id)
    .eq('user_id', profile.id)
    .select('id')
    .maybeSingle()
  if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })

  await supabaseAdmin
    .from('alerts')
    .update({ alert_days_before: value })
    .eq('subscription_id', id)
    .eq('user_id', profile.id)

  return Response.json({ ok: true })
}
