import Nav from './Nav'
import Footer from './Footer'

// Shared shell for /privacy and /terms — matches the light/dark design language (Nav + Footer + tokens).
// Pass an array of { h, body } sections. `body` may be a string or JSX.
export default function LegalPage({ title, intro, updated, sections = [] }) {
  return (
    <main className="min-h-screen bg-canvas text-ink">
      <Nav />
      <article className="container-x max-w-3xl pb-24 pt-32 md:pt-40">
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="text-4xl font-semibold tracking-tightest text-balance md:text-5xl">{title}</h1>
        {updated && <p className="mt-3 text-sm text-faint">Last updated {updated}</p>}
        {intro && <p className="mt-6 text-lg text-muted text-pretty">{intro}</p>}

        <div className="mt-10 space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold tracking-tight text-ink">{s.h}</h2>
              <div className="mt-2 space-y-3 text-[0.95rem] leading-relaxed text-muted text-pretty">{s.body}</div>
            </section>
          ))}
        </div>
      </article>
      <Footer />
    </main>
  )
}
