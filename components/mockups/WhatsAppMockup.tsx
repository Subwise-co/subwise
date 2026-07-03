"use client";

export default function WhatsAppMockup() {
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
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ background: "#075E54" }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#25D366" }}
        >
          <span style={{ fontFamily: "var(--font-dm-sans)" }} className="text-sm font-bold text-white">W</span>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-sm font-semibold text-white leading-tight">
            Subwise
          </p>
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] text-green-200 leading-tight">
            today
          </p>
        </div>
      </div>

      {/* Chat area */}
      <div
        className="px-4 py-5 flex flex-col gap-3"
        style={{ background: "#ECE5DD", minHeight: "180px" }}
      >
        {/* Message 1 */}
        <div
          className="self-start rounded-xl rounded-tl-sm px-4 py-2.5 max-w-[85%]"
          style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-800 leading-snug">
            Spotify renews tomorrow — ₹119
          </p>
        </div>

        {/* Message 2 */}
        <div
          className="self-start rounded-xl rounded-tl-sm px-4 py-2.5 max-w-[85%]"
          style={{ background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[13px] text-slate-800 leading-snug">
            Rent due in 3 days — ₹22,000
          </p>
        </div>

        {/* Hint */}
        <div
          className="self-start mt-1 rounded-lg px-3 py-1.5"
          style={{ background: "rgba(0,0,0,0.08)" }}
        >
          <p style={{ fontFamily: "var(--font-dm-sans)" }} className="text-[11px] text-slate-600">
            Reply <span className="font-semibold">&apos;pause&apos;</span> to snooze a reminder
          </p>
        </div>
      </div>
    </div>
  );
}
