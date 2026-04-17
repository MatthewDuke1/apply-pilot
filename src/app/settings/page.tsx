"use client";
import { useState, useEffect } from "react";
import type { AutoApplyConfig, AutoApplyRun } from "@/lib/types";
import { store } from "@/lib/store";

const DEFAULT_CONFIG: AutoApplyConfig = {
  enabled: false,
  daily_limit: 10,
  min_match_score: 60,
  search_queries: [],
  location: "Remote",
  report_email: "",
  resume_text: "",
  resume_name: "",
};

export default function SettingsPage() {
  const [config, setConfig] = useState<AutoApplyConfig>(DEFAULT_CONFIG);
  const [runs, setRuns] = useState<AutoApplyRun[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/auto-apply");
      const data = await res.json();
      if (data.config) {
        setConfig(data.config);
      } else {
        // Pre-fill from localStorage resume if available
        const resume = store.getResume();
        if (resume) {
          setConfig((prev) => ({
            ...prev,
            resume_text: resume.raw_text,
            resume_name: resume.name,
            search_queries: resume.desired_titles.slice(0, 5),
            report_email: resume.email || "",
          }));
        }
      }
      if (data.runs) setRuns(data.runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    // Sync resume from localStorage if not already set
    if (!config.resume_text) {
      const resume = store.getResume();
      if (resume) {
        config.resume_text = resume.raw_text;
        config.resume_name = resume.name;
      }
    }

    try {
      const res = await fetch("/api/settings/auto-apply", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  async function handleTrigger() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/cron/auto-apply");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTriggerResult(
        `Applied to ${data.summary.jobs_applied} jobs out of ${data.summary.jobs_searched} searched (${data.summary.jobs_skipped_ghost} ghosts blocked)`
      );
      loadSettings(); // Refresh runs
    } catch (e) {
      setTriggerResult(`Error: ${e instanceof Error ? e.message : "Failed"}`);
    }
    setTriggering(false);
  }

  function addQuery() {
    const q = newQuery.trim();
    if (q && !config.search_queries.includes(q)) {
      setConfig((prev) => ({ ...prev, search_queries: [...prev.search_queries, q] }));
      setNewQuery("");
    }
  }

  function removeQuery(q: string) {
    setConfig((prev) => ({
      ...prev,
      search_queries: prev.search_queries.filter((x) => x !== q),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Auto-Apply Settings</h1>
        <p className="text-slate-500 mt-1">
          Configure automated job applications. ApplyPilot searches for jobs daily, scores them against your resume, and prepares applications for the best matches.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Enable/Disable */}
      <div className="bg-white border border-surface-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">Auto-Apply</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              When enabled, runs daily to find and apply to matching jobs
            </p>
          </div>
          <button
            onClick={() => setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              config.enabled ? "bg-brand-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                config.enabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Search Queries */}
      <div className="bg-white border border-surface-border rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-bold text-slate-800">Search Queries</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Job titles or keywords to search for. Each query searches both Indeed and LinkedIn.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.search_queries.map((q) => (
            <span
              key={q}
              className="inline-flex items-center gap-1.5 bg-brand-50 text-brand-700 text-sm px-3 py-1.5 rounded-full"
            >
              {q}
              <button
                onClick={() => removeQuery(q)}
                className="text-brand-400 hover:text-red-500 text-xs font-bold"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addQuery()}
            placeholder="e.g. Product Manager, Software Engineer..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={addQuery}
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* Parameters */}
      <div className="bg-white border border-surface-border rounded-xl p-6 space-y-5">
        <h2 className="font-bold text-slate-800">Parameters</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Daily limit</label>
            <input
              type="number"
              min={1}
              max={50}
              value={config.daily_limit}
              onChange={(e) => setConfig((prev) => ({ ...prev, daily_limit: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mt-1">Max applications per day</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Min match score</label>
            <input
              type="number"
              min={0}
              max={100}
              value={config.min_match_score}
              onChange={(e) => setConfig((prev) => ({ ...prev, min_match_score: Number(e.target.value) }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mt-1">Jobs below this score are skipped</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
          <input
            type="text"
            value={config.location}
            onChange={(e) => setConfig((prev) => ({ ...prev, location: e.target.value }))}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Report email</label>
          <input
            type="email"
            value={config.report_email}
            onChange={(e) => setConfig((prev) => ({ ...prev, report_email: e.target.value }))}
            placeholder="you@email.com"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <p className="text-xs text-slate-400 mt-1">Daily summary sent here every evening</p>
        </div>
      </div>

      {/* Resume Status */}
      <div className="bg-white border border-surface-border rounded-xl p-6">
        <h2 className="font-bold text-slate-800 mb-2">Resume</h2>
        {config.resume_text ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-sm font-bold">R</span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{config.resume_name || "Resume uploaded"}</p>
              <p className="text-xs text-slate-400">{config.resume_text.length.toLocaleString()} characters</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-amber-600">
            No resume synced. <a href="/" className="underline">Upload one on the dashboard</a> first, then return here.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-brand-700 disabled:opacity-50 text-sm"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save settings"}
        </button>
        <button
          onClick={handleTrigger}
          disabled={triggering || !config.enabled}
          className="bg-slate-100 text-slate-700 px-6 py-2.5 rounded-lg font-semibold hover:bg-slate-200 disabled:opacity-50 text-sm"
        >
          {triggering ? "Running..." : "Run now"}
        </button>
      </div>

      {triggerResult && (
        <div className={`rounded-lg p-4 text-sm ${
          triggerResult.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
        }`}>
          {triggerResult}
        </div>
      )}

      {/* Recent Runs */}
      {runs.length > 0 && (
        <div className="bg-white border border-surface-border rounded-xl p-6">
          <h2 className="font-bold text-slate-800 mb-4">Recent Runs (last 7 days)</h2>
          <div className="space-y-3">
            {runs.map((run, i) => (
              <div key={run.id || i} className="border border-slate-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">
                    {new Date(run.started_at).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    run.jobs_applied > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {run.jobs_applied} applied
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-500">
                  <div>Searched: <span className="font-semibold text-slate-700">{run.jobs_searched}</span></div>
                  <div>Matched: <span className="font-semibold text-slate-700">{run.jobs_matched}</span></div>
                  <div>Ghosts: <span className="font-semibold text-red-600">{run.jobs_skipped_ghost}</span></div>
                  <div>Low score: <span className="font-semibold text-amber-600">{run.jobs_skipped_score}</span></div>
                </div>
                {run.errors.length > 0 && (
                  <p className="text-xs text-red-500 mt-2">{run.errors.length} error(s)</p>
                )}
                {run.applications.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {run.applications.map((app, j) => (
                      <div key={j} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {app.job.title} — <span className="text-slate-400">{app.job.company}</span>
                        </span>
                        <span className={`font-semibold ${
                          app.match_score >= 75 ? "text-green-600" : app.match_score >= 50 ? "text-amber-600" : "text-slate-500"
                        }`}>
                          {app.match_score}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
