import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = url && key ? createClient(url, key) : null;

export const TABLES = {
  resumes: "ap_resumes",
  jobs: "ap_jobs",
  applications: "ap_applications",
  connections: "ap_connections",
} as const;
