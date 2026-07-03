// Server-side Gmail token management — lets cron/server code get a valid access token WITHOUT
// the user being logged in, by refreshing with the stored refresh_token. This is what makes the
// weekly auto-scan truly zero-touch (Gmail access tokens expire in ~1 hour).
import { supabaseAdmin } from '@/lib/supabase-server'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000 // refresh a bit early to avoid edge-of-expiry failures

// Returns a valid Gmail access token for the profile, refreshing + persisting if needed.
// Returns null if it can't (no refresh token, or refresh failed) — caller should ask the user to reconnect.
export async function getValidGmailToken(profile) {
  if (!profile) return null

  const expiryMs = profile.gmail_token_expiry ? new Date(profile.gmail_token_expiry).getTime() : 0
  if (profile.gmail_access_token && expiryMs > Date.now() + EXPIRY_BUFFER_MS) {
    return profile.gmail_access_token
  }
  if (!profile.gmail_refresh_token) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: profile.gmail_refresh_token,
        grant_type: 'refresh_token',
      }),
    })
    const data = await res.json()
    if (!res.ok) throw data

    const newExpiry = Date.now() + data.expires_in * 1000
    await supabaseAdmin
      .from('profiles')
      .update({
        gmail_access_token: data.access_token,
        gmail_token_expiry: new Date(newExpiry).toISOString(),
      })
      .eq('id', profile.id)

    return data.access_token
  } catch (err) {
    console.error('[google-auth] token refresh failed:', err?.error || err?.message || err)
    return null
  }
}
