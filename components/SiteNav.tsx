import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

// Shared floating pill nav for standalone pages (/privacy, /terms, /guides). Logo → home, a Guides
// link, a Home link, and the theme toggle. Kept minimal so it works on any page (no in-page anchors).
export default function SiteNav() {
  return (
    <header className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#0d0d18]/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] pl-4 pr-2 py-1.5">
        <Link href="/" className="flex items-center gap-2 pr-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="Subwise" className="h-6 w-6 object-contain select-none" />
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Subwise</span>
        </Link>
        <span className="w-px h-5 bg-black/10 dark:bg-white/10" />
        <Link
          href="/guides"
          className="px-3 py-1.5 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          Guides
        </Link>
        <Link
          href="/"
          className="px-3 py-1.5 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
        >
          Home
        </Link>
        <ThemeToggle inline />
      </nav>
    </header>
  );
}
