import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { enforceIdentity } from '@/lib/ratelimit'
import { budgetSchema, parseBody } from '@/lib/schemas'

// POST /api/profile/budget { budget } — set the user's monthly budget (INR). 0 clears it.
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = enforceIdentity(session.user.email, 'profile-budget', { limit: 20, windowMs: 60_000 })
  if (limited) return limited

  const parsed = parseBody(budgetSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
  const value = Math.round(parsed.value.budget)

  // Reset the monthly alert flag when the budget changes so a new over-budget nudge can fire.
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ monthly_budget: value, budget_alert_month: null })
    .eq('email', session.user.email)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, budget: value })
}
