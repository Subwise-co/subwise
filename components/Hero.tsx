"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import posthog from "posthog-js";
import PerspectiveGrid from "./PerspectiveGrid";
import FloatingIcons from "./FloatingIcons";
import TextRotate from "./TextRotate";
import { useTheme } from "./ThemeProvider";
import AuthDialog from "./AuthDialog";

function CheckIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0">
      <circle cx="8" cy="8" r="7" fill="#7c3aed" opacity={isDark ? 0.25 : 0.1} />
      <path d="M5 8.5l2 2 4-4" stroke="#7c3aed" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const trustBadges = ["Read-only Gmail access", "No banking data", "Free"];

export default function Hero() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-white dark:bg-[#04040c] flex items-center justify-center cursor-default transition-colors duration-300">
      {/* Layer 1: Grid */}
      <PerspectiveGrid rows={26} cols={38} />

      {/* Vignette — light */}
      <div
        className="absolute inset-0 z-10 pointer-events-none block dark:hidden"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.65) 76%, rgba(255,255,255,0.97) 100%)",
        }}
      />
      {/* Vignette — dark */}
      <div
        className="absolute inset-0 z-10 pointer-events-none hidden dark:block"
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 0%, transparent 40%, rgba(4,4,12,0.70) 76%, rgba(4,4,12,0.97) 100%)",
        }}
      />

      {/* Layer 2: Floating Icons */}
      <FloatingIcons />

      {/* Layer 3: Center Content */}
      <div className="relative z-30 flex flex-col items-center text-center px-6 max-w-3xl mx-auto pointer-events-none">

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontFamily: "var(--font-dm-serif)" }}
          className="text-6xl sm:text-7xl lg:text-[82px] font-normal text-slate-900 dark:text-white leading-[1.08] tracking-[-0.01em] pointer-events-none select-none transition-colors duration-300"
        >
          Never miss
          <br />
          <TextRotate />
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontFamily: "var(--font-dm-sans)" }}
          className="mt-6 text-lg sm:text-xl text-slate-500 dark:text-slate-400 font-normal leading-relaxed max-w-[480px] pointer-events-none select-none transition-colors duration-300"
        >
          Every subscription, bill, EMI, and due date — organized automatically
          and delivered as a WhatsApp message before it costs you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.46, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 pointer-events-auto"
        >
          <motion.button
            onClick={() => {
              posthog.capture("hero_cta_clicked");
              setAuthOpen(true);
            }}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            style={{
              fontFamily: "var(--font-dm-sans)",
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
              boxShadow: isDark
                ? "0 0 32px rgba(124,58,237,0.45), 0 4px 16px rgba(79,70,229,0.3)"
                : "0 0 24px rgba(124,58,237,0.22), 0 4px 14px rgba(79,70,229,0.18)",
            }}
            className="inline-flex items-center gap-2 text-white font-semibold text-base px-8 py-3.5 rounded-xl transition-all cursor-pointer"
          >
            Start tracking now
            <span className="ml-0.5">→</span>
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 flex items-center justify-center gap-5 flex-wrap"
        >
          {trustBadges.map((text) => (
            <span key={text} className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-dm-sans)" }}>
              <CheckIcon isDark={isDark} />
              <span className="text-[13px] text-slate-500 dark:text-slate-400 font-medium transition-colors duration-300">
                {text}
              </span>
            </span>
          ))}
        </motion.div>

      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </section>
  );
}
