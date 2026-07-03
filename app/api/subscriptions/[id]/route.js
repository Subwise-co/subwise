import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateCommitment } from '@/lib/validation'
import { nextDueDate } from '@/lib/recurrence'
import { enforceIdentity } from '@/lib/ratelimit'

// Resolve the caller's profile id from the session, or null.
async function ownerId(session) {
  if (!session) return null
  const { data } = await supabaseAdmin.from('profiles').select('id').eq('email', session.user.email).single()
  return data?.id || null
}

// PATCH /api/subscriptions/[id] — edit a MANUAL commitment (category/title/amount/recurrence/date/reminder).
// Owner-checked; manual-only (Gmail rows are re-scanned, so editing them would be overwritten). Re-syncs
// the alert (lead time + next charge date rolled forward via the recurrence).
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  const uid = await ownerId(session)
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'subscriptions-edit', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { id } = await params
  const payload = await req.json().catch(() => ({}))
  const { valid, errors, value } = validateCommitment(payload)
  if (!valid) return Response.json({ error: errors.join('. ') }, { status: 400 })

  // Only the owner's MANUAL rows are editable.
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('id, source')
    .eq('id', id)
    .eq('user_id', uid)
    .maybeSingle()
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
  if (existing.source !== 'manual')
    return Response.json({ error: 'Only manual reminders can be edited' }, { status: 403 })

  const patch = {
    service_name: value.service_name,
    title: value.title,
    category: value.category,
    amount: value.amount,
    recurrence_rule: value.recurrence_rule,
    billing_cycle: value.billing_cycle,
    next_charge_date: value.next_charge_date,
    reminder_days: value.reminder_days,
  }
  const { data: updated, error } = await supabaseAdmin
    .from('subscriptions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Keep the reminder alert in sync.
  await supabaseAdmin
    .from('alerts')
    .update({
      alert_days_before: value.reminder_days,
      is_active: true,
    })
    .eq('subscription_id', id)
    .eq('user_id', uid)

  return Response.json({ subscription: updated, nextDue: nextDueDate(value.recurrence_rule, value.next_charge_date) })
}

// DELETE /api/subscriptions/[id] — remove a commitment (owner-checked). The alerts row cascades.
export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  const uid = await ownerId(session)
  if (!uid) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'subscriptions-delete', { limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { id } = await params
  const { data: deleted } = await supabaseAdmin
    .from('subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', uid)
    .select('id')
    .maybeSingle()
  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ ok: true })
}
