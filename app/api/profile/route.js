import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getStatus, effectiveNextChargeDate } from '@/lib/subscriptions'
import { fetchRatesToInr, currencyForCountry, currencySymbol, toInr, fromInr } from '@/lib/currency'
import { enforceIdentity } from '@/lib/ratelimit'

// GET /api/profile — returns the v3 frontend contract: { profile, subscriptions, snapshots }.
// Amounts are converted to the caller's display currency (IP-geo → currency, default INR) so a USD item
// like Anthropic $23.6 reads ~₹2,000 for an India user. Field names + the derived `status` are mapped
// here so the UI hook (lib/hooks/useProfile.ts) consumes the response directly. Gmail tokens never leak.
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Generous limit — the dashboard polls this; this just caps runaway/abuse.
  const limited = enforceIdentity(session.user.email, 'profile', { limit: 120, windowMs: 60_000 })
  if (limited) return limited

  const { data: profileRow } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', session.user.email)
    .single()

  const { data: rows } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('user_id', profileRow?.id)
    .order('amount', { ascending: false })

  // Spend-trend history (best-effort — the table may not exist until migration 0006 is applied).
  let snapRows = []
  try {
    const { data } = await supabaseAdmin
      .from('spend_snapshots')
      .select('month, monthly_total_inr')
      .eq('user_id', profileRow?.id)
      .order('month', { ascending: true })
    snapRows = data || []
  } catch {
    /* snapshots are optional */
  }

  // Display currency from the edge geo header (prod); local dev has no header → INR (India-first).
  const rates = await fetchRatesToInr()
  const displayCurrency = currencyForCountry(req.headers.get('x-vercel-ip-country')) || 'INR'
  // Convert a native (amount, code) pair into the display currency.
  const toDisplay = (amount, code) => Math.round(fromInr(toInr(amount, code || 'INR', rates), displayCurrency, rates) * 100) / 100

  const now = new Date()
  const subscriptions = (rows || [])
    // Don't surface items the user explicitly rejected.
    .filter((r) => r.status !== 'rejected')
    .map((r) => {
      // A recurring row (subscription/mandate) with no detected cycle is treated as MONTHLY — both for the
      // displayed cycle AND for the status/next-date math, so a paid sub like Anthropic (cycle missing) shows
      // "Monthly · Active" and rolls forward, instead of silently "expiring" on a past charge date.
      const recurring = (r.kind || 'subscription') !== 'one_time'
      const cycle = recurring ? r.billing_cycle || 'monthly' : r.billing_cycle || null
      const statusRow = { ...r, billing_cycle: cycle }
      // next_billing_date = the NEXT real occurrence (rolled forward to today-or-later) so the dashboard and
      // calendar never show a date in the past; one-time keeps its charge date.
      const nextDate = effectiveNextChargeDate(statusRow, now) || r.charge_date || null
      return {
        id: r.id,
        service_name: r.service_name,
        amount: toDisplay(r.amount, r.currency),
        currency: displayCurrency,
        native_amount: Number(r.amount) || 0,
        native_currency: r.currency || 'INR',
        billing_cycle: cycle || 'monthly',
        kind: r.kind || 'subscription',
        next_billing_date: nextDate,
        category: r.category || null,
        // UI status: pending detections stay 'pending' (drives the confirm banner); everything else
        // uses the derived display status (active / cancelled / expired / completed).
        status: r.status === 'pending' ? 'pending' : getStatus(statusRow, now),
        source: r.source || 'gmail',
        reminder_days: r.reminder_days ?? 3,
        created_at: r.created_at,
      }
    })

  const profile = profileRow
    ? {
        id: profileRow.id,
        email: profileRow.email,
        name: profileRow.name || null, // display name (Google profile or sign-up); sidebar/greeting use it
        avatar_url: null,
        created_at: profileRow.created_at,
        monthly_budget: toDisplay(profileRow.monthly_budget, 'INR'),
        default_reminder_days: profileRow.reminder_days_default ?? 3,
        whatsapp_number: profileRow.phone_number || null,
        whatsapp_opted_in: !!profileRow.whatsapp_opted_in,
        gmail_connected: !!profileRow.gmail_refresh_token,
        display_currency: displayCurrency,
        currency_symbol: currencySymbol(displayCurrency),
      }
    : null

  const snapshots = snapRows.map((s) => ({
    id: s.month,
    month: s.month,
    total_spend: toDisplay(s.monthly_total_inr, 'INR'),
    created_at: s.month,
  }))

  return Response.json({ profile, subscriptions, snapshots })
}
