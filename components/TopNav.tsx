"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Privacy", href: "#privacy" },
  { label: "FAQ", href: "#faq" },
];

export default function TopNav() {
  // Smooth-scroll to an in-page section.
  function go(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4 pointer-events-none">
      <nav className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/[0.06] dark:border-white/[0.08] bg-white/70 dark:bg-[#0d0d18]/70 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] pl-4 pr-2 py-1.5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 pr-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="Subwise" className="h-6 w-6 object-contain select-none" />
          <span className="hidden sm:block text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Subwise</span>
        </Link>

        <span className="hidden md:block w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />

        {/* Centered section links */}
        <div className="hidden md:flex items-center">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => go(e, l.href)}
              className="px-3 py-1.5 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            >
              {l.label}
            </a>
          ))}
          {/* Guides goes to its own page (cancellation guides) */}
          <Link
            href="/guides"
            className="px-3 py-1.5 rounded-full text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Guides
          </Link>
        </div>

        <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
        <ThemeToggle inline />
      </nav>
    </header>
  );
}
