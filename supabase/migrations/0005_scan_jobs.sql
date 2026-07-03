-- ============================================================
-- Subscription Graveyard — resumable scan jobs
-- A scan is processed batch-by-batch (by the always-on worker) so a large inbox is captured
-- completely and reliably, with progress shown live. Run in Supabase → SQL Editor after 0004.
-- ============================================================

create table if not exists scan_jobs (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references profiles(id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'running', 'done', 'error')),
  message_ids     jsonb not null default '[]'::jsonb,  -- all matched Gmail IDs for the window
  cursor          int  not null default 0,             -- next index in message_ids to process
  total           int  not null default 0,
  found           int  not null default 0,
  failed_batches  int  not null default 0,
  window_days     int  not null default 90,
  error           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists scan_jobs_status_idx on scan_jobs (status);
create index if not exists scan_jobs_user_status_idx on scan_jobs (user_id, status);

alter table scan_jobs enable row level security; -- server (service role) only; defence-in-depth
