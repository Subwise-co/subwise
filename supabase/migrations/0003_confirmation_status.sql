-- ============================================================
-- Subscription Graveyard — confirmation status
-- Adds status: confirmed (auto-added) | pending (needs user confirmation) | rejected (user said no).
-- Rejections are remembered: re-scans never resurrect a rejected item.
-- Run in Supabase → SQL Editor after 0002.
-- ============================================================

alter table subscriptions
  add column if not exists status text not null default 'confirmed'
    check (status in ('confirmed', 'pending', 'rejected'));

-- Existing rows are treated as already-confirmed (default handles that).
create index if not exists subscriptions_status_idx on subscriptions (user_id, status);
