import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-server'
import { validateCredentials } from '@/lib/auth'
import { track } from '@/lib/analytics'

// Resolve an absolute expiry (ms epoch) from whatever Google/NextAuth gives us.
function resolveExpiryMs(account) {
  if (account?.expires_at) return account.expires_at * 1000
  if (account?.expires_in) return Date.now() + account.expires_in * 1000
  return Date.now() + 3600 * 1000 // default 1h
}

async function refreshAccessToken(token) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const data = await response.json()
    if (!response.ok) throw data

    const newExpiry = Date.now() + data.expires_in * 1000
    await supabaseAdmin
      .from('profiles')
      .update({
        gmail_access_token: data.access_token,
        gmail_token_expiry: new Date(newExpiry).toISOString(),
      })
      .eq('email', token.email)

    return {
      ...token,
      accessToken: data.access_token,
      accessTokenExpires: newExpiry,
      // Google may not return a new refresh token; keep the old one.
      refreshToken: data.refresh_token ?? token.refreshToken,
    }
  } catch (error) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
    // Email + password (no Gmail access). The profile is created by /api/auth/register; here we just
    // verify the password against the stored hash.
    CredentialsProvider({
      name: 'Email',
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const v = validateCredentials(credentials || {})
        if (!v.ok) return null
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id, email, password_hash, name')
          .eq('email', v.email)
          .maybeSingle()
        if (!profile?.password_hash) return null
        const ok = await bcrypt.compare(credentials.password, profile.password_hash)
        if (!ok) return null
        return { id: profile.id, email: profile.email, name: profile.name || null }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 365 * 24 * 60 * 60 }, // 1 year
  // The landing page IS the sign-in page (Google + email/password dialog), so send unauthenticated
  // users (and middleware redirects) there instead of NextAuth's default page.
  pages: { signIn: '/' },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        // Upsert by email. Do NOT set id — profiles.id defaults to gen_random_uuid().
        await supabaseAdmin.from('profiles').upsert(
          {
            email: user.email,
            name: user.name || null, // capture the Google display name for the sidebar/greeting
            gmail_access_token: account.access_token,
            gmail_refresh_token: account.refresh_token,
            gmail_token_expiry: new Date(resolveExpiryMs(account)).toISOString(),
          },
          { onConflict: 'email' }
        )
        await track('user_signed_in', { user_email: user.email })
      }
      return true
    },
    async jwt({ token, account, user }) {
      // On any sign-in, carry the display name into the token (Google supplies it; credentials returns it
      // from the profile) so session.user.name is populated for the sidebar/greeting.
      if (user?.name) token.name = user.name
      // Google sign-in: store the Gmail tokens for later refresh.
      if (account?.provider === 'google') {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: resolveExpiryMs(account),
        }
      }
      // Email/password (or any non-Google) sign-in: no Gmail token to manage.
      if (account) return token
      // Returning Google user: refresh the access token when it has expired.
      if (!token.refreshToken) return token
      if (token.accessTokenExpires && Date.now() < token.accessTokenExpires) return token
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken
      session.error = token.error
      return session
    },
  },
}
