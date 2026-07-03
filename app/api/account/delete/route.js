import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { track } from '@/lib/analytics'
import { enforceIdentity } from '@/lib/ratelimit'

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Strict — destructive, irreversible action.
  const limited = enforceIdentity(session.user.email, 'account-delete', { limit: 5, windowMs: 60_000 })
  if (limited) return limited

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!profile) return Response.json({ success: true })

  await track('account_deleted', { user_email: session.user.email })

  await supabaseAdmin.from('feedback').delete().eq('user_email', session.user.email)
  // Deleting the profile cascades to subscriptions and alerts (ON DELETE CASCADE).
  await supabaseAdmin.from('profiles').delete().eq('id', profile.id)

  // We use NextAuth (not Supabase Auth), so there is usually no auth.users row to delete.
  // Attempt it for completeness but never let it fail the request.
  try {
    await supabaseAdmin.auth.admin.deleteUser(profile.id)
  } catch {
    /* no Supabase Auth user — expected under NextAuth */
  }

  return Response.json({ success: true })
}
