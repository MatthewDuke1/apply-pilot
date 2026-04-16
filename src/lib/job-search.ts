import type { Job } from "./types";

const RAPIDAPI_KEY = () => process.env.RAPIDAPI_KEY || "";

export async function searchIndeed(
  query: string,
  location: string,
  page = 1
): Promise<Job[]> {
  const key = RAPIDAPI_KEY();
  if (!key) return demoJobs("indeed", query, location);

  try {
    const res = await fetch(
      `https://indeed12.p.rapidapi.com/jobs/search?query=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&page_id=${page}&locality=us&fromage=14&radius=50`,
      {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": "indeed12.p.rapidapi.com",
        },
      }
    );
    if (!res.ok) throw new Error(`Indeed API ${res.status}`);
    const data = await res.json();

    return (data.hits || []).map((hit: Record<string, unknown>) => ({
      id: `indeed-${hit.id || crypto.randomUUID()}`,
      title: String(hit.title || ""),
      company: String(hit.company_name || ""),
      location: String(hit.location || location),
      salary: hit.salary_max ? `$${hit.salary_min}–$${hit.salary_max}` : undefined,
      description: String(hit.description || ""),
      posted_date: String(hit.date_creation || new Date().toISOString()),
      source: "indeed" as const,
      source_url: String(hit.link || ""),
      company_careers_url: undefined,
    }));
  } catch (e) {
    console.error("Indeed search failed:", e);
    return demoJobs("indeed", query, location);
  }
}

export async function searchLinkedIn(
  query: string,
  location: string,
  page = 1
): Promise<Job[]> {
  const key = RAPIDAPI_KEY();
  if (!key) return demoJobs("linkedin", query, location);

  try {
    const res = await fetch(
      `https://linkedin-jobs-search.p.rapidapi.com/?search_terms=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&page=${page}&fetch_full_text=yes`,
      {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": "linkedin-jobs-search.p.rapidapi.com",
        },
      }
    );
    if (!res.ok) throw new Error(`LinkedIn API ${res.status}`);
    const data = await res.json();

    return (Array.isArray(data) ? data : []).map(
      (job: Record<string, unknown>) => ({
        id: `linkedin-${job.job_id || crypto.randomUUID()}`,
        title: String(job.job_title || ""),
        company: String(job.company_name || ""),
        location: String(job.job_location || location),
        salary: undefined,
        description: String(job.job_description || ""),
        posted_date: String(job.posted_date || new Date().toISOString()),
        source: "linkedin" as const,
        source_url: String(job.linkedin_job_url_cleaned || job.job_url || ""),
        company_careers_url: String(job.company_url || ""),
      })
    );
  } catch (e) {
    console.error("LinkedIn search failed:", e);
    return demoJobs("linkedin", query, location);
  }
}

export async function resolveCareerPage(companyName: string): Promise<string> {
  const normalized = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const guesses = [
    `https://careers.${normalized}.com`,
    `https://${normalized}.com/careers`,
    `https://jobs.${normalized}.com`,
    `https://${normalized}.com/jobs`,
    `https://www.${normalized}.com/careers`,
  ];
  for (const url of guesses) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(3000) });
      if (res.ok) return res.url;
    } catch {
      continue;
    }
  }
  return `https://www.google.com/search?q=${encodeURIComponent(companyName + " careers jobs apply")}`;
}

function demoJobs(source: "indeed" | "linkedin", query: string, location: string): Job[] {
  const now = new Date().toISOString();
  return [
    {
      id: `${source}-demo-1`,
      title: `Senior ${query}`,
      company: "Acme Corp",
      location,
      salary: "$150,000–$200,000",
      description: `We are looking for a Senior ${query} to join our growing team. You will lead cross-functional initiatives, define product roadmaps, and drive execution across engineering and design. Requirements: 5+ years in product management, strong analytical skills, experience with agile methodologies. This is a real opportunity with a dedicated hiring manager and a specific team.`,
      posted_date: now,
      source,
      source_url: `https://example.com/jobs/${source}-1`,
      company_careers_url: "https://careers.acme.com",
    },
    {
      id: `${source}-demo-2`,
      title: `${query} Lead`,
      company: "Globex Industries",
      location,
      description: `Globex Industries is always hiring talented individuals! We need someone who can do everything: product management, engineering, design, sales, marketing, data science, and machine learning. Must have 15+ years experience in all areas. PhD required. This role has been open for 6 months.`,
      posted_date: new Date(Date.now() - 45 * 86400000).toISOString(),
      source,
      source_url: `https://example.com/jobs/${source}-2`,
    },
    {
      id: `${source}-demo-3`,
      title: `${query} — AI Platform`,
      company: "Anthropic",
      location: "San Francisco, CA",
      salary: "$300,000–$400,000",
      description: `Join Anthropic's product team to shape the future of AI safety. You will own the roadmap for our API platform, work directly with researchers, and define how developers interact with Claude. Requirements: 5+ years PM experience, technical background (CS degree or equivalent), passion for AI safety. Team: Platform Product, reporting to VP Product.`,
      posted_date: now,
      source,
      source_url: "https://boards.greenhouse.io/anthropic",
      company_careers_url: "https://www.anthropic.com/careers",
    },
  ];
}
