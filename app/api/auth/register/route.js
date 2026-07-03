import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-server'
import { track } from '@/lib/analytics'
import { enforce } from '@/lib/ratelimit'
import { registerSchema, parseBody } from '@/lib/schemas'

// POST /api/auth/register { email, password } — create an email/password account (no Gmail access).
// Account-links by email: a pre-existing Google-only profile (no password_hash) gets the hash set;
// an already-registered email returns 409. After this, the client calls signIn('credentials').
export async function POST(req) {
  // Throttle signup spam (per IP) before any work.
  const limited = enforce(req, 'register', { limit: 5, windowMs: 10 * 60_000 })
  if (limited) return limited

  // Strict schema: rejects unexpected fields, normalizes/lowercases email, enforces length limits.
  const parsed = parseBody(registerSchema, await req.json().catch(() => null))
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 })
  const { email, password, name } = parsed.value
  const password_hash = await bcrypt.hash(password, 10)

  // Does a profile already exist for this email?
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, password_hash, name')
    .eq('email', email)
    .maybeSingle()

  if (existing?.password_hash) {
    return Response.json({ error: 'An account with this email already exists. Try logging in.' }, { status: 409 })
  }

  if (existing) {
    // Google-only profile → link a password to it (keep an existing name if present).
    await supabaseAdmin.from('profiles').update({ password_hash, name: existing.name || name }).eq('id', existing.id)
  } else {
    // Brand-new email account. Do NOT set id — profiles.id defaults to gen_random_uuid().
    const { error } = await supabaseAdmin.from('profiles').insert({ email, password_hash, name })
    if (error) return Response.json({ error: 'Could not create account' }, { status: 500 })
  }

  await track('user_signed_up', { user_email: email, method: 'password' })
  return Response.json({ ok: true })
}
