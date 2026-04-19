import { supabase, TABLES } from "./supabase";
import type { AutoApplyConfig, AutoApplyRun, AutoAppliedJob } from "./types";

// ── Auto-Apply Config ──────────────────────────────────────────────

export async function getAutoApplyConfig(): Promise<AutoApplyConfig | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from(TABLES.auto_apply_config)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return {
    ...data,
    search_queries: data.search_queries || [],
  } as AutoApplyConfig;
}

export async function upsertAutoApplyConfig(config: AutoApplyConfig): Promise<AutoApplyConfig> {
  if (!supabase) throw new Error("Supabase not configured");
  // Whitelist columns that exist in the table; drops stray fields (e.g. errors)
  // that a client might echo back after round-tripping the GET response.
  const payload = {
    enabled: config.enabled,
    daily_limit: config.daily_limit,
    min_match_score: config.min_match_score,
    search_queries: config.search_queries,
    location: config.location,
    report_email: config.report_email,
    resume_text: config.resume_text,
    resume_name: config.resume_name,
    updated_at: new Date().toISOString(),
  };
  if (config.id) {
    const { data, error } = await supabase
      .from(TABLES.auto_apply_config)
      .update(payload)
      .eq("id", config.id)
      .select()
      .single();
    if (error) throw error;
    return data as AutoApplyConfig;
  }
  const { data, error } = await supabase
    .from(TABLES.auto_apply_config)
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as AutoApplyConfig;
}

// ── Auto-Apply Runs ────────────────────────────────────────────────

export async function saveAutoApplyRun(run: AutoApplyRun): Promise<string> {
  if (!supabase) throw new Error("Supabase not configured");
  const { applications, ...runData } = run;
  const { data, error } = await supabase
    .from(TABLES.auto_apply_runs)
    .insert({
      ...runData,
      errors: runData.errors,
    })
    .select("id")
    .single();
  if (error) throw error;
  const runId = data.id;

  if (applications.length > 0) {
    const rows = applications.map((app) => ({
      run_id: runId,
      job_data: app.job,
      match_score: app.match_score,
      match_reasons: app.match_reasons,
      cover_letter: app.cover_letter,
      applied_at: app.applied_at,
      career_page_url: app.career_page_url,
    }));
    const { error: appErr } = await supabase
      .from(TABLES.auto_applied_jobs)
      .insert(rows);
    if (appErr) console.error("Failed to save auto-applied jobs:", appErr);
  }

  return runId;
}

export async function getTodaysRuns(): Promise<AutoApplyRun[]> {
  if (!supabase) return [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from(TABLES.auto_apply_runs)
    .select("*")
    .gte("started_at", todayStart.toISOString())
    .order("started_at", { ascending: false });
  if (error || !data) return [];
  return data as AutoApplyRun[];
}

export async function getRecentRuns(days = 7): Promise<AutoApplyRun[]> {
  if (!supabase) return [];
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from(TABLES.auto_apply_runs)
    .select("*")
    .gte("started_at", since.toISOString())
    .order("started_at", { ascending: false });
  if (error || !data) return [];
  return data as AutoApplyRun[];
}

export async function getAutoAppliedJobsForRun(runId: string): Promise<AutoAppliedJob[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(TABLES.auto_applied_jobs)
    .select("*")
    .eq("run_id", runId)
    .order("applied_at", { ascending: false });
  if (error || !data) return [];
  return data.map((row) => ({
    job: row.job_data,
    match_score: row.match_score,
    match_reasons: row.match_reasons,
    cover_letter: row.cover_letter,
    applied_at: row.applied_at,
    career_page_url: row.career_page_url,
  })) as AutoAppliedJob[];
}

// ── Duplicate Check ────────────────────────────────────────────────

export async function getAppliedJobIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from(TABLES.auto_applied_jobs)
    .select("job_data->id");
  if (error || !data) return new Set();
  return new Set(data.map((r) => String(r.id)).filter(Boolean));
}
