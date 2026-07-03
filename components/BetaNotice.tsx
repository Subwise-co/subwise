"use client";

import { useEffect, useState } from "react";
import { FlaskConical, X } from "lucide-react";

const DISMISS_KEY = "subwise-beta-notice-dismissed-v1";

// Early-access notice for the first users. App is in production, pending Google verification, so
// new users see an "unverified app" screen when connecting Gmail — this reassures them about the
// read-only scope and gives a feedback channel. Set NEXT_PUBLIC_BETA_NOTICE=0 (+ redeploy) to hide.
export default function BetaNotice() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BETA_NOTICE === "0") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* localStorage unavailable — still show */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="mx-4 sm:mx-6 mt-4 sm:mt-6 rounded-xl border border-amber-200 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-500/[0.06] p-4 flex items-start gap-3">
      <FlaskConical size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
        <span className="font-semibold">Subwise is in early access</span> — thanks for being one of our first
        users. We&apos;re completing Google&apos;s review, so connecting Gmail may show an &ldquo;unverified
        app&rdquo; screen (tap <span className="font-semibold">Advanced → Continue</span>). We only ever use{" "}
        <span className="font-semibold">read-only</span> Gmail access to find your payments — nothing is sent,
        edited, or deleted. Spot a bug? Email{" "}
        <a href="mailto:hello@subwise.co.in" className="underline hover:no-underline">hello@subwise.co.in</a>.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}
