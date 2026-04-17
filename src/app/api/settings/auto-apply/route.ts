import { NextResponse } from "next/server";
import { getAutoApplyConfig, upsertAutoApplyConfig, getRecentRuns, getAutoAppliedJobsForRun } from "@/lib/db";
import type { AutoApplyRun } from "@/lib/types";

export async function GET() {
  try {
    const config = await getAutoApplyConfig();
    const runs = await getRecentRuns(7);

    // Hydrate runs with their applications
    const hydratedRuns: AutoApplyRun[] = await Promise.all(
      runs.map(async (run) => {
        const applications = run.id
          ? await getAutoAppliedJobsForRun(run.id as string)
          : [];
        return { ...run, applications };
      })
    );

    return NextResponse.json({ config, runs: hydratedRuns });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const config = await upsertAutoApplyConfig(body);
    return NextResponse.json({ config });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
