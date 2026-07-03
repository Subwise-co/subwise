"use client";

import dynamic from "next/dynamic";
import posthog from "posthog-js";
import { useProfile } from "@/lib/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { RefreshCw, CreditCard, Wallet, CalendarClock, Bell, Mail, Loader2, MessageCircle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { runScan } from "@/lib/scan-client";
import { useMemo, useState, useEffect } from "react";
import { format, parseISO, isToday, isTomorrow, isThisWeek, isSameMonth, addMonths, addDays, startOfMonth } from "date-fns";

const CategoryDonut = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => m.CategoryDonut),
  { ssr: false, loading: () => <div className="h-32 animate-pulse bg-slate-100 dark:bg-white/5 rounded-lg" /> }
);
const MonthlyTrend = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => m.MonthlyTrend),
  { ssr: false, loading: () => <div className="h-36 animate-pulse bg-slate-100 dark:bg-white/5 rounded-lg" /> }
);
const CategoryBars = dynamic(
  () => import("@/components/dashboard/DashboardCharts").then((m) => m.CategoryBars),
  { ssr: false, loading: () => <div className="h-40 animate-pulse bg-slate-100 dark:bg-white/5 rounded-lg" /> }
);
const MiniCalendar = dynamic(() => import("@/components/dashboard/MiniCalendar"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-slate-100 dark:bg-white/5 rounded-xl" />,
});

function monthlyEq(s: { amount: number; billing_cycle: string; kind?: string }) {
  // A mandate authorizes "up to ₹X" (usage-based) — the guaranteed monthly charge is unknown, so it
  // doesn't count toward "what you definitely pay each month".
  if (s.kind === "mandate") return 0;
  if (s.billing_cycle === "annual") return s.amount / 12;
  if (s.billing_cycle === "weekly") return s.amount * 4.345;
  return s.amount;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  );
}

