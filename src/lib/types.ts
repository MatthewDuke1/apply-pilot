export interface ResumeData {
  raw_text: string;
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: string[];
  certifications: string[];
  desired_titles: string[];
  desired_industries: string[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  description: string;
  posted_date: string;
  source: "indeed" | "linkedin" | "direct";
  source_url: string;
  company_careers_url?: string;
  match_score?: number;
  match_reasons?: string[];
  is_ghost_job?: boolean;
  ghost_signals?: string[];
}

export interface Connection {
  name: string;
  headline: string;
  company: string;
  profile_url: string;
  relationship: "1st" | "2nd" | "3rd";
}

export interface Application {
  id: string;
  job: Job;
  status: "saved" | "applied" | "referral_requested" | "interviewing" | "rejected" | "offer";
  applied_date?: string;
  notes: string;
  referral_contact?: Connection;
  cover_letter?: string;
  resume_version?: string;
  auto_applied?: boolean;
}

export interface AutoApplyConfig {
  id?: string;
  enabled: boolean;
  daily_limit: number;
  min_match_score: number;
  search_queries: string[];
  location: string;
  report_email: string;
  resume_text: string;
  resume_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface AutoApplyRun {
  id?: string;
  started_at: string;
  completed_at?: string;
  jobs_searched: number;
  jobs_matched: number;
  jobs_applied: number;
  jobs_skipped_ghost: number;
  jobs_skipped_score: number;
  jobs_skipped_duplicate: number;
  errors: string[];
  applications: AutoAppliedJob[];
}

export interface AutoAppliedJob {
  job: Job;
  match_score: number;
  match_reasons: string[];
  cover_letter: string;
  applied_at: string;
  career_page_url: string;
}
