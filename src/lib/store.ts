import type { ResumeData, Job, Application } from "./types";

const RESUME_KEY = "ap_resume";
const JOBS_KEY = "ap_saved_jobs";
const APPS_KEY = "ap_applications";
const TOKEN_KEY = "ap_linkedin_token";

function get<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function set<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Storage write failed:", e);
  }
}

export const store = {
  getResume: () => get<ResumeData>(RESUME_KEY),
  setResume: (r: ResumeData) => set(RESUME_KEY, r),

  getSavedJobs: () => get<Job[]>(JOBS_KEY) || [],
  saveJob: (job: Job) => {
    const jobs = get<Job[]>(JOBS_KEY) || [];
    if (!jobs.find((j) => j.id === job.id)) {
      jobs.push(job);
      set(JOBS_KEY, jobs);
    }
  },
  removeJob: (id: string) => {
    const jobs = (get<Job[]>(JOBS_KEY) || []).filter((j) => j.id !== id);
    set(JOBS_KEY, jobs);
  },

  getApplications: () => get<Application[]>(APPS_KEY) || [],
  addApplication: (app: Application) => {
    const apps = get<Application[]>(APPS_KEY) || [];
    const existing = apps.findIndex((a) => a.id === app.id);
    if (existing >= 0) apps[existing] = app;
    else apps.push(app);
    set(APPS_KEY, apps);
  },
  updateApplicationStatus: (id: string, status: Application["status"]) => {
    const apps = get<Application[]>(APPS_KEY) || [];
    const app = apps.find((a) => a.id === id);
    if (app) {
      app.status = status;
      set(APPS_KEY, apps);
    }
  },

  getLinkedInToken: () => get<string>(TOKEN_KEY),
  setLinkedInToken: (t: string) => set(TOKEN_KEY, t),
  clearLinkedInToken: () => {
    if (typeof window !== "undefined") localStorage.removeItem(TOKEN_KEY);
  },
};
