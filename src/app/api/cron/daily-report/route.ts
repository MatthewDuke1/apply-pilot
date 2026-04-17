import { NextResponse } from "next/server";
import { getTodaysRuns, getAutoAppliedJobsForRun, getAutoApplyConfig } from "@/lib/db";
import { sendDailyReport } from "@/lib/email";
import type { AutoApplyRun } from "@/lib/types";

export const maxDuration = 30;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await getAutoApplyConfig();
    if (!config?.report_email) {
      return NextResponse.json({ error: "No report email configured" }, { status: 400 });
    }

    // Get today's runs and hydrate them with their applications
    const runs = await getTodaysRuns();
    const hydratedRuns: AutoApplyRun[] = await Promise.all(
      runs.map(async (run) => {
        const applications = run.id
          ? await getAutoAppliedJobsForRun(run.id as string)
          : [];
        return { ...run, applications };
      })
    );

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const sent = await sendDailyReport(config.report_email, hydratedRuns, today);

    return NextResponse.json({
      success: sent,
      email: config.report_email,
      runs_included: hydratedRuns.length,
      total_applied: hydratedRuns.reduce((s, r) => s + r.jobs_applied, 0),
    });
  } catch (e) {
    console.error("Daily report cron failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
