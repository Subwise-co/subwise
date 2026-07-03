import type { ReactNode } from "react";
import SiteNav from "@/components/SiteNav";
import FooterSection from "@/components/FooterSection";

export interface LegalSection {
  h: string;
  body: ReactNode;
}

// Shared shell for /privacy and /terms — current light/dark design (logo header + content + footer).
export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated?: string;
  intro?: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-white dark:bg-[#04040c] text-slate-900 dark:text-white transition-colors duration-300">
      <SiteNav />

      <article className="max-w-3xl mx-auto px-6 pb-24 pt-32 md:pt-40">
        <p className="text-[11px] font-bold tracking-widest uppercase text-violet-500 mb-4">Legal</p>
        <h1
          style={{ fontFamily: "var(--font-dm-serif)" }}
          className="text-4xl md:text-5xl font-semibold tracking-tight text-balance"
        >
          {title}
        </h1>
        {updated && <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">Last updated {updated}</p>}
        {intro && (
          <p className="mt-6 text-lg leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">{intro}</p>
        )}

        <div className="mt-10 space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{s.h}</h2>
              <div className="mt-2 space-y-3 text-[0.95rem] leading-relaxed text-slate-600 dark:text-slate-300 text-pretty">
                {s.body}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-8 border-t border-black/[0.06] dark:border-white/[0.06] text-sm text-slate-500 dark:text-slate-400">
          Questions about this page? Email{" "}
          <a href="mailto:hello@subwise.co.in" className="text-violet-600 dark:text-violet-400 hover:underline">
            hello@subwise.co.in
          </a>
          .
        </div>
      </article>

      <FooterSection />
    </main>
  );
}
