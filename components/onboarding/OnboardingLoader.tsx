"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const LINES = [
  "Sniffing out silent drains…",
  "Teaching a robot to read your bills…",
  "Counting subscriptions so you don't have to…",
  "Catching sneaky auto-renewals…",
  "Following the money trail…",
  "Tidying everything into one place…",
];

function Blob({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl ${className}`}
      animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.2, 0.95, 1] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay }}
    />
  );
}

export default function OnboardingLoader({
  found = 0,
  total = 0,
  cursor = 0,
  mode = "scanning",
}: {
  found?: number;
  total?: number;
  cursor?: number;
  mode?: "scanning" | "setup";
}) {
  const [lineIdx, setLineIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setLineIdx((i) => (i + 1) % LINES.length), 2200);
    return () => clearInterval(t);
  }, []);

  const pct = total > 0 ? Math.min(100, Math.round((cursor / total) * 100)) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white dark:bg-[#04040c] px-6 text-center">
      {/* Soft aurora background — toned down for a cleaner feel */}
      <div className="absolute inset-0 pointer-events-none">
        <Blob className="w-[34rem] h-[34rem] -top-28 -left-20 bg-violet-400/20 dark:bg-violet-600/20" delay={0} />
        <Blob className="w-[30rem] h-[30rem] -bottom-24 -right-16 bg-emerald-300/20 dark:bg-emerald-600/15" delay={3} />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Subwise mark — transparent logo, no card. Enters with a pop, then gently floats + breathes over a
            soft pulsing brand-gradient glow. */}
        <motion.div
          className="relative mb-8 grid place-items-center"
          initial={{ opacity: 0, scale: 0.85, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            className="absolute h-28 w-28 rounded-full bg-gradient-to-br from-violet-500/40 to-emerald-400/40 blur-2xl"
            animate={{ scale: [1, 1.3, 1], opacity: [0.45, 0.8, 0.45] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src="/logo-mark.png"
            alt="Subwise"
            className="relative w-24 h-auto select-none drop-shadow-xl"
            animate={{ y: [0, -9, 0], scale: [1, 1.04, 1], rotate: [0, 1.5, 0, -1.5, 0] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {mode === "setup" ? "Setting up your space…" : "Reading your inbox…"}
        </h1>

        {/* Rotating funny line */}
        <div className="h-7 mt-3 overflow-hidden">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-base text-slate-500 dark:text-slate-400"
          >
            {LINES[lineIdx]}
          </motion.p>
        </div>

        {mode === "scanning" && (
          <div className="mt-8 w-72 max-w-full">
            <div className="h-1.5 w-full rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-600 to-emerald-500"
                animate={{ width: pct != null ? `${pct}%` : ["12%", "92%"] }}
                transition={pct != null ? { duration: 0.4 } : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <p className="mt-2.5 text-xs text-slate-400 tabular-nums">
              {total > 0 ? `Scanned ${cursor}/${total}` : "Connecting to Gmail…"}
              {found > 0 ? ` · found ${found}` : ""}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">This usually takes a minute or two — hang tight ☕</p>
          </div>
        )}
      </div>
    </div>
  );
}
