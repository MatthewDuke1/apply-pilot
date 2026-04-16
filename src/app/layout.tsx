import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyPilot — Skip the Ghost Jobs",
  description: "Upload your resume, find real jobs, apply directly to company sites, and leverage your network for referrals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="border-b border-surface-border bg-white sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-brand-700 tracking-tight">ApplyPilot</a>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
              <a href="/" className="hover:text-brand-600">Dashboard</a>
              <a href="/jobs" className="hover:text-brand-600">Find Jobs</a>
              <a href="/applications" className="hover:text-brand-600">Applications</a>
              <a href="/connections" className="hover:text-brand-600">Network</a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
