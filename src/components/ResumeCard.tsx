"use client";
import type { ResumeData } from "@/lib/types";

export default function ResumeCard({ resume }: { resume: ResumeData }) {
  return (
    <div className="bg-white border border-surface-border rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{resume.name}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {[resume.location, resume.email, resume.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
          Resume loaded
        </span>
      </div>

      <p className="text-sm text-slate-600 mb-4">{resume.summary}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-700 mb-1.5">Top skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.slice(0, 12).map((s) => (
              <span key={s} className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded text-xs font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-700 mb-1.5">AI-suggested job titles</h3>
          <div className="flex flex-wrap gap-1.5">
            {resume.desired_titles.map((t) => (
              <span key={t} className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-semibold text-slate-700 mb-1.5 text-sm">Experience</h3>
        <div className="space-y-1">
          {resume.experience.map((exp, i) => (
            <div key={i} className="text-xs text-slate-500">
              <span className="font-medium text-slate-700">{exp.title}</span> · {exp.company} · {exp.dates}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
