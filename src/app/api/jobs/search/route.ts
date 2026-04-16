import { NextResponse } from "next/server";
import { searchIndeed, searchLinkedIn, resolveCareerPage } from "@/lib/job-search";
import type { Job } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "Product Manager";
  const location = searchParams.get("location") || "Remote";
  const source = searchParams.get("source") || "both";
  const page = parseInt(searchParams.get("page") || "1", 10);

  let jobs: Job[] = [];

  if (source === "indeed" || source === "both") {
    const indeedJobs = await searchIndeed(query, location, page);
    jobs.push(...indeedJobs);
  }

  if (source === "linkedin" || source === "both") {
    const linkedInJobs = await searchLinkedIn(query, location, page);
    jobs.push(...linkedInJobs);
  }

  // Deduplicate by title+company
  const seen = new Set<string>();
  jobs = jobs.filter((j) => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Resolve career pages in parallel (best-effort, 3s timeout each)
  await Promise.allSettled(
    jobs.map(async (job) => {
      if (!job.company_careers_url && job.company) {
        job.company_careers_url = await resolveCareerPage(job.company);
      }
    })
  );

  return NextResponse.json({ jobs, query, location, page });
}
