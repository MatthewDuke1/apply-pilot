import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. This bypasses RLS
// and must NEVER be imported from client components or pages. It's safe because
// db.ts (and everything that imports it) only runs in Node inside API routes
// and server-side functions.
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const supabase = url && key
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

export const TABLES = {
  resumes: "ap_resumes",
  jobs: "ap_jobs",
  applications: "ap_applications",
  connections: "ap_connections",
  auto_apply_config: "ap_auto_apply_config",
  auto_apply_runs: "ap_auto_apply_runs",
  auto_applied_jobs: "ap_auto_applied_jobs",
} as const;
