"use client";

import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

type IconColors = { bg: string; border: string; shadow: string };

const LIGHT_COLORS: IconColors[] = [
  { bg: "#fffbeb", border: "rgba(245,158,11,0.35)", shadow: "rgba(245,158,11,0.12)" },
  { bg: "#f0fdf4", border: "rgba(34,197,94,0.35)",  shadow: "rgba(34,197,94,0.12)"  },
  { bg: "#fef2f2", border: "rgba(239,68,68,0.35)",  shadow: "rgba(239,68,68,0.12)"  },
  { bg: "#f5f3ff", border: "rgba(139,92,246,0.35)", shadow: "rgba(139,92,246,0.12)" },
  { bg: "#fff7ed", border: "rgba(249,115,22,0.35)", shadow: "rgba(249,115,22,0.12)" },
];

const DARK_COLORS: IconColors[] = [
  { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.22)",  shadow: "rgba(251,191,36,0.10)"  },
  { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.22)",   shadow: "rgba(34,197,94,0.10)"   },
  { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.22)",   shadow: "rgba(239,68,68,0.10)"   },
  { bg: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.22)",  shadow: "rgba(139,92,246,0.10)"  },
  { bg: "rgba(249,115,22,0.10)",  border: "rgba(249,115,22,0.22)",  shadow: "rgba(249,115,22,0.10)"  },
];

const ICONS = [
  {
    stroke: "#f59e0b",
    rotate: -8,
    label: "Email",
    path: (
      <>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" strokeWidth="1.5" />
        <path d="M22 6l-10 7L2 6" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    stroke: "#22c55e",
    rotate: 5,
    label: "SMS",
    path: (
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" strokeWidth="1.5" strokeLinejoin="round" />
    ),
  },
  {
    stroke: "#ef4444",
    rotate: -5,
    label: "Push",
    path: (
      <>
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    stroke: "#8b5cf6",
    rotate: 9,
    label: "Calendar",
    path: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.5" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  {
    stroke: "#f97316",
    rotate: -6,
    label: "Notes",
    path: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
];

export default function ProblemSection() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <section className="relative w-full bg-[#f7f7fc] dark:bg-[#04040c] py-28 px-6 flex flex-col items-center overflow-hidden transition-colors duration-300">
      {/* Ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at center, rgba(124,58,237,0.07) 0%, transparent 70%)"
            : "radial-gradient(ellipse at center, rgba(124,58,237,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Label */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontFamily: "var(--font-dm-sans)" }}
        className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-6 transition-colors duration-300"
      >
        The Problem
      </motion.p>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontFamily: "var(--font-dm-serif)" }}
        className="text-4xl sm:text-5xl lg:text-[58px] text-center text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em] max-w-2xl transition-colors duration-300"
      >
        Your reminders are scattered everywhere.
      </motion.h2>

      {/* Scatter icons */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex items-end gap-4 mt-12 mb-10"
      >
        {ICONS.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.7, rotate: item.rotate - 10 }}
            whileInView={{ opacity: 1, scale: 1, rotate: item.rotate }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-300"
              style={{
                background: colors[i].bg,
                border: `1px solid ${colors[i].border}`,
                boxShadow: `0 4px 20px ${colors[i].shadow}`,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke={item.stroke}>
                {item.path}
              </svg>
            </div>
            <span
              style={{ fontFamily: "var(--font-dm-sans)" }}
              className="text-[10px] font-medium text-slate-400 dark:text-slate-500 transition-colors duration-300"
            >
              {item.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* Body */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontFamily: "var(--font-dm-sans)" }}
        className="text-lg sm:text-xl text-slate-500 dark:text-slate-400 text-center leading-relaxed max-w-xl transition-colors duration-300"
      >
        Emails, texts, push notifications, calendar pings, sticky notes.
        The one that mattered always slips through.
        <span className="text-slate-800 dark:text-slate-200 font-medium"> And sometimes a late fee follows.</span>
      </motion.p>
    </section>
  );
}
