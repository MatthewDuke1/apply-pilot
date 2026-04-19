-- Migration: lock down Supabase tables so the public anon key has zero access.
-- Run this ONCE in the Supabase SQL editor on your existing database.
--
-- After this migration:
--   • RLS is enabled on all auto-apply tables (already was)
--   • All permissive "allow all" policies are dropped
--   • The server-side service_role key still has full access (it bypasses RLS)
--   • Nobody holding just the anon key can read or modify these tables

drop policy if exists "Allow all on config"       on ap_auto_apply_config;
drop policy if exists "Allow all on runs"         on ap_auto_apply_runs;
drop policy if exists "Allow all on applied jobs" on ap_auto_applied_jobs;

-- Confirm RLS is on (no-op if already enabled)
alter table ap_auto_apply_config  enable row level security;
alter table ap_auto_apply_runs    enable row level security;
alter table ap_auto_applied_jobs  enable row level security;
