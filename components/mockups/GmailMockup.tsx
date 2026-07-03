"use client";

const subscriptions = [
  { initial: "N", color: "#E50914", bg: "#fff0f0", name: "Netflix", detail: "Your monthly receipt", amount: "₹649" },
  { initial: "S", color: "#1DB954", bg: "#f0fdf4", name: "Spotify", detail: "Premium renewed", amount: "₹119" },
  { initial: "C", color: "#10a37f", bg: "#f0fdf9", name: "ChatGPT", detail: "Plus subscription", amount: "₹1,699" },
];

export default function GmailMockup() {
  return (
    <div
      className="w-full max-w-sm rounded-2xl overflow-hidden"
      style={{
        background: "white",
        boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.04)",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-sm font-semibold text-slate-700">
          Inbox · Subscriptions detected
        </span>
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "#dcfce7", color: "#16a34a", fontFamily: "var(--font-dm-sans)" }}
        >
          +3 new
        </span>
      </div>

      {/* Subscription rows */}
      <div className="divide-y divide-slate-50">
        {subscriptions.map((s) => (
          <div key={s.name} className="flex items-center gap-3.5 px-5 py-3.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: s.bg }}
            >
              <span style={{ color: s.color, fontFamily: "var(--font-dm-sans)" }} className="text-sm font-bold">
                {s.initial}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-sm font-semibold text-slate-800 leading-tight">
                {s.name}
              </p>
              <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-xs text-slate-400 leading-tight mt-0.5">
                {s.detail}
              </p>
            </div>
            <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-sm font-bold text-slate-700 flex-shrink-0">
              {s.amount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
