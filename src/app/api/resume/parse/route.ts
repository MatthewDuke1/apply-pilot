import { NextResponse } from "next/server";
import pdf from "pdf-parse";
import { analyzeResume } from "@/lib/claude";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let text: string;
    if (file.name.endsWith(".pdf")) {
      const parsed = await pdf(buffer);
      text = parsed.text;
    } else if (file.name.endsWith(".txt")) {
      text = buffer.toString("utf-8");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Upload a PDF or TXT." },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });
    }

    const analysis = await analyzeResume(text);
    return NextResponse.json({ ...analysis, raw_text: text });
  } catch (e) {
    console.error("Resume parse error:", e);
    return NextResponse.json(
      { error: "Failed to parse resume. Check that ANTHROPIC_API_KEY is set." },
      { status: 500 }
    );
  }
}
