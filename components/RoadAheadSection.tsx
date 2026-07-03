"use client";

import { motion } from "framer-motion";
import TiltCard from "@/components/ui/TiltCard";

function IconPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {children}
    </div>
  );
}

const CARDS = [
  {
    color: "#3b82f6",
    title: "Family Finance",
    desc: "Shared reminders for the whole household.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    color: "#8b5cf6",
    title: "AI Assistant",
    desc: "Plan and reschedule in plain language.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.68 5.16L19 9l-4.32 3.16L16.16 18 12 15.16 7.84 18l1.48-5.84L5 9l5.32-.84z" />
      </svg>
    ),
  },
  {
    color: "#10b981",
    title: "Smart Spending",
    desc: "Gentle nudges before money goes out.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    color: "#f97316",
    title: "Natural Language Reminders",
    desc: '"Remind me about rent every 1st."',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    color: "#14b8a6",
    title: "Expense Predictions",
    desc: "See next month before it arrives.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#14b8a6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
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

export default function RoadAheadSection() {
  return (
    <section className="relative w-full bg-[#f7f7fc] dark:bg-[#04040c] py-24 px-6 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            {...fadeUp(0)}
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-4"
          >
            The Road Ahead
          </motion.p>
          <motion.h2
            {...fadeUp(0.08)}
            style={{ fontFamily: "var(--font-dm-serif)" }}
            className="text-4xl sm:text-5xl lg:text-[56px] text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em]"
          >
            Financial reminders<br />are only the beginning.
          </motion.h2>
        </div>

        {/* Row 1 — 3 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {CARDS.slice(0, 3).map((item, i) => (
            <motion.div key={item.title} {...fadeUp(i * 0.08)}>
              <TiltCard accentColor={item.color} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <IconPill color={item.color}>{item.icon}</IconPill>
                  <span
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                    className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Coming Soon
                  </span>
                </div>
                <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">
                  {item.title}
                </h3>
                <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </TiltCard>
            </motion.div>
          ))}
        </div>

        {/* Row 2 — 2 cards centred */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-2xl sm:mx-auto">
          {CARDS.slice(3).map((item, i) => (
            <motion.div key={item.title} {...fadeUp(i * 0.08)}>
              <TiltCard accentColor={item.color} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <IconPill color={item.color}>{item.icon}</IconPill>
                  <span
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                    className="text-[10px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-full whitespace-nowrap"
                  >
                    Coming Soon
                  </span>
                </div>
                <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">
                  {item.title}
                </h3>
                <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {item.desc}
                </p>
              </TiltCard>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
