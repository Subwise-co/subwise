// Shared two-way WhatsApp inbound handler — transport-agnostic.
// Applies the DB side effects for an inbound command and RETURNS the reply text (or null).
// Both transports reuse it:
//   • Meta webhook (app/api/whatsapp/webhook) → sends the reply via the Cloud API
//   • whatsapp-web.js worker (app/api/whatsapp/inbound) → worker sends the reply via the session
import { supabaseAdmin } from '@/lib/supabase-server'
import { classifyInboundCommand, getCancellationSteps, HELP_TEXT } from '@/lib/whatsapp-commands'
import { track } from '@/lib/analytics'

// `from` is any phone form; we match on the last 10 digits. Returns { reply } (reply may be null).
export async function handleInboundMessage(from, text) {
  const digits = String(from || '').replace(/\D/g, '').slice(-10)
  const command = classifyInboundCommand(text)

  switch (command.type) {
    case 'stop':
      await supabaseAdmin
        .from('profiles')
        .update({ whatsapp_opted_in: false })
        .eq('phone_number', digits)
      await track('stop_received', { user_phone: digits })
      return { reply: 'You have been unsubscribed. Reply START to re-subscribe anytime.' }

    case 'confirm':
      await supabaseAdmin
        .from('profiles')
        .update({ whatsapp_opted_in: true, whatsapp_opted_in_at: new Date().toISOString() })
        .eq('phone_number', digits)
      await track('whatsapp_confirmed', { user_phone: digits })
      return {
        reply:
          "✅ You're all set! We'll automatically scan your Gmail once a week and alert you before anything renews — no need to log in again.\n\nReply PAUSE anytime to stop the weekly scan · STOP to unsubscribe.",
      }

    case 'start':
      await supabaseAdmin
        .from('profiles')
        .update({ whatsapp_opted_in: true })
        .eq('phone_number', digits)
      return { reply: 'Welcome back! Your subscription alerts are re-enabled.' }

    case 'pause':
      await supabaseAdmin
        .from('profiles')
        .update({ weekly_scan_paused: true })
        .eq('phone_number', digits)
      return {
        reply:
          'Paused. We will no longer scan your Gmail weekly. Reply RESUME to turn weekly scans back on.',
      }

    case 'resume':
      await supabaseAdmin
        .from('profiles')
        .update({ weekly_scan_paused: false })
        .eq('phone_number', digits)
      return { reply: 'Weekly scans resumed. We will check for new subscriptions every week.' }

    case 'cancel':
      await track('cancel_steps_requested', { user_phone: digits, service: command.service })
      return { reply: getCancellationSteps(command.service) }

    case 'ignore':
      return { reply: null }

    default:
      return { reply: HELP_TEXT }
  }
}
