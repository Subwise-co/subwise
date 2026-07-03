-- ============================================================
-- Subwise — store the user's display NAME on the profile.
-- Captured at email/password sign-up and from the Google OAuth profile, shown in the sidebar
-- (name instead of email) and the dashboard greeting. Run in Supabase → SQL Editor after 0009.
-- ============================================================

alter table profiles add column if not exists name text;
