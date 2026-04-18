import type { Job } from "./types";

const RAPIDAPI_KEY = () => process.env.RAPIDAPI_KEY || "";
const JSEARCH_HOST = "jsearch.p.rapidapi.com";

interface JSearchJob {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  employer_website?: string;
  employer_company_type?: string;
  job_publisher?: string;
  job_employment_type?: string;
  job_apply_link?: string;
  job_apply_is_direct?: boolean;
  job_description?: string;
  job_is_remote?: boolean;
  job_posted_at_datetime_utc?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
}

/**
 * Search jobs via JSearch (RapidAPI) — aggregates Indeed, LinkedIn, Glassdoor,
 * ZipRecruiter, and others into a single endpoint. Sorted by date by default.
 */
export async function searchJobs(
  query: string,
  location: string,
  page = 1
): Promise<Job[]> {
  const key = RAPIDAPI_KEY();
  if (!key) return demoJobs(query, location);

  // JSearch supports a single "query" param that combines role + location
  const combinedQuery = location && location.toLowerCase() !== "remote"
    ? `${query} in ${location}`
    : query;

  const params = new URLSearchParams({
    query: combinedQuery,
    page: String(page),
    num_pages: "1",
    date_posted: "week",         // last 7 days — fresher than Indeed's 14
    country: "us",
  });

  if (location && location.toLowerCase() === "remote") {
    params.set("work_from_home", "true");
  }

  try {
    const res = await fetch(
      `https://${JSEARCH_HOST}/search?${params.toString()}`,
      {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": JSEARCH_HOST,
        },
      }
    );
    if (!res.ok) throw new Error(`JSearch API ${res.status}`);
    const data = await res.json();
    const jobs: JSearchJob[] = Array.isArray(data?.data) ? data.data : [];

    return jobs.map((j) => {
      const loc = [j.job_city, j.job_state].filter(Boolean).join(", ")
        || (j.job_is_remote ? "Remote" : (j.job_country || location));

      const salary = j.job_min_salary && j.job_max_salary
        ? `$${Math.round(j.job_min_salary).toLocaleString()}–$${Math.round(j.job_max_salary).toLocaleString()}`
        : undefined;

      const publisher = (j.job_publisher || "").toLowerCase();
      const source: Job["source"] = publisher.includes("indeed") ? "indeed"
        : publisher.includes("linkedin") ? "linkedin"
        : "direct";

      return {
        id: `jsearch-${j.job_id || crypto.randomUUID()}`,
        title: j.job_title || "",
        company: j.employer_name || "",
        location: loc,
        salary,
        description: j.job_description || "",
        posted_date: j.job_posted_at_datetime_utc || new Date().toISOString(),
        source,
        source_url: j.job_apply_link || "",
        company_careers_url: j.employer_website || undefined,
      };
    });
  } catch (e) {
    console.error("JSearch failed:", e);
    return demoJobs(query, location);
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

function demoJobs(query: string, location: string): Job[] {
  const now = new Date().toISOString();
  return [
    {
      id: `jsearch-demo-1`,
      title: `Senior ${query}`,
      company: "Acme Corp",
      location,
      salary: "$150,000–$200,000",
      description: `We are looking for a Senior ${query} to join our growing team. You will lead cross-functional initiatives, define product roadmaps, and drive execution across engineering and design. Requirements: 5+ years in product management, strong analytical skills, experience with agile methodologies. This is a real opportunity with a dedicated hiring manager and a specific team.`,
      posted_date: now,
      source: "direct",
      source_url: "https://example.com/jobs/demo-1",
      company_careers_url: "https://careers.acme.com",
    },
    {
      id: `jsearch-demo-2`,
      title: `${query} Lead`,
      company: "Globex Industries",
      location,
      description: `Globex Industries is always hiring talented individuals! We need someone who can do everything: product management, engineering, design, sales, marketing, data science, and machine learning. Must have 15+ years experience in all areas. PhD required. This role has been open for 6 months.`,
      posted_date: new Date(Date.now() - 45 * 86400000).toISOString(),
      source: "direct",
      source_url: "https://example.com/jobs/demo-2",
    },
    {
      id: `jsearch-demo-3`,
      title: `${query} — AI Platform`,
      company: "Anthropic",
      location: "San Francisco, CA",
      salary: "$300,000–$400,000",
      description: `Join Anthropic's product team to shape the future of AI safety. You will own the roadmap for our API platform, work directly with researchers, and define how developers interact with Claude. Requirements: 5+ years PM experience, technical background (CS degree or equivalent), passion for AI safety. Team: Platform Product, reporting to VP Product.`,
      posted_date: now,
      source: "direct",
      source_url: "https://boards.greenhouse.io/anthropic",
      company_careers_url: "https://www.anthropic.com/careers",
    },
  ];
}
