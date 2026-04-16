"use client";
import { useState, useEffect } from "react";
import ResumeUpload from "@/components/ResumeUpload";
import ResumeCard from "@/components/ResumeCard";
import type { ResumeData } from "@/lib/types";
import { store } from "@/lib/store";

export default function DashboardPage() {
  const [resume, setResume] = useState<ResumeData | null>(null);

  useEffect(() => {
    const saved = store.getResume();
    if (saved) setResume(saved);
  }, []);

  function handleParsed(data: ResumeData) {
    setResume(data);
    store.setResume(data);
  }

  const stats = {
    saved: store.getSavedJobs().length,
    applied: store.getApplications().filter((a) => a.status !== "saved").length,
    interviewing: store.getApplications().filter((a) => a.status === "interviewing").length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 mt-1">Upload your resume, find real jobs, skip the ghost postings, apply directly.</p>
      </div>

      {!resume ? (
        <ResumeUpload onParsed={handleParsed} />
      ) : (
        <>
          <ResumeCard resume={resume} />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-surface-border rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-brand-600">{stats.saved}</div>
              <div className="text-sm text-slate-500 mt-1">Saved jobs</div>
            </div>
            <div className="bg-white border border-surface-border rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-green-600">{stats.applied}</div>
              <div className="text-sm text-slate-500 mt-1">Applied</div>
            </div>
            <div className="bg-white border border-surface-border rounded-xl p-5 text-center">
              <div className="text-3xl font-bold text-orange-600">{stats.interviewing}</div>
              <div className="text-sm text-slate-500 mt-1">Interviewing</div>
            </div>
          </div>

          <div className="flex gap-3">
            <a
              href="/jobs"
              className="bg-brand-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-brand-700 transition-colors text-sm"
            >
              Find jobs matching your resume
            </a>
            <button
              onClick={() => { setResume(null); localStorage.removeItem("ap_resume"); }}
              className="text-sm text-slate-500 hover:text-red-500 px-3 py-2.5"
            >
              Upload different resume
            </button>
          </div>
        </>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-bold text-amber-800 text-sm mb-2">Why ApplyPilot?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-amber-700">
          <div>
            <span className="font-bold">Ghost job detection.</span> AI analyzes every posting for red flags — vague descriptions, impossible requirements, stale listings — so you don't waste time on jobs that don't exist.
          </div>
          <div>
            <span className="font-bold">Direct-to-company.</span> Every job card links to the company's actual careers page. Bypass LinkedIn's "Easy Apply" black hole and land in a real ATS.
          </div>
          <div>
            <span className="font-bold">Network leverage.</span> Connect LinkedIn to see which jobs have first-degree connections who can refer you. A referral is 10x more likely to lead to a hire.
          </div>
        </div>
      </div>
    </div>
  );
}
