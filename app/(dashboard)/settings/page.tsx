"use client";

import posthog from "posthog-js";
import { useProfile } from "@/lib/hooks/useProfile";
import { useQueryClient } from "@tanstack/react-query";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import {
  User,
  Mail,
  MessageCircle,
  Bell,
  Shield,
  Database,
  Info,
  ChevronRight,
  Check,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={15} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-white">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#13131f] border border-slate-100 dark:border-white/[0.06] rounded-xl p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { data, isLoading } = useProfile();
  const qc = useQueryClient();

  const [budget, setBudget] = useState("");
  const [budgetSaved, setBudgetSaved] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappSaving, setWhatsappSaving] = useState(false);
  const [reminderDays, setReminderDays] = useState("3");
  const [reminderSaved, setReminderSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profile = data?.profile;
  const currency = profile?.display_currency || "INR";
  const initials = session?.user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";

  // Keep the reminder dropdown in sync with the persisted default.
  useEffect(() => {
    if (profile?.default_reminder_days) setReminderDays(String(profile.default_reminder_days));
  }, [profile?.default_reminder_days]);

  // Keep the WhatsApp status fresh while a number is on file (connected OR pending), so the card
  // reflects out-of-band WhatsApp changes without a manual refresh: an inbound YES flips it to
  // Connected; a STOP/disconnect flips it back.
  const whatsappNumber = profile?.whatsapp_number ?? null;
  useEffect(() => {
    if (!whatsappNumber) return;
    const id = setInterval(() => qc.invalidateQueries({ queryKey: ["profile"] }), 12000);
    return () => clearInterval(id);
  }, [whatsappNumber, qc]);

  async function saveBudget() {
    if (!budget) return;
    await fetch("/api/profile/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budget: parseFloat(budget) }),
    });
    posthog.capture("budget_set", { budget: parseFloat(budget) });
    setBudgetSaved(true);
    qc.invalidateQueries({ queryKey: ["profile"] });
    setTimeout(() => setBudgetSaved(false), 2000);
  }

  async function saveReminder(val: string) {
    setReminderDays(val);
    await fetch("/api/profile/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: parseInt(val) }),
    });
    posthog.capture("reminder_default_changed", { days: parseInt(val) });
    setReminderSaved(true);
    qc.invalidateQueries({ queryKey: ["profile"] });
    setTimeout(() => setReminderSaved(false), 2000);
  }

  async function connectWhatsApp() {
    if (!whatsapp) return;
    setWhatsappSaving(true);
    await fetch("/api/whatsapp/optin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: whatsapp }),
    });
    posthog.capture("whatsapp_connected");
    setWhatsappSaving(false);
    setWhatsapp("");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function removeWhatsApp() {
    setWhatsappSaving(true);
    await fetch("/api/whatsapp/optin", { method: "DELETE" });
    posthog.capture("whatsapp_removed");
    setWhatsappSaving(false);
    setWhatsapp("");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function deleteAccount() {
    // First click arms the confirm; second click actually deletes (guards against accidental taps).
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await fetch("/api/account/delete", { method: "DELETE" });
      posthog.capture("account_deleted");
    } catch {
      /* best-effort — sign out regardless */
    }
    signOut({ callbackUrl: "/" });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      {/* Profile */}
      <SettingCard>
        <SectionHeader icon={User} title="Profile" description="Your account information" />
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="text-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {session?.user?.name ?? "—"}
            </p>
            <p className="text-xs text-slate-500">{session?.user?.email ?? "—"}</p>
            <p className="text-xs text-slate-400 mt-1">
              Member since{" "}
              {profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-IN", {
                    month: "long",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>
      </SettingCard>

      {/* Monthly Budget */}
      <SettingCard>
        <SectionHeader
          icon={Database}
          title="Monthly Budget"
          description="Used to calculate spending percentage on Dashboard"
        />
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{profile?.currency_symbol || "₹"}</span>
            <Input
              type="number"
              placeholder={profile?.monthly_budget?.toString() ?? "e.g. 50000"}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="pl-7"
            />
          </div>
          <Button
            onClick={saveBudget}
            size="sm"
            className={cn(
              "gap-1.5",
              budgetSaved ? "bg-emerald-600 hover:bg-emerald-600" : "bg-indigo-600 hover:bg-indigo-700"
            )}
          >
            {budgetSaved ? <Check size={13} /> : null}
            {budgetSaved ? "Saved" : "Save"}
          </Button>
        </div>
        {profile?.monthly_budget ? (
          <p className="text-xs text-slate-400 mt-2">
            Current budget: {formatMoney(profile.monthly_budget, currency)}
          </p>
        ) : null}
      </SettingCard>

      {/* Connected Accounts */}
      <SettingCard>
        <SectionHeader
          icon={Mail}
          title="Connected Accounts"
          description="Services that power automatic detection"
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/10 flex items-center justify-center">
                <Mail size={14} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Gmail</p>
                <p className="text-xs text-slate-400">
                  {profile?.gmail_connected ? "Connected" : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] border-0",
                  profile?.gmail_connected
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                )}
              >
                {profile?.gmail_connected ? "Connected" : "Not connected"}
              </Badge>
            </div>
          </div>
        </div>
      </SettingCard>

      {/* WhatsApp */}
      <SettingCard>
        <SectionHeader
          icon={MessageCircle}
          title="WhatsApp Reminders"
          description="Get payment reminders directly in WhatsApp"
        />
        {profile?.whatsapp_opted_in ? (
          // Connected: confirmed on WhatsApp (replied YES). Persists until the user removes it or replies STOP.
          <div className="flex items-center justify-between gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
            <div className="flex items-center gap-3">
              <Check size={15} className="text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  WhatsApp connected
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  +91 {profile.whatsapp_number}
                </p>
              </div>
            </div>
            <Button
              onClick={removeWhatsApp}
              size="sm"
              variant="ghost"
              disabled={whatsappSaving}
              className="text-xs text-slate-500 hover:text-red-600 gap-1"
            >
              <Trash2 size={13} /> Remove
            </Button>
          </div>
        ) : profile?.whatsapp_number ? (
          // Saved but not yet confirmed — the welcome was sent; the user must reply YES on WhatsApp.
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageCircle size={15} className="text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Reply <span className="font-bold">YES</span> on WhatsApp to confirm
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    +91 {profile.whatsapp_number} · we sent you a confirmation message
                  </p>
                </div>
              </div>
              <Button
                onClick={removeWhatsApp}
                size="sm"
                variant="ghost"
                disabled={whatsappSaving}
                className="text-xs text-slate-500 hover:text-red-600 gap-1"
              >
                <Trash2 size={13} /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder="9876543210"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="pl-10"
                  maxLength={10}
                />
              </div>
              <Button
                onClick={connectWhatsApp}
                size="sm"
                disabled={whatsappSaving || whatsapp.length < 10}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              >
                {whatsappSaving ? <Loader2 size={13} className="animate-spin" /> : null}
                Connect
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              We'll send you reminders via WhatsApp before payments are due. Standard messaging
              rates apply.
            </p>
          </div>
        )}
      </SettingCard>

      {/* Notifications */}
      <SettingCard>
        <SectionHeader
          icon={Bell}
          title="Notification Preferences"
          description="Default reminder timing for all commitments"
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Default reminder
              </p>
              <p className="text-xs text-slate-400">
                Applied to all commitments unless overridden
              </p>
            </div>
            <Select value={reminderDays} onValueChange={saveReminder}>
              <SelectTrigger className="w-36 text-xs h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day before</SelectItem>
                <SelectItem value="3">3 days before</SelectItem>
                <SelectItem value="7">7 days before</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {reminderSaved && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Check size={11} /> Saved
            </p>
          )}
        </div>
      </SettingCard>

      {/* Privacy & Security */}
      <SettingCard>
        <SectionHeader
          icon={Shield}
          title="Privacy & Security"
          description="Control your data and account security"
        />
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Google OAuth Login
              </p>
              <p className="text-xs text-slate-400">Signed in via Google</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Active
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Gmail Read Access
              </p>
              <p className="text-xs text-slate-400">Read-only, used for subscription detection</p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Granted
            </Badge>
          </div>
        </div>
      </SettingCard>

      {/* About */}
      <SettingCard>
        <SectionHeader icon={Info} title="About Subwise" />
        <div className="space-y-2 text-xs text-slate-500">
          <div className="flex justify-between">
            <span>Version</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">3.0.0</span>
          </div>
          <div className="flex justify-between">
            <span>Stack</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              Next.js 15 · Supabase · WhatsApp
            </span>
          </div>
          <Separator className="my-2" />
          <p className="text-[11px] text-slate-400">
            Subwise helps you track subscriptions, bills, and recurring payments — and reminds you
            on WhatsApp before anything is due.
          </p>
        </div>
      </SettingCard>

      {/* Danger zone — delete account */}
      <SettingCard className="border-red-200 dark:border-red-500/20">
        <SectionHeader
          icon={Trash2}
          title="Delete account"
          description="Permanently remove your account and all data"
        />
        <p className="text-xs text-slate-500 mb-3">
          This deletes your profile, detected subscriptions, reminders, and WhatsApp connection.
          This cannot be undone.
        </p>
        <Button
          onClick={deleteAccount}
          disabled={deleting}
          variant="ghost"
          className="gap-1.5 border border-red-200 dark:border-red-500/20 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          {confirmDelete ? "Click again to permanently delete" : "Delete my account"}
        </Button>
      </SettingCard>
      </div>
    </div>
  );
}
