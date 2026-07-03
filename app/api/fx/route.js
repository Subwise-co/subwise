import { fetchRatesToInr } from '@/lib/currency'
import { enforce } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

// GET /api/fx — current {CODE: inrPerUnit} rates (live, cached server-side; static fallback) plus the
// caller's country (from Vercel's edge geo header) so the dashboard can show the ghost-spend total in
// the user's local currency. `country` is null in local dev (no Vercel header) → client falls back to
// the browser locale, then INR.
export async function GET(req) {
  const limited = enforce(req, 'fx', { limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const rates = await fetchRatesToInr()
  const country = req.headers.get('x-vercel-ip-country') || null
  return Response.json({ rates, country })
}
