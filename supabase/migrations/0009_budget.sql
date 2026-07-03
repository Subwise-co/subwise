-- ============================================================
-- Subwise — monthly budget
-- A user sets a monthly budget; the dashboard shows commitment-vs-budget, and the daily cron sends a
-- single WhatsApp nudge per month if their recurring commitment exceeds it.
--   monthly_budget      — the user's target (INR; 0/null = not set).
--   budget_alert_month  — the YYYY-MM we last sent the over-budget nudge (dedupes to once per month).
-- Run in Supabase → SQL Editor after 0008.
-- ============================================================

alter table profiles add column if not exists monthly_budget numeric not null default 0;
alter table profiles add column if not exists budget_alert_month text;
