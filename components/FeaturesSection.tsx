"use client";

import { motion } from "framer-motion";
import TiltCard from "@/components/ui/TiltCard";

// ── WhatsApp message bubbles ───────────────────────────────────
const WA_MESSAGES = [
  { text: "Spotify renews tomorrow — ₹119. Reply PAUSE to snooze.", time: "9:41" },
  { text: "Your rent is due in 3 days — ₹22,000.", time: "10:02" },
  { text: "Netflix renews Jun 30 — ₹649.", time: "11:15" },
  { text: "ChatGPT auto-renews tonight — ₹1,699.", time: "11:15" },
];

function WAChatBubble({ text, time }: { text: string; time: string }) {
  return (
    <div className="flex justify-start">
      <div
        className="relative max-w-[88%] px-3 py-2 rounded-2xl rounded-tl-sm"
        style={{
          background: "rgba(34,197,94,0.14)",
          border: "1px solid rgba(34,197,94,0.22)",
        }}
      >
        <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11.5px] text-slate-700 dark:text-slate-200 leading-snug pr-8">
          {text}
        </p>
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="absolute bottom-1.5 right-2.5 text-[9px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {time}
          <svg viewBox="0 0 16 8" className="inline ml-0.5 mb-[1px]" width="12" height="6" fill="none">
            <path d="M1 4l3 3L10 1M6 4l3 3" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </div>
    </div>
  );
}

function WhatsAppCard() {
  return (
    <TiltCard accentColor="#22c55e" className="p-5 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.28)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        </div>
        <div>
          <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[15px] font-semibold text-slate-800 dark:text-white leading-tight">
            WhatsApp notifications
          </h3>
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] text-slate-400 dark:text-slate-500">
            Reminders in the app you already check.
          </p>
        </div>
      </div>

      {/* Mini WA chat */}
      <div className="rounded-xl overflow-hidden border border-black/[0.06] dark:border-white/[0.08] bg-[#f0fdf4] dark:bg-[#071a0e]">
        {/* WA header bar */}
        <div className="flex items-center gap-2.5 px-3 py-2 bg-[#15803d] dark:bg-[#14532d]">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-semibold text-white leading-none">Subwise</p>
            <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[9px] text-white/60 mt-0.5">Business account</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[9px] text-white/60">online</span>
          </div>
        </div>
        {/* Messages */}
        <div className="flex flex-col gap-2 px-3 py-3 bg-[#f0fdf4] dark:bg-[#071a0e]">
          {WA_MESSAGES.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <WAChatBubble {...msg} />
            </motion.div>
          ))}
        </div>
      </div>
    </TiltCard>
  );
}

// ── Shared helpers ─────────────────────────────────────────────
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

function ComingSoonBadge() {
  return (
    <span
      style={{ fontFamily: "var(--font-dm-sans)" }}
      className="text-[10px] font-bold tracking-widest uppercase text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1 rounded-full whitespace-nowrap"
    >
      Coming Soon
    </span>
  );
}

// ── Row 2 cards ────────────────────────────────────────────────
const ROW2 = [
  {
    color: "#f97316",
    title: "Recurring engine",
    desc: "Weekly, monthly, quarterly, custom.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
  },
  {
    color: "#0ea5e9",
    title: "Payment timeline",
    desc: "See the next 90 days at a glance.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#0ea5e9" strokeWidth="1.8" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <circle cx="3" cy="6"  r="1" fill="#0ea5e9" stroke="none" />
        <circle cx="3" cy="12" r="1" fill="#0ea5e9" stroke="none" />
        <circle cx="3" cy="18" r="1" fill="#0ea5e9" stroke="none" />
      </svg>
    ),
  },
  {
    color: "#3b82f6",
    title: "Trial tracking",
    desc: "Cancel before the free trial bills.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

// ── Row 3 cards ────────────────────────────────────────────────
const ROW3 = [
  {
    color: "#10b981",
    title: "Monthly calendar",
    desc: "A calm view of everything ahead.",
    badge: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#10b981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    color: "#7c3aed",
    title: "AI assistant",
    desc: "Ask anything in plain English.",
    badge: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.68 5.16L19 9l-4.32 3.16L16.16 18 12 15.16 7.84 18l1.48-5.84L5 9l5.32-.84z" />
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

// ── Section ────────────────────────────────────────────────────
export default function FeaturesSection() {
  return (
    <section className="relative w-full bg-white dark:bg-[#04040c] py-24 px-6 transition-colors duration-300">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-14">
          <motion.p
            {...fadeUp(0)}
            style={{ fontFamily: "var(--font-dm-sans)" }}
            className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-4"
          >
            Features
          </motion.p>
          <motion.h2
            {...fadeUp(0.08)}
            style={{ fontFamily: "var(--font-dm-serif)" }}
            className="text-4xl sm:text-5xl lg:text-[56px] text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em]"
          >
            Small details.<br />Compounding peace of mind.
          </motion.h2>
        </div>

        {/* Row 1 — WhatsApp (3/5 large) + Gmail / Manual (2/5 stacked) */}
        <div className="grid grid-cols-5 gap-4 mb-4">
          <motion.div className="col-span-5 sm:col-span-3" {...fadeUp(0)}>
            <WhatsAppCard />
          </motion.div>

          <div className="col-span-5 sm:col-span-2 flex flex-col gap-4">
            {/* Gmail — simplified */}
            <motion.div className="flex-1" {...fadeUp(0.07)}>
              <TiltCard accentColor="#6366f1" className="p-5 h-full">
                <div className="mb-3">
                  <IconPill color="#6366f1">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#6366f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <path d="M22 6l-10 7L2 6" />
                    </svg>
                  </IconPill>
                </div>
                <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">
                  Automatic Gmail detection
                </h3>
                <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Scan recurring payments from your inbox automatically.
                </p>
              </TiltCard>
            </motion.div>

            {/* Manual reminders */}
            <motion.div className="flex-1" {...fadeUp(0.12)}>
              <TiltCard accentColor="#8b5cf6" className="p-5 h-full">
                <div className="mb-3">
                  <IconPill color="#8b5cf6">
                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconPill>
                </div>
                <h3 style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[15px] font-semibold text-slate-800 dark:text-white mb-1.5">
                  Manual reminders
                </h3>
                <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Rent, EMI, fees — add anything that repeats.
                </p>
              </TiltCard>
            </motion.div>
          </div>
        </div>

        {/* Row 2 — 3 equal */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {ROW2.map((item, i) => (
            <motion.div key={item.title} {...fadeUp(i * 0.07)}>
              <TiltCard accentColor={item.color} className="p-5">
                <div className="mb-4"><IconPill color={item.color}>{item.icon}</IconPill></div>
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

        {/* Row 3 — 2 equal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ROW3.map((item, i) => (
            <motion.div key={item.title} {...fadeUp(i * 0.08)}>
              <TiltCard accentColor={item.color} className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <IconPill color={item.color}>{item.icon}</IconPill>
                  {item.badge && <ComingSoonBadge />}
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
