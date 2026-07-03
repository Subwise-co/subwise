const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://subwise.co.in'

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/api/', '/welcome', '/dashboard-preview'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
