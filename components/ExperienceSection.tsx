"use client";

import { motion } from "framer-motion";
import { useTheme } from "./ThemeProvider";

// ── Shared card wrapper ────────────────────────────────────────
function Card({
  children,
  className = "",
  glowColor = "rgba(124,58,237,0.5)",
  glowSpread = "rgba(124,58,237,0.08)",
  dark = false,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  glowSpread?: string;
  dark?: boolean;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        y: -4,
        boxShadow: `0 0 0 1.5px ${glowColor}, 0 12px 40px ${glowSpread}`,
        transition: { duration: 0.2 },
      }}
      className={`rounded-2xl p-5 transition-colors duration-300 ${
        dark
          ? "bg-[#0d0d1e] dark:bg-[#080810]"
          : "bg-white dark:bg-white/[0.04]"
      } border ${
        dark
          ? "border-white/[0.08]"
          : "border-black/[0.06] dark:border-white/[0.08]"
      } ${className}`}
      style={{
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Upcoming Payments card ─────────────────────────────────────
const upcomingItems = [
  {
    name: "Netflix",
    amount: "₹649",
    days: "2d",
    iconBg: "#fee2e2",
    iconDarkBg: "rgba(239,68,68,0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <polygon points="5,3 19,12 5,21" fill="#ef4444" />
      </svg>
    ),
  },
  {
    name: "Spotify",
    amount: "₹119",
    days: "4d",
    iconBg: "#dcfce7",
    iconDarkBg: "rgba(34,197,94,0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <circle cx="12" cy="12" r="9" fill="#22c55e" />
        <path d="M8 9.5c2.5-.8 5.5-.5 7.5 1M8 12c2-.6 4.5-.3 6.5.8M8 14.5c1.5-.4 3.5-.2 5 .5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Electricity",
    amount: "₹1,250",
    days: "5d",
    iconBg: "#fef9c3",
    iconDarkBg: "rgba(234,179,8,0.15)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" fill="#eab308" />
      </svg>
    ),
  },
];

function UpcomingPayments() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Card delay={0} glowColor="rgba(124,58,237,0.45)" glowSpread="rgba(124,58,237,0.10)" className="h-full">
      <div className="flex items-center justify-between mb-5">
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
          Upcoming Payments
        </span>
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1 rounded-full">
          This week
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {upcomingItems.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.06]"
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
              style={{ background: isDark ? item.iconDarkBg : item.iconBg }}
            >
              {item.icon}
            </div>
            <span style={{ fontFamily: "var(--font-dm-sans)" }} className="flex-1 text-[13px] font-medium text-slate-700 dark:text-slate-300">
              {item.name}
            </span>
            <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-900 dark:text-white">
              {item.amount}
            </span>
            <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full ml-1 min-w-[28px] text-center">
              {item.days}
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

// ── Monthly Spend card ─────────────────────────────────────────
function MonthlySpend() {
  return (
    <Card
      delay={0.08}
      glowColor="rgba(16,185,129,0.5)"
      glowSpread="rgba(16,185,129,0.10)"
      className="h-full flex flex-col justify-between"
    >
      <div>
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase">
          Monthly Spend
        </span>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white leading-none mt-3 tracking-tight">
            ₹22,487
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-500 dark:text-slate-400 mt-2 leading-snug">
            across <span className="text-slate-900 dark:text-white font-semibold">18</span> recurring commitments
          </p>
        </motion.div>
      </div>

      <div className="mt-6 pt-4 border-t border-black/[0.06] dark:border-white/[0.08]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            On track this month
          </span>
        </div>
      </div>
    </Card>
  );
}

// ── Monthly Calendar card ──────────────────────────────────────
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
// June 2026 starts on Monday (index 1)
const JUNE_OFFSET = 1;
const JUNE_DAYS = 30;
// Payment dates → colors
const PAYMENT_DATES: Record<number, string> = {
  1:  "#6366f1", // broadband
  5:  "#a78bfa", // insurance
  9:  "#22c55e", // credit card
  15: "#ef4444", // netflix
  18: "#8b5cf6", // school
  22: "#f59e0b", // rent
  27: "#6366f1", // EMI
  30: "#f97316", // electricity
};

