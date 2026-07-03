"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import posthog from "posthog-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export default function AuthDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  async function handleGoogle() {
    if (!agreed) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setError(null);
    setGoogleLoading(true);
    // Analytics must never block the redirect (ad-blockers can make this throw).
    try {
      posthog.capture("login_completed", { method: "google" });
    } catch {
      /* ignore */
    }
    try {
      await signIn("google", { callbackUrl: "/welcome" });
    } catch {
      setGoogleLoading(false);
      setError("Couldn't reach Google sign-in. Please try again.");
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agreed) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not create account");
          setLoading(false);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setError(mode === "login" ? "Invalid email or password" : "Signed up, but sign-in failed — try logging in");
        setLoading(false);
        return;
      }
      if (mode === "register") {
        posthog.identify(email, { email, name });
        posthog.capture("signup_completed", { method: "email" });
      } else {
        posthog.identify(email, { email });
        posthog.capture("login_completed", { method: "email" });
      }
      window.location.href = "/welcome";
    } catch (err) {
      posthog.captureException(err);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="flex flex-col items-center gap-2 mb-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="Subwise" className="w-12 h-auto select-none" />
            <DialogTitle className="text-center">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </DialogTitle>
            <p className="text-xs text-slate-500 text-center">
              {mode === "login" ? "Log in to Subwise" : "Start tracking your subscriptions with Subwise"}
            </p>
          </div>
        </DialogHeader>

        {/* Terms & Privacy consent — required before any sign-in/sign-up action. */}
        <label className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              if (e.target.checked) setError(null);
            }}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 dark:border-white/20 text-indigo-600 focus:ring-indigo-500"
          />
          <span>
            I agree to Subwise&apos;s{" "}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={!agreed || googleLoading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          )}
          {googleLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 my-1">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Name</Label>
              <Input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              required
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button
            type="submit"
            disabled={loading || !agreed}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-xs text-slate-500">
          {mode === "login" ? "New to Subwise?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="font-medium text-indigo-600 hover:underline"
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
        <p className="text-center text-[11px] text-slate-400">
          Email sign-up skips Gmail — add it later in Settings to auto-detect subscriptions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
