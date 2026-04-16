import { NextResponse } from "next/server";
import { generateCoverLetter } from "@/lib/claude";

export async function POST(req: Request) {
  try {
    const { resume_text, job_description, company_name, referral_name } = await req.json();

    if (!resume_text || !job_description || !company_name) {
      return NextResponse.json(
        { error: "resume_text, job_description, and company_name required" },
        { status: 400 }
      );
    }

    const letter = await generateCoverLetter(resume_text, job_description, company_name, referral_name);
    return NextResponse.json({ cover_letter: letter });
  } catch (e) {
    console.error("Cover letter error:", e);
    return NextResponse.json({ error: "Failed to generate cover letter." }, { status: 500 });
  }
}
