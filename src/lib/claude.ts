import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function analyzeResume(text: string) {
  const msg = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Parse this resume and return a JSON object with these fields:
- name (string)
- email (string)
- phone (string)
- location (string)
- summary (string, 2 sentence professional summary)
- skills (string array)
- experience (array of {title, company, dates, bullets: string[]})
- education (string array)
- certifications (string array)
- desired_titles (string array — infer 5-8 job titles this person would be a strong match for)
- desired_industries (string array — infer 3-5 industries)

Return ONLY valid JSON, no markdown fences.

Resume text:
${text}`,
      },
    ],
  });
  const content = msg.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return JSON.parse(content.text);
}

export async function scoreJobMatch(resumeText: string, jobDescription: string) {
  const msg = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Compare this resume against the job description. Return JSON:
- score (0-100 integer, how well the candidate matches)
- reasons (string array, 3-5 bullet reasons for the score)
- missing (string array, key qualifications the candidate lacks)
- ghost_signals (string array, any signs this might be a ghost job: vague descriptions, unrealistic requirements, "always hiring", no specific team mentioned, posted > 30 days ago, etc. Empty array if it looks legitimate.)
- tailored_summary (string, a 2-sentence pitch this candidate could use in a cover letter for THIS specific role)

Return ONLY valid JSON.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}`,
      },
    ],
  });
  const content = msg.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return JSON.parse(content.text);
}

export async function generateCoverLetter(
  resumeText: string,
  jobDescription: string,
  companyName: string,
  referralName?: string
) {
  const referralLine = referralName
    ? `The candidate has a connection named ${referralName} at the company — weave in a brief, natural mention that ${referralName} recommended they apply.`
    : "";

  const msg = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Write a concise, compelling cover letter for this candidate applying to ${companyName}.
${referralLine}
Tone: confident, specific, not generic. Reference real experience from the resume that maps to the job requirements. Keep it under 300 words.

Return ONLY the cover letter text, no metadata.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}`,
      },
    ],
  });
  const content = msg.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return content.text;
}

export async function detectGhostJob(jobDescription: string, postedDate: string) {
  const msg = await getClient().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Analyze this job posting for ghost job signals. Ghost jobs are postings that companies put up with no intent to fill — they exist for data harvesting, benchmarking, or compliance reasons.

Red flags include:
- Vague or impossibly broad requirements
- "Always open" or re-posted every few weeks
- No specific team, manager, or project mentioned
- Unrealistic combination of skills (e.g., "10 years Swift + 10 years Kubernetes + PhD required")
- Posted more than 30 days ago with no updates
- Company is in a hiring freeze or recently did layoffs
- Generic copy-paste description with no company-specific details

Return JSON:
- is_likely_ghost (boolean)
- confidence (0-100)
- signals (string array of specific red flags found, empty if none)
- recommendation (string — "apply", "apply with caution", or "skip")

Return ONLY valid JSON.

Posted date: ${postedDate}
Today: ${new Date().toISOString().slice(0, 10)}

JOB POSTING:
${jobDescription}`,
      },
    ],
  });
  const content = msg.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");
  return JSON.parse(content.text);
}
