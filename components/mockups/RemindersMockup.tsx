"use client";

const reminders = [
  { label: "Rent",        sub: "Monthly · 1st",  color: "#22c55e" },
  { label: "Insurance",   sub: "Monthly · 1st",  color: "#a855f7" },
  { label: "Internet",    sub: "Monthly · 5th",  color: "#3b82f6" },
  { label: "EMI",         sub: "Monthly · 1st",  color: "#f59e0b" },
  { label: "Credit Card", sub: "Monthly · 15th", color: "#0f172a" },
  { label: "School fee",  sub: "Monthly · 1st",  color: "#6366f1" },
];

export default function RemindersMockup() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl p-5"
      style={{
        background: "white",
        boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        {reminders.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5 rounded-xl px-3 py-3"
            style={{ background: "#f8fafc" }}
          >
            <div
              className="w-1 h-8 rounded-full flex-shrink-0"
              style={{ background: r.color }}
            />
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] font-semibold text-slate-800 leading-tight">
                {r.label}
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] text-slate-400 leading-tight mt-0.5">
                {r.sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
