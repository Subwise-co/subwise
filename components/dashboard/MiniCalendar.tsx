"use client";

import { useMemo, useState } from "react";
import { format, getDaysInMonth, startOfMonth, getDay, parseISO, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Subscription } from "@/lib/hooks/useProfile";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type EventType = "recurring" | "onetime" | "trial" | "cancelled";
const TYPE_META: Record<EventType, { color: string; label: string }> = {
  recurring: { color: "#6366f1", label: "Subscription / auto-pay" },
  onetime: { color: "#8b5cf6", label: "One-time payment" },
  trial: { color: "#f59e0b", label: "Trial ending" },
  cancelled: { color: "#94a3b8", label: "Cancelled / ended" },
};

function eventType(s: Subscription): EventType | null {
  if (s.status === "cancelled" || s.status === "expired") return "cancelled";
  if (s.kind === "one_time") return "onetime";
  if (s.kind === "trial") return s.status === "active" ? "trial" : null;
  if (s.status === "active") return "recurring";
  return null;
}

// Compact current-month calendar with all payment events marked by colored dots.
export default function MiniCalendar({ subs, currency = "INR" }: { subs: Subscription[]; currency?: string }) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const daysInMonth = getDaysInMonth(now);
  const leadingBlanks = getDay(monthStart);
  const today = now.getDate();
  const [selected, setSelected] = useState<number | null>(today);

  const byDay = useMemo(() => {
    const map: Record<number, { type: EventType; color: string; name: string; amount: number }[]> = {};
    for (const s of subs) {
      const type = eventType(s);
      if (!type || !s.next_billing_date) continue;
      let d: Date;
      try {
        d = parseISO(s.next_billing_date);
      } catch {
        continue;
      }
      // Monthly recurring repeats on its day every month; everything else only lands in its own month.
      const repeatsMonthly = type === "recurring" && s.billing_cycle === "monthly";
      if (!repeatsMonthly && !isSameMonth(d, now)) continue;
      const day = d.getDate();
      (map[day] = map[day] || []).push({ type, color: TYPE_META[type].color, name: s.service_name, amount: s.amount });
    }
    return map;
  }, [subs]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const selectedItems = selected ? byDay[selected] || [] : [];
  const usedTypes = new Set<EventType>();
  Object.values(byDay).forEach((arr) => arr.forEach((e) => usedTypes.add(e.type)));

  return (
    <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">{format(now, "MMMM yyyy")}</h2>
        <span className="text-[11px] text-slate-400">{Object.keys(byDay).length} payment days</span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[10px] font-medium text-slate-400 py-1">{w}</span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`b${i}`} />;
          const events = byDay[day] || [];
          const isToday = day === today;
          const isSel = day === selected;
          // up to 3 distinct-colored dots
          const dotColors = [...new Set(events.map((e) => e.color))].slice(0, 3);
          return (
            <button
              key={day}
              onClick={() => setSelected(day)}
              className={cn(
                "relative aspect-square rounded-lg text-xs flex items-center justify-center transition-colors",
                isSel
                  ? "bg-indigo-600 text-white font-semibold"
                  : events.length
                    ? "text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04]",
                isToday && !isSel && "ring-1 ring-indigo-400"
              )}
            >
              {day}
              {!isSel && dotColors.length > 0 && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {dotColors.map((c, j) => (
                    <span key={j} className="w-1 h-1 rounded-full" style={{ background: c }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {usedTypes.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {([...usedTypes] as EventType[]).map((t) => (
            <span key={t} className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_META[t].color }} />
              {TYPE_META[t].label}
            </span>
          ))}
        </div>
      )}

      {/* Selected-day detail */}
      <div className="mt-3 border-t border-slate-100 dark:border-white/[0.06] pt-3 min-h-[44px]">
        {selectedItems.length ? (
          <div className="space-y-1.5">
            {selectedItems.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: it.color }} />
                  {it.name}
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{formatMoney(it.amount, currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            {selected ? `Nothing on ${format(now, "MMM")} ${selected}` : "Select a day"}
          </p>
        )}
      </div>
    </div>
  );
}
