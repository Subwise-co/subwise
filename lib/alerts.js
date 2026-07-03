// Email fallback channel via Resend — used when a user is not opted in to WhatsApp,
// or when a WhatsApp send fails.
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendRenewalEmail(email, sub) {
  await resend.emails.send({
    from: 'Subwise <onboarding@resend.dev>',
    to: email,
    subject: `Reminder: ${sub.service_name} renews on ${sub.next_charge_date}`,
    html: `<p><strong>${sub.service_name}</strong> renews on ${sub.next_charge_date} for ₹${sub.amount || 'unknown'}.</p><p>To cancel, go to the ${sub.service_name} app and also cancel the UPI mandate in GPay/PhonePe/Paytm.</p>`,
  })
}
