"use client";
import { useState, useEffect } from "react";
import type { Application, Job } from "@/lib/types";
import { store } from "@/lib/store";

const STATUS_LABELS: Record<Application["status"], { label: string; color: string }> = {
  saved: { label: "Saved", color: "bg-slate-100 text-slate-600" },
  applied: { label: "Applied", color: "bg-blue-100 text-blue-700" },
  referral_requested: { label: "Referral sent", color: "bg-purple-100 text-purple-700" },
  interviewing: { label: "Interviewing", color: "bg-orange-100 text-orange-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600" },
  offer: { label: "Offer!", color: "bg-green-100 text-green-700" },
};

const STATUSES: Application["status"][] = [
  "saved", "applied", "referral_requested", "interviewing", "rejected", "offer",
];

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);

  useEffect(() => {
    setApps(store.getApplications());
    setSavedJobs(store.getSavedJobs());
  }, []);

  function promoteToApp(job: Job) {
    const app: Application = {
      id: job.id,
      job,
      status: "saved",
      notes: "",
    };
    store.addApplication(app);
    store.removeJob(job.id);
    setApps(store.getApplications());
    setSavedJobs(store.getSavedJobs());
  }

  function updateStatus(id: string, status: Application["status"]) {
    store.updateApplicationStatus(id, status);
    setApps(store.getApplications());
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Applications</h1>
        <p className="text-slate-500 mt-1">Track your pipeline — from saved to offer.</p>
      </div>

      {savedJobs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">Saved jobs ({savedJobs.length})</h2>
          <div className="space-y-2">
            {savedJobs.map((job) => (
              <div key={job.id} className="bg-white border border-surface-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{job.title}</p>
                  <p className="text-xs text-slate-500">{job.company} · {job.location}</p>
                </div>
                <div className="flex gap-2">
                  {job.company_careers_url && (
                    <a
                      href={job.company_careers_url}
                      target="_blank"
                      rel="noopener"
                      className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-700"
                    >
                      Apply directly
                    </a>
                  )}
                  <button
                    onClick={() => promoteToApp(job)}
                    className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200"
                  >
                    Mark as applied
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {STATUSES.map((status) => {
        const filtered = apps.filter((a) => a.status === status);
        if (filtered.length === 0) return null;
        const { label, color } = STATUS_LABELS[status];
        return (
          <div key={status}>
            <h2 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">
              {label} ({filtered.length})
            </h2>
            <div className="space-y-2">
              {filtered.map((app) => (
                <div key={app.id} className="bg-white border border-surface-border rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
                      {label}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{app.job.title}</p>
                      <p className="text-xs text-slate-500">
                        {app.job.company} · {app.job.location}
                        {app.applied_date && <> · Applied {new Date(app.applied_date).toLocaleDateString()}</>}
                      </p>
                    </div>
                  </div>
                  <select
                    value={app.status}
                    onChange={(e) => updateStatus(app.id, e.target.value as Application["status"])}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s].label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {apps.length === 0 && savedJobs.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg mb-2">No applications yet</p>
          <p className="text-sm">
            <a href="/jobs" className="text-brand-500 hover:underline">Search for jobs</a> and save them to start tracking.
          </p>
        </div>
      )}
    </div>
  );
}
