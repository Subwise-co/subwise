"use client";

import { motion } from "framer-motion";
import TiltCard from "@/components/ui/TiltCard";

function IconPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mb-3"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {children}
    </div>
  );
}

const PRIVACY_CARDS = [
  {
    color: "#4285f4",
    title: "Google OAuth",
    desc: "You sign in with Google. We never see your password.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/>
      </svg>
    ),
  },
  {
    color: "#22c55e",
    title: "Read-only Gmail",
    desc: "Subwise can only read — never send, edit, or delete.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    color: "#8b5cf6",
    title: "No password storage",
    desc: "Nothing sensitive is ever stored on our servers.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    color: "#f59e0b",
    title: "No bank access",
    desc: "We never connect to your bank or move money.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="22" x2="21" y2="22" />
        <line x1="6" y1="18" x2="6"  y2="11" />
        <line x1="10" y1="18" x2="10" y2="11" />
        <line x1="14" y1="18" x2="14" y2="11" />
        <line x1="18" y1="18" x2="18" y2="11" />
        <polygon points="12 2 2 7 22 7" />
      </svg>
    ),
  },
  {
    color: "#ef4444",
    title: "Delete anytime",
    desc: "Remove all your data with a single tap.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    ),
  },
  {
    color: "#14b8a6",
    title: "Never sold",
    desc: "Your data is yours. We never sell it. Ever.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="#14b8a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function PrivacySection() {
  return (
    <section className="relative w-full bg-white dark:bg-[#04040c] py-24 px-6 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16 items-start">

          {/* Left — text */}
          <div className="lg:w-[42%] flex-shrink-0">
            <motion.p
              {...fadeUp(0)}
              style={{ fontFamily: "var(--font-dm-sans)" }}
              className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-5"
            >
              Privacy &amp; Trust
            </motion.p>
            <motion.h2
              {...fadeUp(0.07)}
              style={{ fontFamily: "var(--font-dm-serif)" }}
              className="text-4xl sm:text-5xl text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em] mb-5"
            >
              Built like a vault.<br />Quiet by design.
            </motion.h2>
            <motion.p
              {...fadeUp(0.13)}
              style={{ fontFamily: "var(--font-dm-sans)" }}
              className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed mb-8"
            >
              Subwise is intentionally limited. It reads just enough to find your
              subscriptions — and nothing more. No banking access, no selling data,
              no surprises.
            </motion.p>

            {/* Badge */}
            <motion.div {...fadeUp(0.18)}>
              <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 flex-shrink-0" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <div>
                  <div style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                    End-to-end protected
                  </div>
                  <div style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] text-emerald-600/70 dark:text-emerald-500/60">
                    Encrypted in transit and at rest
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right — 2×3 card grid */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PRIVACY_CARDS.map((item, i) => (
              <motion.div key={item.title} {...fadeUp(0.05 + i * 0.07)}>
                <TiltCard accentColor={item.color} className="p-4">
                  <IconPill color={item.color}>{item.icon}</IconPill>
                  <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[14px] font-semibold text-slate-800 dark:text-white mb-1">
                    {item.title}
                  </h3>
                  <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    {item.desc}
                  </p>
                </TiltCard>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
