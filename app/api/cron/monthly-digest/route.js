// Monthly digest cron (Vercel: 0 4 1 * * = 9:30 AM IST on the 1st of the month).
// Sends every opted-in user a WhatsApp digest of their active subscriptions.
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendMonthlyDigest } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('whatsapp_opted_in', true)
    .not('phone_number', 'is', null)

  for (const user of users || []) {
    const { data: subs } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('amount', { ascending: false })

    if (subs?.length) await sendMonthlyDigest(user.phone_number, subs).catch(() => {})
    await new Promise((r) => setTimeout(r, 1000))
  }

  return Response.json({ sent: users?.length || 0 })
}
