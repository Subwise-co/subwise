import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { sendWhatsAppOptIn } from '@/lib/whatsapp'
import { normalizeIndianPhone } from '@/lib/validation'
import { track } from '@/lib/analytics'
import { enforce } from '@/lib/ratelimit'
import { optinSchema, parseBody } from '@/lib/schemas'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Throttle opt-in sends (per IP) to avoid WhatsApp send abuse / repeat-click spam.
  const limited = enforce(req, 'optin', { limit: 5, windowMs: 10 * 60_000 })
  if (limited) return limited

  const parsed = parseBody(optinSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })

  const digits = normalizeIndianPhone(parsed.value.phone)
  if (!digits)
    return Response.json({ error: 'Enter a valid 10-digit Indian mobile number' }, { status: 400 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('phone_number, whatsapp_opted_in')
    .eq('email', session.user.email)
    .single()

  // Already onboarded with this number → don't re-send the welcome (avoids spam / repeat-click bans).
  if (profile?.whatsapp_opted_in && profile.phone_number === digits) {
    return Response.json({ success: true, alreadyOptedIn: true })
  }

  // Store the number now (opted_in flips to true only when the user replies YES on WhatsApp).
  await supabaseAdmin
    .from('profiles')
    .update({ phone_number: digits })
    .eq('email', session.user.email)

  // The worker also dedups identical sends to the same number within a window, so rapid repeat
  // clicks won't spam the recipient.
  await sendWhatsAppOptIn(digits)
  await track('whatsapp_optin_sent', { user_email: session.user.email })

  return Response.json({ success: true })
}

// DELETE /api/whatsapp/optin — the user removes their WhatsApp connection from the app. Clears the number
// and the opt-in flag so no further reminders are sent (the other ways to disconnect are replying STOP on
// WhatsApp, which flips opted_in off but keeps the number).
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('profiles')
    .update({ phone_number: null, whatsapp_opted_in: false, whatsapp_opted_in_at: null })
    .eq('email', session.user.email)

  await track('whatsapp_disconnected', { user_email: session.user.email })
  return Response.json({ success: true })
}
