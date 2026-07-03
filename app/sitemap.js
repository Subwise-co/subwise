import { GUIDES } from '@/lib/guides-data'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://subwise.co.in'

// Public, indexable routes only (the dashboard is auth-gated → excluded).
export default function sitemap() {
  const now = new Date()
  const guidePages = GUIDES.map((g) => ({
    url: `${SITE_URL}/guides/${g.slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    ...guidePages,
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
