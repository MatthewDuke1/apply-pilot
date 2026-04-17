import { NextResponse } from "next/server";
import { runAutoApply } from "@/lib/auto-apply";

export const maxDuration = 300; // 5 min max for Vercel

export async function GET(req: Request) {
  // Verify cron secret to prevent unauthorized triggers
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await runAutoApply();

    return NextResponse.json({
      success: true,
      summary: {
        jobs_searched: run.jobs_searched,
        jobs_applied: run.jobs_applied,
        jobs_skipped_ghost: run.jobs_skipped_ghost,
        jobs_skipped_score: run.jobs_skipped_score,
        jobs_skipped_duplicate: run.jobs_skipped_duplicate,
        errors: run.errors.length,
        duration_ms: run.completed_at
          ? new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()
          : null,
      },
      applications: run.applications.map((a) => ({
        title: a.job.title,
        company: a.job.company,
        match_score: a.match_score,
        career_page_url: a.career_page_url,
      })),
    });
  } catch (e) {
    console.error("Auto-apply cron failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
