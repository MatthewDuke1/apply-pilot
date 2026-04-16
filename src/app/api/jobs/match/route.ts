import { NextResponse } from "next/server";
import { scoreJobMatch, detectGhostJob } from "@/lib/claude";

export async function POST(req: Request) {
  try {
    const { resume_text, job_description, posted_date } = await req.json();

    if (!resume_text || !job_description) {
      return NextResponse.json({ error: "resume_text and job_description required" }, { status: 400 });
    }

    const [match, ghost] = await Promise.all([
      scoreJobMatch(resume_text, job_description),
      detectGhostJob(job_description, posted_date || new Date().toISOString()),
    ]);

    return NextResponse.json({ ...match, ghost });
  } catch (e) {
    console.error("Job match error:", e);
    return NextResponse.json({ error: "Failed to analyze job match." }, { status: 500 });
  }
}
