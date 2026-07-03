"use client";

import posthog from "posthog-js";
import { CreditCard, Plus, Receipt, Calendar, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useProfile } from "@/lib/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/format";
import { useMemo, useState } from "react";
import { parseISO, isSameMonth, format } from "date-fns";

const CATEGORIES = ["Finance", "Tech", "Maintenance", "Travel", "Health", "Shopping", "Food", "Other"];

export default function PaymentsPage() {
  const { data, isLoading } = useProfile();
  const qc = useQueryClient();
  const currency = data?.profile?.display_currency || "INR";

  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payments = useMemo(
    () =>
      (data?.subscriptions ?? [])
        .filter((s) => s.kind === "one_time")
        .map((s) => ({
          id: s.id,
          name: s.service_name,
          amount: s.amount,
          date: s.next_billing_date, // the actual payment date (charge_date) — no scan-date fallback
          category: s.category,
        }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [data]
  );

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const thisMonth = payments
    .filter((p) => p.date && isSameMonth(parseISO(p.date), new Date()))
    .reduce((s, p) => s + p.amount, 0);
  const avg = payments.length ? Math.round(total / payments.length) : 0;

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !amount || !date) {
      setError("Name, amount and date are required");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/subscriptions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_name: name,
        title: name,
        amount: parseFloat(amount),
        category,
        next_charge_date: date,
        recurrence_rule: "monthly", // ignored for one-time; satisfies validation
        reminder_days: 3,
        kind: "one_time",
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not save payment");
      return;
    }
    posthog.capture("one_time_payment_added", {
      name,
      amount: parseFloat(amount),
      category,
    });
    qc.invalidateQueries({ queryKey: ["profile"] });
    setAddOpen(false);
    setName(""); setAmount(""); setDate(""); setCategory("Other");
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">One-Time Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Large or irregular expenses — detected from Gmail or added by you</p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddOpen(true)}
          className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.97]"
        >
          <Plus size={13} />
          Add Payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Tracked", value: formatMoney(total, currency), icon: CreditCard },
          { label: "This Month", value: formatMoney(thisMonth, currency), icon: Calendar },
          { label: "Avg. Payment", value: formatMoney(avg, currency), icon: Receipt },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon size={13} className="text-violet-500" />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {payments.length === 0 ? (
        <div className="py-20 flex flex-col items-center gap-3 text-center">
          <Receipt size={32} className="text-slate-200 dark:text-slate-700" />
          <p className="text-sm font-medium text-slate-500">No one-time payments yet</p>
          <p className="text-xs text-slate-400 max-w-xs">
            Add a payment, or scan Gmail — one-time charges (domains, repairs, top-ups) land here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center shrink-0">
                <Receipt size={16} className="text-violet-600 dark:text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 text-[10px] font-medium">
                    One-time payment
                  </span>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar size={10} />
                    {p.date ? format(parseISO(p.date), "d MMM yyyy") : "—"}
                  </span>
                </div>
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white shrink-0 tabular-nums">
                {formatMoney(p.amount, currency)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add One-Time Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={addPayment} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New laptop, car service…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount ({currency})</Label>
                <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="85000" />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {saving ? "Adding…" : "Add Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
