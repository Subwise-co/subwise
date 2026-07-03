-- ============================================================
-- Subwise — dashboard support
-- 1) A per-user global default for reminder lead time (applied to current + future subscriptions).
-- 2) Monthly spend snapshots so the dashboard chart can show REAL month-over-month history over time
--    (written at the end of each scan / weekly auto-scan). Run in Supabase → SQL Editor after 0005.
-- ============================================================

alter table profiles add column if not exists reminder_days_default int not null default 3;

create table if not exists spend_snapshots (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid references profiles(id) on delete cascade,
  month             date not null,                 -- first day of the snapshot month
  monthly_total_inr numeric not null default 0,    -- monthly run-rate (INR), annual amortized
  active_count      int not null default 0,
  created_at        timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists spend_snapshots_user_idx on spend_snapshots (user_id, month);

alter table spend_snapshots enable row level security;
