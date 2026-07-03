// Pure logic for interpreting inbound WhatsApp messages and producing cancellation steps.
// No network/DB — the webhook route wires these to Supabase + Meta sends.

// Cancellation steps for the top services — includes UPI mandate revocation for GPay/PhonePe/Paytm.
export const CANCEL_STEPS = {
  netflix: `*Netflix:*\n1. netflix.com → Account → Cancel Membership\n2. GPay → Manage Autopay → Netflix → Cancel\n3. PhonePe → Profile → Autopay → Cancel Netflix\n4. Paytm → Passbook → Autopay → Cancel`,
  spotify: `*Spotify:*\n1. spotify.com/account → Change Plan → Cancel Plan\n2. Cancel UPI mandate in GPay / PhonePe / Paytm`,
  hotstar: `*Hotstar/Disney+:*\n1. hotstar.com → Account → Subscription → Cancel\n2. GPay → Manage Autopay → Hotstar → Cancel`,
  'amazon prime': `*Amazon Prime:*\n1. amazon.in → Account → Prime → End Membership\n2. Cancel UPI mandate in GPay / PhonePe / Paytm`,
  'youtube premium': `*YouTube Premium:*\n1. youtube.com → Paid Memberships → Cancel\n2. Cancel UPI mandate in your UPI app`,
  'zomato pro': `*Zomato Pro:*\n1. Zomato app → Profile → Zomato Pro → Cancel\n2. Cancel UPI mandate in GPay / PhonePe / Paytm`,
  'swiggy one': `*Swiggy One:*\n1. Swiggy app → Profile → Swiggy One → Cancel\n2. Cancel UPI mandate in your UPI app`,
  zee5: `*Zee5:*\n1. zee5.com → My Account → Subscription → Cancel\n2. Cancel UPI mandate in GPay / PhonePe / Paytm`,
  jiocinema: `*JioCinema:*\n1. JioCinema app → Profile → My Plan → Cancel\n2. Cancel UPI mandate in GPay / PhonePe / Paytm`,
}

export function getCancellationSteps(service) {
  const key = (service ?? '').toString().toLowerCase().trim()
  return (
    CANCEL_STEPS[key] ||
    `*${service} Cancellation:*\n1. Open the ${service} app → Account → Cancel Subscription\n\n⚠️ *Also cancel the UPI mandate separately:*\n• GPay: Manage Autopay → find ${service} → Cancel\n• PhonePe: Profile → Payment History → Autopay → Cancel\n• Paytm: Passbook → Autopay → Cancel\n\nCancelling the app alone does NOT stop the UPI charge.`
  )
}

export const HELP_TEXT =
  'Commands:\n• Reply YES to confirm alerts\n• Reply STOP to unsubscribe\n• Reply START to re-subscribe\n• Reply PAUSE to stop the weekly scan (RESUME to turn it back on)\n• Reply CANCEL [service] for cancellation steps\n\nExample: CANCEL Netflix'

// Classify an inbound message into an intent. Returns { type, service? }.
// type: 'stop' | 'confirm' | 'start' | 'pause' | 'resume' | 'cancel' | 'help' | 'ignore'
export function classifyInboundCommand(rawText) {
  const text = (rawText ?? '').toString().trim()
  if (!text) return { type: 'ignore' }
  const upper = text.toUpperCase()

  if (['STOP', 'UNSUBSCRIBE', 'NO'].some((w) => upper.startsWith(w))) return { type: 'stop' }
  if (['YES', 'Y'].includes(upper)) return { type: 'confirm' }
  if (upper === 'START') return { type: 'start' }
  if (upper === 'PAUSE') return { type: 'pause' }
  if (upper === 'RESUME') return { type: 'resume' }
  if (upper.startsWith('CANCEL ')) return { type: 'cancel', service: text.slice(7).trim() }
  return { type: 'help' }
}
