"use client";

import posthog from "posthog-js";
import { useProfile, type Subscription } from "@/lib/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  X,
  Check,
  ChevronDown,
  Trash2,
  Edit3,
  Bell,
  Mail,
  AlertCircle,
  ScanLine,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { runScan } from "@/lib/scan-client";
import { formatMoney } from "@/lib/format";

// Map the UI billing cycle to the backend recurrence_rule that validateCommitment understands.
function mapCycle(cycle: string) {
  if (cycle === "yearly") return "annual";
  return cycle; // weekly | monthly | quarterly
}

const CATEGORIES = [
  "Streaming",
  "Software",
  "Utilities",
  "Insurance",
  "Fitness",
  "Education",
  "Gaming",
  "Finance",
  "Food",
  "Other",
];

const commitmentSchema = z.object({
  service_name: z.string().min(1, "Name is required"),
  amount: z.coerce.number().min(1, "Amount must be > 0"),
  billing_cycle: z.enum(["monthly", "quarterly", "yearly", "weekly"]),
  next_billing_date: z.string().optional(),
  category: z.string().optional(),
  reminder_days: z.coerce.number().refine((v) => [1, 3, 7].includes(v), "Must be 1, 3, or 7"),
});

type CommitmentForm = z.infer<typeof commitmentSchema>;

// Display currency is set by the page each render (single-user client); fmt renders the right symbol.
let displayCurrency = "INR";
function fmt(n: number) {
  return formatMoney(n, displayCurrency);
}
// A mandate authorizes "up to ₹X" (usage-based) — show that, not a fixed amount.
function amountLabel(sub: Subscription) {
  return sub.kind === "mandate" ? `up to ${fmt(sub.amount)}` : fmt(sub.amount);
}

// Human label for each row so the user understands what it is at a glance.
function kindLabel(kind: string, status: string) {
  if (status === "pending") return "Needs confirmation";
  if (status === "cancelled") return "Cancelled";
  if (status === "expired") return "Expired";
  if (kind === "mandate") return "Auto-pay mandate";
  if (kind === "trial") return "Free trial";
  if (kind === "one_time") return "One-time payment";
  return "Subscription";
}

