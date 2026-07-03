-- ============================================================
-- Subwise — email/password authentication
-- Lets users sign up WITHOUT Google (no Gmail read access; manual subscription tracking only).
-- Google-only profiles keep password_hash null. Accounts link by email: a Google user who later
-- sets a password, or a password user who later connects Gmail, share the one profile row.
-- Run in Supabase → SQL Editor after 0006.
-- ============================================================

alter table profiles add column if not exists password_hash text;
