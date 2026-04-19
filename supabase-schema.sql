-- ApplyPilot: Auto-Apply Tables
-- Run this in your Supabase SQL editor to set up the auto-apply feature

-- Auto-apply configuration (one row per user/setup)
create table if not exists ap_auto_apply_config (
  id uuid primary key default gen_random_uuid(),
  enabled boolean not null default false,
  daily_limit integer not null default 10,
  min_match_score integer not null default 60,
  search_queries text[] not null default '{}',
  location text not null default 'Remote',
  report_email text not null default '',
  resume_text text not null default '',
  resume_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-apply run history (one row per cron execution)
create table if not exists ap_auto_apply_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null,
  completed_at timestamptz,
  jobs_searched integer not null default 0,
  jobs_matched integer not null default 0,
  jobs_applied integer not null default 0,
  jobs_skipped_ghost integer not null default 0,
  jobs_skipped_score integer not null default 0,
  jobs_skipped_duplicate integer not null default 0,
  errors text[] not null default '{}'
);

-- Individual auto-applied jobs (one row per job application)
create table if not exists ap_auto_applied_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ap_auto_apply_runs(id) on delete cascade,
  job_data jsonb not null,
  match_score integer not null,
  match_reasons text[] not null default '{}',
  cover_letter text not null default '',
  applied_at timestamptz not null,
  career_page_url text not null default ''
);

-- Indexes for common queries
create index if not exists idx_runs_started_at on ap_auto_apply_runs(started_at desc);
create index if not exists idx_applied_jobs_run_id on ap_auto_applied_jobs(run_id);
create index if not exists idx_applied_jobs_applied_at on ap_auto_applied_jobs(applied_at desc);

-- RLS enabled with NO policies for anon/authenticated roles. All access goes
-- through the server-side service_role key, which bypasses RLS entirely. This
-- means the Supabase anon key is useless against these tables even if leaked.
alter table ap_auto_apply_config enable row level security;
alter table ap_auto_apply_runs enable row level security;
alter table ap_auto_applied_jobs enable row level security;
