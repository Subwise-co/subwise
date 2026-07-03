-- ============================================================
-- Subscription Graveyard — initial schema
-- Run in Supabase → SQL Editor (or via `supabase db push`).
-- ============================================================

-- ---------- profiles ----------
-- NOTE (deviation from guide): identity is managed by NextAuth, not Supabase Auth,
-- so profiles.id is an independent UUID and is NOT a FK to auth.users. The guide's
-- original schema referenced auth.users and tried to store Google's `sub` (a numeric
-- string) in this uuid column, which would fail. Users are matched by email everywhere.
create table if not exists profiles (
  id                    uuid default gen_random_uuid() primary key,
  email                 text unique not null,
  gmail_access_token    text,
  gmail_refresh_token   text,
  gmail_token_expiry    timestamptz,
  last_scanned_at       timestamptz,
  phone_number          text,
  whatsapp_opted_in     boolean default false,
  whatsapp_opted_in_at  timestamptz,
  created_at            timestamptz default now()
);

-- Webhook + cron look users up by the last-10-digit phone number.
create index if not exists profiles_phone_number_idx on profiles (phone_number);

-- ---------- subscriptions ----------
create table if not exists subscriptions (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references profiles(id) on delete cascade,
  service_name    text not null,
  amount          decimal(10,2),
  currency        text default 'INR',
  billing_cycle   text,
  next_charge_date date,
  last_seen_date  date,
  email_sender    text,
  is_active       boolean default true,
  is_trial        boolean default false,
  trial_end_date  date,
  trial_alerted   boolean default false,
  source          text default 'gmail' check (source in ('gmail', 'manual')),
  reminder_days   int default 3,
  created_at      timestamptz default now(),
  unique (user_id, service_name)
);

create index if not exists subscriptions_user_id_idx on subscriptions (user_id);
create index if not exists subscriptions_next_charge_idx on subscriptions (next_charge_date);

-- ---------- alerts ----------
create table if not exists alerts (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references profiles(id) on delete cascade,
  subscription_id   uuid references subscriptions(id) on delete cascade,
  alert_type        text check (alert_type in ('trial_ending', 'renewal_reminder')),
  alert_days_before int default 3,
  is_active         boolean default true,
  last_sent_at      timestamptz,
  created_at        timestamptz default now(),
  -- FIX (not in guide): the manual-entry route upserts alerts with
  -- onConflict: 'subscription_id'. That requires this uniqueness, otherwise
  -- the upsert errors. One alert per subscription is the intended model.
  unique (subscription_id)
);

create index if not exists alerts_user_id_idx on alerts (user_id);

-- ---------- feedback ----------
create table if not exists feedback (
  id               uuid default gen_random_uuid() primary key,
  user_email       text,
  surprise_rating  int,
  improvement_text text,
  created_at       timestamptz default now()
);

-- ---------- Row Level Security ----------
-- All server-side access uses the service_role key, which BYPASSES RLS.
-- Because identity is NextAuth (not Supabase Auth), there are no auth.uid() sessions,
-- so RLS effectively denies the anon client direct table access. That is intentional
-- and safe: every real read/write goes through service-role server API routes.
-- Enabling RLS keeps the tables locked down as defence-in-depth.
alter table profiles      enable row level security;
alter table subscriptions enable row level security;
alter table alerts        enable row level security;

-- (No auth.users FK and no handle_new_user trigger: the NextAuth signIn callback
--  upserts the profile row by email — see app/api/auth/[...nextauth]/route.js.)
