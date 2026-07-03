import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-line py-12">
      <div className="container-x flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-lg font-semibold tracking-tighter">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink text-sm text-canvas">S</span>
            subwise
          </p>
          <p className="mt-2 text-sm text-faint">Subscription radar for your inbox · India-first · free</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted">
          <Link href="/guides" className="transition-colors hover:text-ink">
            Guides
          </Link>
          <a href="/privacy" className="transition-colors hover:text-ink">
            Privacy
          </a>
          <a href="/terms" className="transition-colors hover:text-ink">
            Terms
          </a>
        </div>
      </div>
    </footer>
  )
}
