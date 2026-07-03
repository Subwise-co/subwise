-- ============================================================
-- Subwise v2 — generalize subscriptions into "recurring financial commitments"
-- Subscriptions become ONE category among rent / EMIs / insurance / SIPs / utilities / custom, etc.
-- Option B (extend the existing table, no data migration): existing rows default to category
-- 'subscription' so the scan pipeline, dashboard, and all 137 tests keep working unchanged.
--   • category       — the commitment type (subscription | rent | utility | credit_card | insurance |
--                      investment | loan | custom). Drives grouping + icons in the UI.
--   • recurrence_rule — flexible recurrence for manual reminders (e.g. "monthly", "annual",
--                      "quarterly", "weekly", "every:2:week", "custom:<rrule>"). null = use billing_cycle.
--   • title          — optional user-facing label for non-merchant reminders ("Flat rent", "Car EMI").
--                      Falls back to service_name when null.
-- Run in Supabase → SQL Editor after 0007.
-- ============================================================

alter table subscriptions add column if not exists category text not null default 'subscription';
alter table subscriptions add column if not exists recurrence_rule text;
alter table subscriptions add column if not exists title text;
-- Price history for change detection ("Netflix ₹499 → ₹649"): appended on a re-scan when the amount
-- actually changes. Each entry: { date: 'YYYY-MM-DD', from: <num>, to: <num> }.
alter table subscriptions add column if not exists price_history jsonb not null default '[]'::jsonb;

-- Helps the dashboard "group by category" view.
create index if not exists subscriptions_user_category_idx on subscriptions (user_id, category);

-- Reminder METERING (instrument, do not paywall yet): a running count of WhatsApp/email reminders sent
-- to each user. Once we move to the Meta Cloud API (per-conversation cost), this is the data that sets
-- sensible free-tier limits + pricing — decided on evidence, not guessed.
alter table profiles add column if not exists reminders_sent int not null default 0;

