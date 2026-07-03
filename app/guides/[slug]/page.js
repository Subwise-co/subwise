import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteNav from '@/components/SiteNav'
import FooterSection from '@/components/FooterSection'
import { GUIDES, GUIDES_BY_SLUG, MANDATE_REMINDER } from '@/lib/guides-data'

// Pre-render one static page per guide (best for SEO — each is its own indexable article).
export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const g = GUIDES_BY_SLUG[slug]
  if (!g) return { title: 'Guide not found — Subwise' }
  return {
    title: `How to cancel ${g.name} (India) — Subwise`,
    description: `${g.summary} Step-by-step: cancel ${g.name} and stop the UPI/NACH/card auto-debit.`,
    alternates: { canonical: `/guides/${g.slug}` },
  }
}

export default async function GuideArticle({ params }) {
  const { slug } = await params
  const g = GUIDES_BY_SLUG[slug]
  if (!g) notFound()

  // A few related guides from the same tier (excluding this one).
  const related = GUIDES.filter((x) => x.tier === g.tier && x.slug !== g.slug).slice(0, 4)

  // AEO: HowTo so answer engines can lift the steps directly.
  const howToLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `How to cancel ${g.name}`,
    description: g.summary,
    step: g.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#04040c] text-slate-900 dark:text-white transition-colors duration-300">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }} />
      <SiteNav />

      <article className="max-w-3xl mx-auto px-6 pb-20 pt-32 md:pt-40">
        <Link href="/guides" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
          ← All guides
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">{g.tag}</span>
          {g.tier === 'hard' && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
              mandate-based
            </span>
          )}
        </div>

        <h1
          style={{ fontFamily: 'var(--font-dm-serif)' }}
          className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight text-balance"
        >
          How to cancel {g.name}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{g.summary}</p>

        {/* Steps */}
        <ol className="mt-8 space-y-4">
          {g.steps.map((s, i) => (
            <li key={i} className="flex gap-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-[0.95rem] leading-relaxed text-slate-700 dark:text-slate-300">{s}</span>
            </li>
          ))}
        </ol>

        {/* Per-guide note */}
        {g.note && (
          <div className="mt-8 rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.06] p-4 text-sm leading-relaxed text-amber-800 dark:text-amber-300">
            <strong>Note:</strong> {g.note}
          </div>
        )}

        {/* Mandate reminder for the hard/mandate-based ones */}
        {g.tier === 'hard' && g.tag !== 'UPI mandate' && g.tag !== 'NACH mandate' && g.tag !== 'Card e-mandate' && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] p-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            ⚠️ {MANDATE_REMINDER}
          </div>
        )}

        {/* Related */}
        {related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Related guides</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/guides/${r.slug}`}
                  className="rounded-full border border-slate-200 dark:border-white/[0.08] px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors"
                >
                  {r.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Disclaimer */}
        <p className="mt-12 border-t border-black/[0.06] dark:border-white/[0.06] pt-6 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          App menus change often — if a step doesn&apos;t match exactly, look for{' '}
          <em>Account / Profile → Subscription / Membership → Cancel or Manage</em>, and always cancel the UPI/NACH/card
          mandate too. This is general guidance, not financial or legal advice.
        </p>

        {/* CTA */}
        <div className="mt-10 rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] p-6 text-center">
          <p className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
            Never get surprised by {g.name} again.
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Subwise finds your subscriptions and reminds you on WhatsApp before each charge.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex rounded-full bg-indigo-600 hover:bg-indigo-700 px-6 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Get started free
          </Link>
        </div>
      </article>

      <FooterSection />
    </main>
  )
}
