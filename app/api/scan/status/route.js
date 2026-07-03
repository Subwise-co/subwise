import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { enforceIdentity } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// GET /api/scan/status — progress of the caller's most recent scan job (for the progress UI).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Polled during a scan — keep the limit high enough for ~2s polling.
  const limited = enforceIdentity(session.user.email, 'scan-status', { limit: 120, windowMs: 60_000 })
  if (limited) return limited

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!profile) return Response.json({ error: 'Profile not found' }, { status: 404 })

  const { data: job } = await supabaseAdmin
    .from('scan_jobs')
    .select('id, status, total, cursor, found, failed_batches')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!job) return Response.json({ status: 'none' })
  return Response.json(job)
}