function statusColor(status: string) {
  if (status === "active") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400";
  if (status === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400";
  return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
}

function CommitmentCard({
  sub,
  onSelect,
}: {
  sub: Subscription;
  onSelect: (s: Subscription) => void;
}) {
  return (
    <button
      onClick={() => onSelect(sub)}
      className="w-full text-left bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4 hover:border-indigo-200 dark:hover:border-indigo-500/20 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {sub.service_name[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {sub.service_name}
            </p>
            <span
              className={cn(
                "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium capitalize",
                statusColor(sub.status)
              )}
            >
              {kindLabel(sub.kind, sub.status)}
            </span>
          </div>
        </div>
        <p className="text-base font-bold text-slate-900 dark:text-white">{amountLabel(sub)}</p>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="capitalize">{sub.billing_cycle}</span>
        <span>
          {sub.next_billing_date
            ? `Due ${format(parseISO(sub.next_billing_date), "MMM d")}`
            : "No date set"}
        </span>
      </div>
      {sub.category && (
        <div className="mt-2">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-[10px] text-slate-500 dark:text-slate-400">
            {sub.category}
          </span>
        </div>
      )}
    </button>
  );
}

function CommitmentRow({
  sub,
  onSelect,
}: {
  sub: Subscription;
  onSelect: (s: Subscription) => void;
}) {
  return (
    <button
      onClick={() => onSelect(sub)}
      className="w-full text-left flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors border-b border-slate-50 dark:border-white/[0.04] last:border-0"
    >
      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
          {sub.service_name[0].toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
          {sub.service_name}
        </p>
        <p className="text-xs text-slate-400 capitalize">{sub.billing_cycle}</p>
      </div>
      {sub.category && (
        <span className="text-xs text-slate-400 hidden sm:block">{sub.category}</span>
      )}
      <span
        className={cn(
          "px-2 py-0.5 rounded text-[10px] font-medium capitalize hidden sm:block",
          statusColor(sub.status)
        )}
      >
        {kindLabel(sub.kind, sub.status)}
      </span>
      <span className="text-xs text-slate-500 hidden md:block">
        {sub.next_billing_date
          ? format(parseISO(sub.next_billing_date), "MMM d")
          : "—"}
      </span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 ml-auto shrink-0">
        {amountLabel(sub)}
      </span>
    </button>
  );
}

export default function CommitmentsPage() {
  const { data, isLoading } = useProfile();
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"active" | "cancelled">("active");
  const [filterCat, setFilterCat] = useState("all");
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done">("idle");
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CommitmentForm>({
    resolver: zodResolver(commitmentSchema),
    defaultValues: { billing_cycle: "monthly", reminder_days: 3 },
  });
  const reminderChoice = watch("reminder_days");

  displayCurrency = data?.profile?.display_currency || "INR";
  // Recurring tab shows recurring commitments only — one-time payments live on their own page.
  const allSubs = (data?.subscriptions ?? []).filter((s) => s.kind !== "one_time");
  const pending = allSubs.filter((s) => s.status === "pending");

  const filtered = useMemo(() => {
    return allSubs.filter((s) => {
      const matchSearch = s.service_name.toLowerCase().includes(search.toLowerCase());
      // Two views: Active (live subscriptions + active trials) and Cancelled/Paused (ended/expired).
      // Pending detections live in the confirm banner above, not in either grid.
      const matchStatus =
        filterStatus === "active"
          ? s.status === "active"
          : s.status === "cancelled" || s.status === "expired";
      const matchCat = filterCat === "all" || s.category === filterCat;
      return matchSearch && matchStatus && matchCat;
    });
  }, [allSubs, search, filterStatus, filterCat]);

  const totalActive = useMemo(
    () =>
      // Monthly-equivalent of active recurring charges: annual ÷ 12, weekly × 4.345. Exclude mandate caps
      // ("up to ₹X", usage-based) and trials (no money charged yet) — they aren't a guaranteed monthly cost.
      allSubs
        .filter((s) => s.status === "active" && s.kind !== "mandate" && s.kind !== "trial")
        .reduce((acc, s) => {
          const amt = s.amount || 0;
          if (s.billing_cycle === "annual") return acc + amt / 12;
          if (s.billing_cycle === "weekly") return acc + amt * 4.345;
          return acc + amt;
        }, 0),
    [allSubs]
  );

  async function startScan() {
    setScanStatus("scanning");
    posthog.capture("gmail_scan_started", { source: "commitments" });
    // Drive the scan job batch-by-batch (works without the WhatsApp worker), refreshing as it goes.
    await runScan({
      onBatch: () => qc.invalidateQueries({ queryKey: ["profile"] }),
    });
    setScanStatus("done");
    posthog.capture("gmail_scan_completed", { source: "commitments" });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function confirmItem(id: string, action: "confirm" | "reject") {
    const sub = allSubs.find((s) => s.id === id);
    await fetch("/api/subscriptions/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: action === "confirm" ? "confirmed" : "rejected" }),
    });
    if (action === "confirm") {
      posthog.capture("subscription_confirmed", {
        service_name: sub?.service_name,
        amount: sub?.amount,
        billing_cycle: sub?.billing_cycle,
        category: sub?.category,
      });
    } else {
      posthog.capture("subscription_rejected", { service_name: sub?.service_name });
    }
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function deleteItem(id: string) {
    posthog.capture("subscription_deleted", { service_name: selected?.service_name });
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    setSelected(null);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function updateReminder(id: string, days: number) {
    // Optimistically reflect the choice in the open drawer right away — the drawer renders from the
    // local `selected` snapshot, so without this the highlight wouldn't move until it's reopened.
    setSelected((prev) => (prev && prev.id === id ? { ...prev, reminder_days: days } : prev));
    await fetch("/api/subscriptions/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reminder_days: days }),
    });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function onAddSubmit(values: CommitmentForm) {
    await fetch("/api/subscriptions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_name: values.service_name,
        title: values.service_name,
        amount: values.amount,
        category: values.category || undefined,
        next_charge_date: values.next_billing_date,
        recurrence_rule: mapCycle(values.billing_cycle),
        reminder_days: values.reminder_days,
      }),
    });
    posthog.capture("subscription_added_manually", {
      service_name: values.service_name,
      amount: values.amount,
      billing_cycle: values.billing_cycle,
      category: values.category,
    });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setAddOpen(false);
    reset();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Recurring Commitments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {allSubs.filter((s) => s.status === "active").length} active ·{" "}
            <span className="font-medium text-slate-700 dark:text-slate-300">
              ₹{Math.round(totalActive).toLocaleString("en-IN")}/mo
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startScan}
            disabled={scanStatus === "scanning"}
            className="gap-1.5 text-xs"
          >
            {scanStatus === "scanning" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Mail size={13} />
            )}
            {scanStatus === "scanning" ? "Scanning…" : "Scan Gmail"}
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus size={13} />
            Add Commitment
          </Button>
        </div>
      </div>

      {/* Pending Gmail detections */}
      {pending.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={15} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
              {pending.length} item{pending.length > 1 ? "s" : ""} detected from Gmail — confirm or skip
            </p>
          </div>
          <div className="space-y-2">
            {pending.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between bg-white dark:bg-[#1a1a2a] rounded-lg px-3 py-2.5 border border-amber-100 dark:border-amber-500/10"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {s.service_name}
                  </p>
                  <p className="text-xs text-slate-400">{fmt(s.amount)} · {s.billing_cycle}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => confirmItem(s.id, "confirm")}
                    className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center hover:bg-emerald-200 transition-colors"
                  >
                    <Check size={13} />
                  </button>
                  <button
                    onClick={() => confirmItem(s.id, "reject")}
                    className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center hover:bg-red-200 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters + View toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search commitments…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        {/* Two simple views: Active (default) and Cancelled/Paused. */}
        <div className="inline-flex h-9 rounded-lg border border-slate-200 dark:border-white/[0.08] overflow-hidden">
          {([
            { key: "active", label: "Active" },
            { key: "cancelled", label: "Cancelled / Paused" },
          ] as const).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilterStatus(opt.key)}
              className={cn(
                "px-3 text-xs font-medium transition-colors",
                filterStatus === opt.key
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-36 h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "p-2 transition-colors",
              view === "grid"
                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setView("list")}
            className={cn(
              "p-2 transition-colors",
              view === "list"
                ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            )}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <RefreshCw size={32} className="text-slate-200 dark:text-slate-700" />
          <p className="text-sm font-medium text-slate-500">No commitments found</p>
          <p className="text-xs text-slate-400">Add one manually or scan your Gmail inbox</p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <CommitmentCard key={s.id} sub={s} onSelect={setSelected} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl overflow-hidden">
          {filtered.map((s) => (
            <CommitmentRow key={s.id} sub={s} onSelect={setSelected} />
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 bg-black/30 backdrop-blur-sm" />
          <div
            className="w-full max-w-sm bg-white dark:bg-[#0f0f1a] h-full overflow-y-auto shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {selected.service_name}
              </h2>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-indigo-50 dark:bg-indigo-900/10 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                  {amountLabel(selected)}
                </p>
                <p className="text-sm text-indigo-500 capitalize mt-1">{selected.billing_cycle}</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "Type", value: kindLabel(selected.kind, selected.status) },
                  { label: "Category", value: selected.category ?? "—" },
                  {
                    label: "Next Due",
                    value: selected.next_billing_date
                      ? format(parseISO(selected.next_billing_date), "MMMM d, yyyy")
                      : "—",
                  },
                  { label: "Source", value: selected.source },
                  {
                    label: "Added",
                    value: format(parseISO(selected.created_at), "MMM d, yyyy"),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 capitalize">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs text-slate-500">Reminder Days</Label>
                <div className="flex gap-2">
                  {[1, 3, 7].map((d) => (
                    <button
                      key={d}
                      onClick={() => updateReminder(selected.id, d)}
                      className={cn(
                        "flex-1 py-2 text-xs font-medium rounded-lg border transition-colors",
                        selected.reminder_days === d
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                      )}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              {selected.source === "manual" && (
                <button
                  onClick={() => deleteItem(selected.id)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-red-200 dark:border-red-500/20 text-red-500 text-sm hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Commitment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Recurring Commitment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onAddSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Service Name</Label>
              <Input {...register("service_name")} placeholder="Netflix, Rent, etc." />
              {errors.service_name && (
                <p className="text-xs text-red-500">{errors.service_name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input {...register("amount")} type="number" placeholder="499" />
                {errors.amount && (
                  <p className="text-xs text-red-500">{errors.amount.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Billing Cycle</Label>
                <select
                  {...register("billing_cycle")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Next Due Date</Label>
                <Input {...register("next_billing_date")} type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select
                  {...register("category")}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                >
                  <option value="">None</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Remind me</Label>
              <div className="flex gap-2">
                {[1, 3, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue("reminder_days", d, { shouldValidate: true })}
                    className={cn(
                      "flex-1 py-2 text-xs font-medium rounded-lg border transition-colors",
                      Number(reminderChoice) === d
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                    )}
                  >
                    {d} day{d > 1 ? "s" : ""} before
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSubmitting ? "Adding…" : "Add Commitment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
