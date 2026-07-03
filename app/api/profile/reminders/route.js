import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { enforceIdentity } from '@/lib/ratelimit'
import { reminderDaysSchema, parseBody } from '@/lib/schemas'

// POST /api/profile/reminders { days } — set the user's global reminder lead-time. Persists the
// default for future subs and applies it to every existing subscription + alert in one go.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'profile-reminders', { limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const parsed = parseBody(reminderDaysSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
  const value = parsed.value.days

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  // Persist the default (best-effort — column exists once migration 0006 is applied).
  try {
    await supabaseAdmin.from('profiles').update({ reminder_days_default: value }).eq('id', profile.id)
  } catch {
    /* column missing — still apply to existing rows below */
  }

  await supabaseAdmin.from('subscriptions').update({ reminder_days: value }).eq('user_id', profile.id)
  await supabaseAdmin.from('alerts').update({ alert_days_before: value }).eq('user_id', profile.id)

  return Response.json({ ok: true, days: value })
}
