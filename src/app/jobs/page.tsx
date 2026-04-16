"use client";
import { useState, useEffect, useCallback } from "react";
import JobCard from "@/components/JobCard";
import type { Job, ResumeData } from "@/lib/types";
import { store } from "@/lib/store";

export default function JobsPage() {
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [source, setSource] = useState("both");

  useEffect(() => {
    const r = store.getResume();
    if (r) {
      setResume(r);
      setQuery(r.desired_titles[0] || "Product Manager");
      setLocation(r.location || "Remote");
    }
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, location, source });
      const res = await fetch(`/api/jobs/search?${params}`);
      const data = await res.json();
      if (res.ok) setJobs(data.jobs);
    } finally {
      setLoading(false);
    }
  }, [query, location, source]);

  function saveJob(job: Job) {
    store.saveJob(job);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Find Jobs</h1>
        <p className="text-slate-500 mt-1">
          Search Indeed and LinkedIn, get AI match scores, and apply directly to company career pages.
        </p>
      </div>

      <div className="bg-white border border-surface-border rounded-xl p-5">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Job title or keywords"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="text"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="both">Indeed + LinkedIn</option>
            <option value="indeed">Indeed only</option>
            <option value="linkedin">LinkedIn only</option>
          </select>
          <button
            onClick={search}
            disabled={loading || !query}
            className="bg-brand-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {resume && (
          <p className="text-xs text-slate-400 mt-3">
            Pre-filled from your resume. Edit above or try: {resume.desired_titles.slice(0, 4).map((t, i) => (
              <button
                key={t}
                onClick={() => setQuery(t)}
                className="text-brand-500 hover:underline ml-1"
              >
                {t}{i < Math.min(3, resume.desired_titles.length - 1) ? "," : ""}
              </button>
            ))}
          </p>
        )}
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm text-slate-500">Searching Indeed and LinkedIn...</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500 font-medium">{jobs.length} jobs found</p>
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              resumeText={resume?.raw_text}
              onSave={saveJob}
            />
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && query && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-lg">No jobs yet. Hit Search to get started.</p>
        </div>
      )}
    </div>
  );
}
