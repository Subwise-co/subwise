'use client'
import Link from 'next/link'

// Minimal nav for the standalone legal/guide pages (/privacy, /terms, /guides). The marketing landing
// has its own nav inside the new design; the global theme toggle is rendered in the root layout.
export default function Nav() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-line bg-canvas/80 backdrop-blur">
      <nav className="container-x flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tighter text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-pos text-white text-sm font-bold">S</span>
          subwise
        </Link>
        <div className="flex items-center gap-6 text-sm text-faint">
          <Link href="/guides" className="hover:text-ink">Guides</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/" className="rounded-full bg-ink px-4 py-1.5 font-medium text-canvas hover:opacity-90">
            Home
          </Link>
        </div>
      </nav>
    </header>
  )
}
