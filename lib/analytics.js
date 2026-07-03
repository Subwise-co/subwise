// Server-side analytics for API routes and cron jobs → PostHog (posthog-node).
// distinct_id is the user's email so these server events merge with the client-side identify().
// Analytics failures must NEVER break the product, so everything is swallowed.
import { getPostHogClient } from '@/lib/posthog-server'

export async function track(event, properties = {}) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return
  try {
    const distinctId =
      properties.user_email || properties.user_id || properties.user_phone || 'anonymous'
    const client = getPostHogClient()
    client.capture({ distinctId, event, properties })
    // Serverless: flush now so the event is delivered before the function freezes.
    await client.flush()
  } catch {
    /* an analytics failure must never break the product */
  }
}
