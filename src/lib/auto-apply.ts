import { searchJobs, resolveCareerPage } from "./job-search";
import { scoreJobMatch, detectGhostJob, generateCoverLetter } from "./claude";
import { getAutoApplyConfig, saveAutoApplyRun, getAppliedJobIds } from "./db";
import type { Job, AutoApplyRun, AutoAppliedJob } from "./types";

export async function runAutoApply(): Promise<AutoApplyRun> {
  const run: AutoApplyRun = {
    started_at: new Date().toISOString(),
    jobs_searched: 0,
    jobs_matched: 0,
    jobs_applied: 0,
    jobs_skipped_ghost: 0,
    jobs_skipped_score: 0,
    jobs_skipped_duplicate: 0,
    errors: [],
    applications: [],
  };

  try {
    const config = await getAutoApplyConfig();
    if (!config || !config.enabled) {
      run.errors.push("Auto-apply is disabled or not configured");
      run.completed_at = new Date().toISOString();
      return run;
    }

    if (!config.resume_text) {
      run.errors.push("No resume uploaded — cannot auto-apply");
      run.completed_at = new Date().toISOString();
      return run;
    }

    // 1. Get already-applied job IDs to avoid duplicates
    const appliedIds = await getAppliedJobIds();

    // 2. Search for jobs across all configured queries (JSearch aggregates
    //    Indeed, LinkedIn, Glassdoor, ZipRecruiter in a single call per query)
    const allJobs: Job[] = [];
    for (const query of config.search_queries) {
      try {
        const results = await searchJobs(query, config.location);
        allJobs.push(...results);
      } catch (e) {
        run.errors.push(`Search failed for "${query}": ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Deduplicate by title|company
    const seen = new Set<string>();
    const uniqueJobs = allJobs.filter((job) => {
      const key = `${job.title.toLowerCase()}|${job.company.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    run.jobs_searched = uniqueJobs.length;

    // Filter out already-applied jobs
    const newJobs = uniqueJobs.filter((job) => {
      if (appliedIds.has(job.id)) {
        run.jobs_skipped_duplicate++;
        return false;
      }
      return true;
    });

    // 3. Sort by posted_date — newest first (early applications get priority)
    newJobs.sort((a, b) => {
      const da = new Date(a.posted_date).getTime();
      const db = new Date(b.posted_date).getTime();
      return db - da; // newest first
    });

    // 4. Process jobs up to daily limit
    const toProcess = newJobs.slice(0, config.daily_limit * 3); // evaluate 3x limit to find enough good matches

    for (const job of toProcess) {
      if (run.jobs_applied >= config.daily_limit) break;

      try {
        // Score and ghost-check in parallel
        const [matchResult, ghostResult] = await Promise.all([
          scoreJobMatch(config.resume_text, job.description),
          detectGhostJob(job.description, job.posted_date),
        ]);

        // Skip ghost jobs
        if (ghostResult.is_likely_ghost && ghostResult.recommendation === "skip") {
          run.jobs_skipped_ghost++;
          continue;
        }

        // Skip low match scores
        const score = matchResult.score as number;
        if (score < config.min_match_score) {
          run.jobs_skipped_score++;
          continue;
        }

        run.jobs_matched++;

        // Resolve career page URL
        const careerUrl = job.company_careers_url || await resolveCareerPage(job.company);

        // Generate cover letter
        const coverLetter = await generateCoverLetter(
          config.resume_text,
          job.description,
          job.company
        );

        const appliedJob: AutoAppliedJob = {
          job: {
            ...job,
            match_score: score,
            match_reasons: matchResult.reasons,
            is_ghost_job: ghostResult.is_likely_ghost,
            ghost_signals: ghostResult.signals,
            company_careers_url: careerUrl,
          },
          match_score: score,
          match_reasons: matchResult.reasons,
          cover_letter: coverLetter,
          applied_at: new Date().toISOString(),
          career_page_url: careerUrl,
        };

        run.applications.push(appliedJob);
        run.jobs_applied++;
      } catch (e) {
        run.errors.push(
          `Failed processing "${job.title}" at ${job.company}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  } catch (e) {
    run.errors.push(`Fatal error: ${e instanceof Error ? e.message : String(e)}`);
  }

  run.completed_at = new Date().toISOString();

  // Persist the run
  try {
    await saveAutoApplyRun(run);
  } catch (e) {
    console.error("Failed to save auto-apply run:", e);
  }

  return run;
}
