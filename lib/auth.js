// PURE auth helpers — email/password validation + normalization. Zero I/O so they're unit-tested and
// reused by both the register route and the NextAuth CredentialsProvider.

export const MIN_PASSWORD_LENGTH = 8

// RFC-ish, deliberately permissive: one @, a dot in the domain, no spaces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function isValidEmail(email) {
  const e = normalizeEmail(email)
  return e.length <= 254 && EMAIL_RE.test(e)
}

export function passwordError(password) {
  const p = String(password ?? '')
  if (p.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (p.length > 200) return 'Password is too long'
  return null
}

// Validate a sign-up/sign-in credential pair. Returns { ok, email } or { ok:false, error }.
export function validateCredentials({ email, password } = {}) {
  if (!isValidEmail(email)) return { ok: false, error: 'Enter a valid email address' }
  const pwErr = passwordError(password)
  if (pwErr) return { ok: false, error: pwErr }
  return { ok: true, email: normalizeEmail(email) }
}
