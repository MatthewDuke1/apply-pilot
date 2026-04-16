"use client";
import { useState, useEffect } from "react";
import { store } from "@/lib/store";
import type { Job } from "@/lib/types";

export default function ConnectionsPage() {
  const [token, setToken] = useState("");
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [connectionResults, setConnectionResults] = useState<Record<string, { connections: { name: string; headline: string; profile_url: string }[]; searchUrl: string }>>({});
  const [checking, setChecking] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken) {
      store.setLinkedInToken(urlToken);
      setToken(urlToken);
      window.history.replaceState({}, "", "/connections");
    } else {
      const saved = store.getLinkedInToken();
      if (saved) setToken(saved);
    }
    setSavedJobs(store.getSavedJobs());
  }, []);

  async function checkConnections(company: string) {
    setChecking(company);
    try {
      const params = new URLSearchParams({ company, token });
      const res = await fetch(`/api/connections/check?${params}`);
      const data = await res.json();
      if (res.ok) {
        setConnectionResults((prev) => ({ ...prev, [company]: data }));
      }
    } finally {
      setChecking(null);
    }
  }

  const uniqueCompanies = [...new Set(savedJobs.map((j) => j.company))];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Network</h1>
        <p className="text-slate-500 mt-1">
          Find connections at companies you're targeting. A referral is 10x more likely to lead to a hire.
        </p>
      </div>

      <div className="bg-white border border-surface-border rounded-xl p-6">
        <h2 className="font-bold text-slate-700 mb-3">LinkedIn connection</h2>
        {token ? (
          <div className="flex items-center gap-3">
            <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
              Connected
            </span>
            <button
              onClick={() => { store.clearLinkedInToken(); setToken(""); }}
              className="text-xs text-slate-500 hover:text-red-500"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-slate-500 mb-3">
              Connect your LinkedIn to automatically find first-degree connections at target companies.
            </p>
            <a
              href="/api/auth/linkedin"
              className="bg-[#0A66C2] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#004182] transition-colors inline-block"
            >
              Connect with LinkedIn
            </a>
            <p className="text-xs text-slate-400 mt-2">
              No LinkedIn app configured? You can still use the manual search links below.
            </p>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-bold text-slate-600 mb-3 uppercase tracking-wide">
          Search connections by company
        </h2>

        {uniqueCompanies.length > 0 ? (
          <div className="space-y-3">
            {uniqueCompanies.map((company) => (
              <div key={company} className="bg-white border border-surface-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800 text-sm">{company}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => checkConnections(company)}
                      disabled={checking === company}
                      className="text-xs bg-brand-50 text-brand-700 px-3 py-1.5 rounded-lg font-medium hover:bg-brand-100 disabled:opacity-50"
                    >
                      {checking === company ? "Checking..." : "Find connections"}
                    </button>
                    <a
                      href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company)}&network=%5B%22F%22%5D`}
                      target="_blank"
                      rel="noopener"
                      className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100"
                    >
                      Search on LinkedIn
                    </a>
                  </div>
                </div>

                {connectionResults[company] && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {connectionResults[company].connections.map((c, i) => (
                      <a
                        key={i}
                        href={c.profile_url}
                        target="_blank"
                        rel="noopener"
                        className="block text-sm text-slate-600 hover:text-brand-600 py-1"
                      >
                        <span className="font-medium text-slate-800">{c.name}</span>
                        {c.headline && <> — {c.headline}</>}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Save some jobs first and your target companies will appear here.</p>
            <a href="/jobs" className="text-brand-500 hover:underline text-sm mt-1 inline-block">
              Find jobs
            </a>
          </div>
        )}
      </div>

      <div className="bg-white border border-surface-border rounded-xl p-6">
        <h2 className="font-bold text-slate-700 mb-2">Manual company search</h2>
        <p className="text-sm text-slate-500 mb-3">Type any company name to find your connections there.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = (e.target as HTMLFormElement).elements.namedItem("company") as HTMLInputElement;
            if (input.value.trim()) checkConnections(input.value.trim());
          }}
          className="flex gap-2"
        >
          <input
            name="company"
            type="text"
            placeholder="Company name (e.g. Anthropic)"
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
}
