import Link from 'next/link'
import SiteNav from '@/components/SiteNav'
import FooterSection from '@/components/FooterSection'
import { HARD_GUIDES, EASY_GUIDES, GUIDES } from '@/lib/guides-data'

export const metadata = {
  title: 'How to cancel any subscription in India — Subwise guides',
  description:
    'Step-by-step cancellation guides for 25 subscriptions and auto-debit mandates in India — UPI AutoPay, NACH/e-NACH, card standing instructions, SIPs, plus quick cancels for Netflix, Spotify, Hotstar and more.',
  alternates: { canonical: '/guides' },
}

function GuideCard({ g }) {
  return (
    <Link
      href={`/guides/${g.slug}`}
      className="group flex flex-col rounded-2xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#0d0d18] p-5 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:shadow-sm transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">{g.tag}</span>
        {g.tier === 'hard' && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            mandate
          </span>
        )}
      </div>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-900 dark:text-white">{g.name}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400 flex-1">{g.summary}</p>
      <span className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 group-hover:underline">
        Read guide →
      </span>
    </Link>
  )
}

export default function GuidesPage() {
  // AEO/SEO: an ItemList so answer engines can enumerate every guide from the index.
  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Subscription cancellation guides (India)',
    itemListElement: GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: `How to cancel ${g.name}`,
      url: `https://subwise.co.in/guides/${g.slug}`,
    })),
  }

  return (
    <main className="min-h-screen bg-white dark:bg-[#04040c] text-slate-900 dark:text-white transition-colors duration-300">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      <SiteNav />

      <section className="max-w-5xl mx-auto px-6 pt-32 md:pt-40">
        <p className="text-[11px] font-bold tracking-widest uppercase text-violet-500 mb-4">Guides</p>
        <h1
          style={{ fontFamily: 'var(--font-dm-serif)' }}
          className="max-w-3xl text-4xl md:text-5xl font-semibold tracking-tight text-balance"
        >
          How to actually cancel a subscription in India.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          In India, cancelling the app often isn&apos;t enough — the{' '}
          <strong className="text-slate-900 dark:text-white">UPI AutoPay / NACH / card mandate</strong> keeps charging
          you. These guides cover both: how to cancel the service <em>and</em> how to kill the auto-debit at the source.
          Subwise reminds you before the charge; these show you how to stop it.
        </p>
      </section>

      {/* Hard / mandate-based */}
      <section className="max-w-5xl mx-auto px-6 pt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Hard to cancel <span className="text-slate-400 font-normal">· mandate-based</span>
          </h2>
          <span className="text-sm text-slate-400">{HARD_GUIDES.length} guides</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Auto-debit keeps running until you cancel the mandate — not just the app.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {HARD_GUIDES.map((g) => (
            <GuideCard key={g.slug} g={g} />
          ))}
        </div>
      </section>

      {/* Easy */}
      <section className="max-w-5xl mx-auto px-6 pt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Quick cancels <span className="text-slate-400 font-normal">· a few taps</span>
          </h2>
          <span className="text-sm text-slate-400">{EASY_GUIDES.length} guides</span>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Straightforward Account → Subscription → Cancel — still remember the UPI mandate.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EASY_GUIDES.map((g) => (
            <GuideCard key={g.slug} g={g} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-white/[0.03] p-8 md:p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">Don&apos;t see your service?</p>
          <p className="mx-auto mt-2 max-w-xl text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Connect Gmail and Subwise tracks it automatically — then it reminds you on WhatsApp before every charge.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-full bg-indigo-600 hover:bg-indigo-700 px-7 py-3 font-medium text-white transition-colors"
          >
            Get started free
          </Link>
        </div>
      </section>

      <FooterSection />
    </main>
  )
}
