"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  RefreshCw,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ThemeToggle from "@/components/ThemeToggle";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/commitments", icon: RefreshCw, label: "Recurring" },
  { href: "/payments", icon: CreditCard, label: "One-Time" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [collapsed, setCollapsed] = useState(false);

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() ?? "?";

  // Mobile (<lg) is ALWAYS a 64px icon rail regardless of `collapsed`; on desktop the chevron toggles
  // between the rail and the full 220px sidebar. These helpers hide the expanded labels on mobile, and
  // also when the user has collapsed on desktop — done purely with CSS so there's no hydration flash.
  const expandInline = collapsed ? "hidden" : "hidden lg:inline";
  const expandBlock = collapsed ? "hidden" : "hidden lg:block";

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-white dark:bg-[#0f0f17] border-r border-slate-100 dark:border-white/[0.06] transition-all duration-300 sticky top-0 shrink-0 w-[64px]",
        !collapsed && "lg:w-[220px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 h-16 px-4 border-b border-slate-100 dark:border-white/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.png" alt="Subwise" className="h-7 w-7 object-contain shrink-0 select-none" />
        <span className={cn("font-semibold text-slate-900 dark:text-white text-sm tracking-tight", expandInline)}>
          Subwise
        </span>
        {/* Toggle is desktop-only — expanding to 220px on a phone would eat the screen. */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors hidden lg:block"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className={expandInline}>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Theme */}
      <div
        className={cn(
          "px-3 pb-1 flex",
          collapsed ? "justify-center" : "justify-center lg:justify-start lg:items-center lg:gap-2"
        )}
      >
        <ThemeToggle inline />
        <span className={cn("text-xs text-slate-400", expandInline)}>Theme</span>
      </div>

      {/* User */}
      <div className="border-t border-slate-100 dark:border-white/[0.06] p-3">
        <div
          className={cn(
            "flex items-center gap-2.5",
            collapsed ? "justify-center" : "justify-center lg:justify-start"
          )}
        >
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={session?.user?.image ?? undefined} />
            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          {/* Show the NAME as the account label (not the email). */}
          <div className={cn("flex-1 min-w-0", expandBlock)}>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {session?.user?.name || "User"}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className={cn("text-slate-400 hover:text-red-500 transition-colors", expandBlock)}
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
