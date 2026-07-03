"use client";

import { useQuery } from "@tanstack/react-query";

export interface Subscription {
  id: string;
  service_name: string;
  amount: number; // already converted to the user's display currency
  currency: string; // display currency code
  native_amount: number;
  native_currency: string;
  billing_cycle: string;
  kind: string; // subscription | trial | one_time | mandate
  next_billing_date: string | null;
  category: string | null;
  status: string;
  source: string;
  reminder_days: number;
  created_at: string;
}

export interface SpendSnapshot {
  id: string;
  month: string;
  total_spend: number;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  monthly_budget: number | null;
  default_reminder_days: number;
  whatsapp_number: string | null;
  whatsapp_opted_in: boolean;
  gmail_connected: boolean;
  created_at: string;
  display_currency: string;
  currency_symbol: string;
}

export interface ProfileData {
  profile: Profile;
  subscriptions: Subscription[];
  snapshots: SpendSnapshot[];
}

async function fetchProfile(): Promise<ProfileData> {
  const res = await fetch("/api/profile");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

// Master data hook — backed by the real /api/profile endpoint (shaped to this contract server-side).
export function useProfile() {
  return useQuery<ProfileData>({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    staleTime: 30 * 1000,
    retry: false,
  });
}
