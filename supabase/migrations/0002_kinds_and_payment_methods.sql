-- ============================================================
-- Subscription Graveyard — richer entry types
-- Adds: kind (subscription/trial/one_time/mandate), payment_method, charge_date.
-- Run in Supabase → SQL Editor after 0001.
-- ============================================================

alter table subscriptions
  add column if not exists kind text not null default 'subscription'
    check (kind in ('subscription', 'trial', 'one_time', 'mandate')),
  add column if not exists payment_method text,        -- e.g. 'Debit card e-mandate', 'UPI mandate', 'Card'
  add column if not exists charge_date date;           -- one-time payment date OR mandate start date

-- Backfill kind for existing rows so old data stays consistent.
update subscriptions set kind = 'trial' where is_trial = true and kind = 'subscription';

create index if not exists subscriptions_kind_idx on subscriptions (kind);