function TimelineGroup({
  label,
  items,
  currency,
  dot = "#6366f1",
}: {
  label: string;
  items: { name: string; amount: number; date: string }[];
  currency: string;
  dot?: string;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        {label}
      </p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.name}</p>
                <p className="text-xs text-slate-400">{item.date ? format(parseISO(item.date), "MMM d") : "—"}</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {formatMoney(item.amount, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A compact card listing payments of one kind (upcoming / recent / cancelled), color-dotted.
function PaymentTable({
  title,
  items,
  dot,
  empty,
  currency,
}: {
  title: string;
  items: { name: string; amount: number; date: string | null }[];
  dot: string;
  empty: string;
  currency: string;
}) {
  return (
    <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
          {title}
        </h2>
        {items.length > 0 && <span className="text-[11px] text-slate-400">{items.length}</span>}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">{empty}</p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 5).map((it, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{it.name}</p>
                <p className="text-[11px] text-slate-400">{it.date ? format(parseISO(it.date), "MMM d") : "—"}</p>
              </div>
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0 ml-2">
                {formatMoney(it.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useProfile();
  const qc = useQueryClient();
  const [reminderDays, setReminderDays] = useState("3");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ name: string; kind: string }[] | null>(null);

  const currency = data?.profile?.display_currency || "INR";
  const whatsappOptedIn = !!data?.profile?.whatsapp_opted_in;
  const whatsappNumber = data?.profile?.whatsapp_number ?? null;
  // Three states: connected (replied YES) · pending (number saved, awaiting YES) · not connected.
  const whatsappPending = !whatsappOptedIn && !!whatsappNumber;

  // keep the dropdown in sync with the persisted default
  useEffect(() => {
    if (data?.profile?.default_reminder_days) setReminderDays(String(data.profile.default_reminder_days));
  }, [data?.profile?.default_reminder_days]);

  // Keep the WhatsApp connection status fresh while a number is on file (connected OR pending), so the
  // card reflects out-of-band changes on WhatsApp without a manual refresh: an inbound YES flips it to
  // Connected, and a STOP/disconnect flips it back to "Reply YES to confirm". (Polling only while a
  // number exists; stops when there's none.)
  useEffect(() => {
    if (!whatsappNumber) return;
    const id = setInterval(() => qc.invalidateQueries({ queryKey: ["profile"] }), 12000);
    return () => clearInterval(id);
  }, [whatsappNumber, qc]);

  const allSubs = data?.subscriptions ?? [];
  const active = useMemo(
    () => allSubs.filter((s) => s.status === "active" && s.kind !== "one_time"),
    [allSubs]
  );
  const oneTime = useMemo(() => allSubs.filter((s) => s.kind === "one_time"), [allSubs]);

  const totalRecurring = useMemo(() => active.reduce((s, x) => s + monthlyEq(x), 0), [active]);

  const oneTimeThisMonth = useMemo(
    () =>
      oneTime
        .filter((s) => s.next_billing_date && isSameMonth(parseISO(s.next_billing_date), new Date()))
        .reduce((s, x) => s + x.amount, 0),
    [oneTime]
  );

  const upcoming = useMemo(() => {
    // "Upcoming" = the NEXT 30 DAYS only. next_billing_date is already rolled forward to today-or-later by the
    // API, so this drops far-future renewals like an annual plan due in ~9 months (Udemy, Apr 2027) while
    // keeping this month's SIPs/bills. (`later` here means "within 30 days, beyond this week", not "someday".)
    const t0 = new Date();
    t0.setHours(0, 0, 0, 0);
    const horizon = addDays(t0, 30);
    const arr = active
      .filter((s) => s.next_billing_date)
      .map((s) => ({ name: s.service_name, amount: s.amount, date: s.next_billing_date! }))
      .filter((x) => {
        const d = parseISO(x.date);
        return d >= t0 && d <= horizon;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
    const today: typeof arr = [], tomorrow: typeof arr = [], thisWeek: typeof arr = [], later: typeof arr = [];
    for (const item of arr) {
      const d = parseISO(item.date);
      if (isToday(d)) today.push(item);
      else if (isTomorrow(d)) tomorrow.push(item);
      else if (isThisWeek(d, { weekStartsOn: 1 })) thisWeek.push(item);
      else later.push(item);
    }
    return { today, tomorrow, thisWeek, later };
  }, [active]);

  const upcomingFlat = useMemo(
    () => [...upcoming.today, ...upcoming.tomorrow, ...upcoming.thisWeek, ...upcoming.later],
    [upcoming]
  );

  const upcomingThisWeekTotal = useMemo(
    () => [...upcoming.today, ...upcoming.tomorrow, ...upcoming.thisWeek].reduce((s, x) => s + x.amount, 0),
    [upcoming]
  );

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const s of active) {
      const cat = s.category ?? "Other";
      cats[cat] = (cats[cat] ?? 0) + monthlyEq(s);
    }
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [active]);

  // Top recurring commitments by monthly-equivalent — a distinct, actionable view (not category/trend).
  const biggest = useMemo(
    () =>
      active
        .map((s) => ({ name: s.service_name, value: Math.round(monthlyEq(s)) }))
        .filter((x) => x.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    [active]
  );

  // Recent one-time payments (made) + cancelled/ended — to round out the timeline beyond "upcoming".
  const recentPaid = useMemo(
    () =>
      oneTime
        .filter((s) => s.next_billing_date)
        .map((s) => ({ name: s.service_name, amount: s.amount, date: s.next_billing_date! }))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 3),
    [oneTime]
  );
  const cancelledItems = useMemo(
    () =>
      allSubs
        .filter((s) => s.status === "cancelled" || s.status === "expired")
        .map((s) => ({ name: s.service_name, amount: s.amount, date: s.next_billing_date || s.created_at })),
    [allSubs]
  );

  // Spend trend: real past snapshots, then a forward projection of the monthly run-rate (so the chart
  // always has shape, even with one month of history).
  const trendData = useMemo(() => {
    const past = (data?.snapshots ?? []).slice(-3).map((s) => ({
      month: format(parseISO(s.month), "MMM"),
      amount: Math.round(s.total_spend),
    }));
    const proj = Array.from({ length: 6 }, (_, i) => ({
      month: format(addMonths(startOfMonth(new Date()), i), "MMM"),
      amount: Math.round(totalRecurring),
      projected: true,
    }));
    // de-dupe a past month that equals the current label
    const seen = new Set(past.map((p) => p.month));
    return [...past, ...proj.filter((p) => !seen.has(p.month))];
  }, [data?.snapshots, totalRecurring]);

  async function saveReminderDefault(val: string) {
    setReminderDays(val);
    await fetch("/api/profile/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: parseInt(val) }),
    });
    posthog.capture("reminder_default_changed", { days: parseInt(val) });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function handleScan() {
    if (scanning) return;
    setScanning(true);
    setScanResult(null);
    posthog.capture("gmail_scan_started", { source: "dashboard" });
    const before = new Set((data?.subscriptions ?? []).map((s) => s.id));
    await runScan();
    // Diff against the pre-scan list so we can tell the user exactly what changed.
    let added: { name: string; kind: string }[] = [];
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const fresh = await res.json();
        added = (fresh.subscriptions ?? [])
          .filter((s: { id: string }) => !before.has(s.id))
          .map((s: { service_name: string; kind: string }) => ({ name: s.service_name, kind: s.kind }));
      }
    } catch {
      /* ignore — UI still refreshes below */
    }
    posthog.capture("gmail_scan_completed", { new_items_found: added.length, source: "dashboard" });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setScanning(false);
    setScanResult(added);
    setTimeout(() => setScanResult(null), 6000);
  }

  function kindWord(kind: string) {
    if (kind === "mandate") return "auto-pay";
    if (kind === "trial") return "trial";
    if (kind === "one_time") return "one-time";
    return "subscription";
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0] ?? data?.profile?.name?.split(" ")[0] ?? "there";
  const gmailConnected = data?.profile?.gmail_connected;

  // A light, FACT-ONLY personalized line (no invented facts — only verified totals/counts).
  const dueThisWeekCount = upcoming.today.length + upcoming.tomorrow.length + upcoming.thisWeek.length;
  const greetingLine =
    active.length === 0
      ? "It's quiet here — connect Gmail or add a payment and I'll start watching your money."
      : dueThisWeekCount > 0
        ? `You're tracking ${formatMoney(totalRecurring, currency)}/mo across ${active.length} payments — ${dueThisWeekCount} due this week. I've got the rest. 🫡`
        : `You're tracking ${formatMoney(totalRecurring, currency)}/mo across ${active.length} payments — nothing due this week. Breathe easy. 🌤️`;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Scan result toast */}
      {scanResult && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]">
          <div className="flex items-start gap-3 rounded-xl bg-white dark:bg-[#15151f] border border-slate-200 dark:border-white/10 shadow-xl px-4 py-3">
            <CheckCircle2 size={18} className={scanResult.length ? "text-indigo-500 mt-0.5" : "text-emerald-500 mt-0.5"} />
            <div className="flex-1 text-sm">
              {scanResult.length === 0 ? (
                <p className="text-slate-700 dark:text-slate-200 font-medium">No new payments found — you're all caught up.</p>
              ) : (
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Added {scanResult.length} new {scanResult.length > 1 ? "items" : "item"}:</span>{" "}
                  {scanResult.slice(0, 3).map((s, i) => (
                    <span key={i}>
                      {i > 0 ? ", " : ""}
                      {s.name} <span className="text-slate-400">({kindWord(s.kind)})</span>
                    </span>
                  ))}
                  {scanResult.length > 3 ? ` +${scanResult.length - 3} more` : ""}
                </p>
              )}
            </div>
            <button onClick={() => setScanResult(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Hi {firstName} 👋</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{greetingLine}</p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning || !gmailConnected}
          title={gmailConnected ? "Scan Gmail for new payments" : "Connect Gmail to scan"}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all",
            "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.97] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
          {scanning ? "Scanning…" : "Scan Gmail"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={RefreshCw}
          label="Recurring / month"
          value={formatMoney(totalRecurring, currency)}
          sub={`${active.length} active commitments`}
          color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400"
        />
        <KpiCard
          icon={CreditCard}
          label="One-Time (this month)"
          value={formatMoney(oneTimeThisMonth, currency)}
          sub={oneTime.length ? `${oneTime.length} payments tracked` : "No one-time payments yet"}
          color="bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
        />
        <KpiCard
          icon={Wallet}
          label="Total Financial Load"
          value={formatMoney(totalRecurring + oneTimeThisMonth, currency)}
          sub={
            data?.profile?.monthly_budget
              ? `${Math.round(((totalRecurring + oneTimeThisMonth) / data.profile.monthly_budget) * 100)}% of budget`
              : "No budget set"
          }
          color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          icon={CalendarClock}
          label="Due This Week"
          value={formatMoney(upcomingThisWeekTotal, currency)}
          sub={`${upcoming.today.length + upcoming.tomorrow.length + upcoming.thisWeek.length} payments`}
          color="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: calendar */}
        <div className="lg:col-span-1">
          <MiniCalendar subs={allSubs} currency={currency} />
        </div>

        {/* Right: charts + reminder + WhatsApp status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">By Category</h2>
              <CategoryDonut data={categoryData} currency={currency} />
            </div>
            <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Spend Forecast</h2>
              <MonthlyTrend data={trendData} currency={currency} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Global Reminder Preference */}
            <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-indigo-500" />
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-white">Reminder default</h2>
                </div>
                <Select value={reminderDays} onValueChange={saveReminderDefault}>
                  <SelectTrigger className="w-28 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day before</SelectItem>
                    <SelectItem value="3">3 days before</SelectItem>
                    <SelectItem value="7">7 days before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                WhatsApp reminders sent {reminderDays} day(s) before each due date.
              </p>
            </div>

            {/* WhatsApp connection status */}
            <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center", whatsappOptedIn ? "bg-emerald-50 dark:bg-emerald-900/20" : whatsappPending ? "bg-amber-50 dark:bg-amber-900/20" : "bg-slate-100 dark:bg-white/[0.06]")}>
                  <MessageCircle size={16} className={whatsappOptedIn ? "text-emerald-600" : whatsappPending ? "text-amber-600" : "text-slate-400"} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">WhatsApp</p>
                  <p className="text-xs text-slate-400">
                    {whatsappOptedIn
                      ? `Connected · +91 ${whatsappNumber}`
                      : whatsappPending
                        ? `Reply YES to confirm · +91 ${whatsappNumber}`
                        : "Not connected"}
                  </p>
                </div>
              </div>
              {!whatsappOptedIn && (
                <Link href="/settings" className="text-xs font-medium text-indigo-600 hover:underline">
                  {whatsappPending ? "Manage" : "Connect"}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Three small payment tables — levels the page */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <PaymentTable title="Upcoming payments" items={upcomingFlat} dot="#6366f1" empty="Nothing upcoming" currency={currency} />
        <PaymentTable title="Recent payments" items={recentPaid} dot="#8b5cf6" empty="No recent payments" currency={currency} />
        <PaymentTable title="Cancelled plans" items={cancelledItems} dot="#94a3b8" empty="Nothing cancelled" currency={currency} />
      </div>
    </div>
  );
}
