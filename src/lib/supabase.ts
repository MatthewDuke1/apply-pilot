import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key) : null;

export const TABLES = {
  resumes: "ap_resumes",
  jobs: "ap_jobs",
  applications: "ap_applications",
  connections: "ap_connections",
  auto_apply_config: "ap_auto_apply_config",
  auto_apply_runs: "ap_auto_apply_runs",
  auto_applied_jobs: "ap_auto_applied_jobs",
} as const;