function CalendarCard() {
  const cells: (number | null)[] = [
    ...Array(JUNE_OFFSET).fill(null),
    ...Array.from({ length: JUNE_DAYS }, (_, i) => i + 1),
  ];

  return (
    <Card delay={0.14} glowColor="rgba(99,102,241,0.45)" glowSpread="rgba(99,102,241,0.10)" className="h-full">
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
          Monthly Calendar
        </span>
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] text-slate-400 dark:text-slate-500">
          June 2026
        </span>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d, i) => (
          <div key={i} style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[10px] font-medium text-slate-400 dark:text-slate-500 text-center py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          const color = day ? PAYMENT_DATES[day] : null;
          return (
            <div key={i} className="flex items-center justify-center aspect-square">
              {day && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center relative"
                  style={color ? { background: color + "22" } : {}}
                >
                  <span
                    style={{ fontFamily: "var(--font-dm-sans)", color: color ?? undefined }}
                    className={`text-[11px] font-medium leading-none ${color ? "font-semibold" : "text-slate-500 dark:text-slate-500"}`}
                  >
                    {day}
                  </span>
                  {color && (
                    <div
                      className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ background: color }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Recurring Expenses bar chart ───────────────────────────────
const BAR_DATA = [
  { label: "Jan", h: 42 },
  { label: "Feb", h: 36 },
  { label: "Mar", h: 54 },
  { label: "Apr", h: 48 },
  { label: "May", h: 63 },
  { label: "Jun", h: 82 },
  { label: "Jul", h: 37 },
  { label: "Aug", h: 51 },
  { label: "Sep", h: 45 },
  { label: "Oct", h: 60 },
  { label: "Nov", h: 49 },
  { label: "Dec", h: 41 },
];

const CURRENT_MONTH = 5; // June (0-indexed)

const CATEGORY_STATS = [
  { label: "Subscriptions", amount: "₹1,437" },
  { label: "Bills", amount: "₹8,550" },
  { label: "Commitments", amount: "₹12,500" },
];

function RecurringExpenses() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Card delay={0.20} glowColor="rgba(99,102,241,0.45)" glowSpread="rgba(99,102,241,0.10)" className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-800 dark:text-white/90">
          Recurring Expenses
        </span>
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full flex items-center gap-1">
          <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
            <path d="M2 7l3-3 2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All scheduled
        </span>
      </div>

      {/* Single-bar chart — rounded pill tops, current month highlighted */}
      <div className="flex items-end gap-1 h-24">
        {BAR_DATA.map((bar, i) => (
          <motion.div
            key={bar.label}
            initial={{ height: 0 }}
            whileInView={{ height: `${bar.h}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.04 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
            style={{
              borderRadius: "999px 999px 4px 4px",
              background: i === CURRENT_MONTH
                ? "#6366f1"
                : isDark
                ? "rgba(255,255,255,0.10)"
                : "#e2e8f0",
              flex: 1,
            }}
          />
        ))}
      </div>

      {/* Month labels */}
      <div className="flex items-center gap-1 mt-2">
        {BAR_DATA.map((bar, i) => (
          <div key={bar.label} className="flex-1 text-center">
            <span
              style={{ fontFamily: "var(--font-dm-sans)" }}
              className={`text-[9px] font-medium ${
                i === CURRENT_MONTH
                  ? "text-indigo-500 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-600"
              }`}
            >
              {bar.label}
            </span>
          </div>
        ))}
      </div>

      {/* Category breakdown stats */}
      <div className="flex items-stretch mt-4 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
        {CATEGORY_STATS.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex-1 ${
              i > 0
                ? "border-l border-black/[0.06] dark:border-white/[0.06] pl-3"
                : "pr-2"
            }`}
          >
            <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
              {stat.label}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-800 dark:text-white mt-0.5">
              {stat.amount}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Main section ───────────────────────────────────────────────
export default function ExperienceSection() {
  return (
    <section className="relative w-full bg-[#f7f7fc] dark:bg-[#04040c] py-24 px-6 overflow-hidden transition-colors duration-300">
      {/* Ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(99,102,241,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Section header */}
      <div className="max-w-5xl mx-auto text-center mb-14">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontFamily: "var(--font-dm-sans)" }}
          className="text-xs font-bold tracking-widest uppercase text-violet-600 dark:text-violet-400 mb-4 transition-colors duration-300"
        >
          The Experience
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontFamily: "var(--font-dm-serif)" }}
          className="text-4xl sm:text-5xl lg:text-[58px] text-slate-900 dark:text-white leading-[1.1] tracking-[-0.01em] transition-colors duration-300"
        >
          Every commitment,{" "}
          <br className="hidden sm:block" />
          beautifully in view.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontFamily: "var(--font-dm-sans)" }}
          className="mt-5 text-lg text-slate-500 dark:text-slate-400 max-w-xl mx-auto leading-relaxed transition-colors duration-300"
        >
          A calm, organized picture of your recurring financial life — and the
          reminders that keep it on track.
        </motion.p>
      </div>

      {/* Dashboard grid — asymmetric 5-col layout */}
      <div className="max-w-5xl mx-auto grid grid-cols-5 gap-4 auto-rows-auto">
        {/* Row 1: Upcoming (3 cols) | Monthly Spend (2 cols) */}
        <div className="col-span-5 sm:col-span-3">
          <UpcomingPayments />
        </div>
        <div className="col-span-5 sm:col-span-2">
          <MonthlySpend />
        </div>

        {/* Row 2: Calendar (2 cols) | Bar Chart (3 cols) */}
        <div className="col-span-5 sm:col-span-2">
          <CalendarCard />
        </div>
        <div className="col-span-5 sm:col-span-3">
          <RecurringExpenses />
        </div>
      </div>
    </section>
  );
}
