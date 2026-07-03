"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import OnboardingLoader from "@/components/onboarding/OnboardingLoader";
import { runScan } from "@/lib/scan-client";

export default function WelcomePage() {
  const router = useRouter();
  const [progress, setProgress] = useState({ total: 0, cursor: 0, found: 0 });
  const [mode, setMode] = useState<"scanning" | "setup">("scanning");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // guard against double-run in strict mode
    started.current = true;
    let cancelled = false;
    const startedAt = Date.now();

    (async () => {
      // Is Gmail connected? (email/password users have no inbox to scan.)
      let gmail = false;
      try {
        const res = await fetch("/api/profile");
        if (res.ok) gmail = !!(await res.json())?.profile?.gmail_connected;
      } catch {
        /* fall through */
      }

      if (gmail) {
        setMode("scanning");
        await runScan({ onProgress: (p: typeof progress) => !cancelled && setProgress(p) });
      } else {
        setMode("setup");
        await new Promise((r) => setTimeout(r, 2600));
      }

      // Keep the loader on screen for a minimum beat so it never flashes.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 3200) await new Promise((r) => setTimeout(r, 3200 - elapsed));
      if (!cancelled) router.replace("/dashboard");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <OnboardingLoader {...progress} mode={mode} />;
}
