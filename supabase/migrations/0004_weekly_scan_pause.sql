-- ============================================================
-- Subscription Graveyard — weekly auto-scan pause flag
-- Lets a user pause the automatic weekly Gmail scan via WhatsApp "PAUSE" (RESUME to re-enable).
-- Run in Supabase → SQL Editor after 0003.
-- ============================================================

alter table profiles
  add column if not exists weekly_scan_paused boolean not null default false;
