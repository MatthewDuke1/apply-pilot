"use client";
import { useState } from "react";
import type { Job } from "@/lib/types";

interface Props {
  job: Job;
  resumeText?: string;
  onSave?: (job: Job) => void;
  onApply?: (job: Job) => void;
}

export default function JobCard({ job, resumeText, onSave, onApply }: Props) {
  const [matchResult, setMatchResult] = useState<{
    score: number;
    reasons: string[];
    missing: string[];
    tailored_summary: string;
    ghost: { is_likely_ghost: boolean; confidence: number; signals: string[]; recommendation: string };
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [clLoading, setClLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function analyzeMatch() {
    if (!resumeText || matchResult) return;
    setLoading(true);
    try {
      const res = await fetch("/api/jobs/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: job.description,
          posted_date: job.posted_date,
        }),
      });
      const data = await res.json();
      if (res.ok) setMatchResult(data);
    } finally {
      setLoading(false);
    }
  }

  async function genCoverLetter() {
    if (!resumeText) return;
    setClLoading(true);
    try {
      const res = await fetch("/api/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume_text: resumeText,
          job_description: job.description,
          company_name: job.company,
        }),
      });
      const data = await res.json();
      if (res.ok) setCoverLetter(data.cover_letter);
    } finally {
      setClLoading(false);
    }
  }

  const ghost = matchResult?.ghost;
  const isGhost = ghost?.is_likely_ghost;

  return (
    <div className={`bg-white border rounded-xl p-5 transition-all ${isGhost ? "border-red-200 bg-red-50/30" : "border-surface-border hover:border-brand-300"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-slate-800 text-base">{job.title}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              job.source === "indeed" ? "bg-purple-100 text-purple-700" :
              job.source === "linkedin" ? "bg-blue-100 text-blue-700" :
              "bg-slate-100 text-slate-700"
            }`}>
              {job.source}
            </span>
            {isGhost && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                Likely ghost job
              </span>
            )}
            {matchResult && !isGhost && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                matchResult.score >= 75 ? "bg-green-100 text-green-700" :
                matchResult.score >= 50 ? "bg-yellow-100 text-yellow-700" :
                "bg-slate-100 text-slate-600"
              }`}>
                {matchResult.score}% match
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600 mt-0.5">
            <span className="font-semibold">{job.company}</span> · {job.location}
            {job.salary && <> · <span className="text-green-700 font-medium">{job.salary}</span></>}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {job.company_careers_url && (
          <a
            href={job.company_careers_url}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1 bg-brand-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors"
          >
            Apply directly on {job.company}
          </a>
        )}
        <a
          href={job.source_url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-200"
        >
          View on {job.source}
        </a>
        {resumeText && (
          <button
            onClick={analyzeMatch}
            disabled={loading || !!matchResult}
            className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg font-medium hover:bg-orange-100 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : matchResult ? "Analyzed" : "AI match score"}
          </button>
        )}
        {onSave && (
          <button
            onClick={() => onSave(job)}
            className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-200"
          >
            Save
          </button>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg font-medium hover:bg-slate-200"
        >
          {expanded ? "Less" : "More"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {job.description.slice(0, 1000)}
            {job.description.length > 1000 && "..."}
          </p>

          {matchResult && (
            <div className="space-y-2">
              {matchResult.reasons.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-green-700 mb-1">Why you match</h4>
                  <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                    {matchResult.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {matchResult.missing.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-orange-700 mb-1">Gaps to address</h4>
                  <ul className="text-xs text-slate-600 list-disc pl-4 space-y-0.5">
                    {matchResult.missing.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}
              {ghost && ghost.signals.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-red-700 mb-1">Ghost job signals</h4>
                  <ul className="text-xs text-red-600 list-disc pl-4 space-y-0.5">
                    {ghost.signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                  <p className="text-xs text-red-600 mt-1 font-semibold">Recommendation: {ghost.recommendation}</p>
                </div>
              )}
              <p className="text-xs text-slate-500 italic">{matchResult.tailored_summary}</p>
            </div>
          )}

          <div className="flex gap-2">
            {resumeText && (
              <button
                onClick={genCoverLetter}
                disabled={clLoading || !!coverLetter}
                className="text-xs bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg font-medium hover:bg-brand-100 disabled:opacity-50"
              >
                {clLoading ? "Writing..." : coverLetter ? "Generated" : "Generate cover letter"}
              </button>
            )}
            <a
              href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(job.company)}&network=%5B%22F%22%5D`}
              target="_blank"
              rel="noopener"
              className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100"
            >
              Find connections at {job.company}
            </a>
          </div>

          {coverLetter && (
            <div className="bg-slate-50 border border-surface-border rounded-lg p-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700">Cover letter</h4>
                <button
                  onClick={() => navigator.clipboard.writeText(coverLetter)}
                  className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed">{coverLetter}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
