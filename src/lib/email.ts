import type { AutoApplyRun } from "./types";

const RESEND_API_KEY = () => process.env.RESEND_API_KEY || "";
const FROM_EMAIL = "ApplyPilot <onboarding@resend.dev>";

export async function sendDailyReport(
  toEmail: string,
  runs: AutoApplyRun[],
  date: string
): Promise<boolean> {
  const key = RESEND_API_KEY();
  if (!key) {
    console.error("RESEND_API_KEY not set — skipping daily report email");
    return false;
  }

  const totalSearched = runs.reduce((s, r) => s + r.jobs_searched, 0);
  const totalApplied = runs.reduce((s, r) => s + r.jobs_applied, 0);
  const totalGhosts = runs.reduce((s, r) => s + r.jobs_skipped_ghost, 0);
  const totalLowScore = runs.reduce((s, r) => s + r.jobs_skipped_score, 0);
  const totalDuplicates = runs.reduce((s, r) => s + r.jobs_skipped_duplicate, 0);
  const allApps = runs.flatMap((r) => r.applications);
  const allErrors = runs.flatMap((r) => r.errors);
  const avgScore = allApps.length > 0
    ? Math.round(allApps.reduce((s, a) => s + a.match_score, 0) / allApps.length)
    : 0;

  const jobRows = allApps
    .map(
      (app) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">
          <strong>${escHtml(app.job.title)}</strong><br>
          <span style="color:#64748b;font-size:13px;">${escHtml(app.job.company)} · ${escHtml(app.job.location)}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <span style="background:${app.match_score >= 75 ? '#dcfce7' : app.match_score >= 50 ? '#fef9c3' : '#fee2e2'};
                       color:${app.match_score >= 75 ? '#166534' : app.match_score >= 50 ? '#854d0e' : '#991b1b'};
                       padding:2px 10px;border-radius:12px;font-weight:600;font-size:13px;">
            ${app.match_score}%
          </span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">
          <a href="${escHtml(app.career_page_url)}" style="color:#2563eb;text-decoration:none;font-size:13px;">Apply page</a>
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:24px 32px;color:white;">
      <h1 style="margin:0;font-size:22px;">ApplyPilot Daily Report</h1>
      <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">${date}</p>
    </div>

    <div style="padding:24px 32px;">
      <div style="display:flex;gap:12px;margin-bottom:24px;">
        <div style="flex:1;background:#eff6ff;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#2563eb;">${totalApplied}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Jobs Applied</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${avgScore}%</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Avg Match</div>
        </div>
        <div style="flex:1;background:#fef2f2;border-radius:8px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${totalGhosts}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Ghosts Blocked</div>
        </div>
      </div>

      <table style="width:100%;font-size:13px;color:#334155;margin-bottom:8px;">
        <tr><td style="padding:4px 0;">Jobs searched</td><td style="text-align:right;font-weight:600;">${totalSearched}</td></tr>
        <tr><td style="padding:4px 0;">Below match threshold</td><td style="text-align:right;font-weight:600;">${totalLowScore}</td></tr>
        <tr><td style="padding:4px 0;">Already applied (skipped)</td><td style="text-align:right;font-weight:600;">${totalDuplicates}</td></tr>
      </table>

      ${allApps.length > 0 ? `
      <h2 style="font-size:16px;color:#1e293b;margin:24px 0 12px;">Jobs Applied Today</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Job</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;">Match</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase;">Link</th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>
      ` : `
      <p style="color:#94a3b8;text-align:center;padding:20px;font-size:14px;">No jobs were applied to today. Check your search queries or lower the match threshold.</p>
      `}

      ${allErrors.length > 0 ? `
      <div style="margin-top:20px;background:#fef2f2;border-radius:8px;padding:12px 16px;">
        <p style="font-size:13px;font-weight:600;color:#991b1b;margin:0 0 8px;">Errors (${allErrors.length})</p>
        ${allErrors.map((e) => `<p style="font-size:12px;color:#7f1d1d;margin:2px 0;">${escHtml(e)}</p>`).join("")}
      </div>
      ` : ""}
    </div>

    <div style="background:#f8fafc;padding:16px 32px;text-align:center;font-size:12px;color:#94a3b8;">
      Sent by ApplyPilot auto-apply. <a href="#" style="color:#2563eb;">Manage settings</a>
    </div>
  </div>
</body>
</html>`;

  const textContent = [
    `ApplyPilot Daily Report — ${date}`,
    "",
    `Jobs Applied: ${totalApplied}`,
    `Avg Match Score: ${avgScore}%`,
    `Ghost Jobs Blocked: ${totalGhosts}`,
    `Jobs Searched: ${totalSearched}`,
    `Below Threshold: ${totalLowScore}`,
    `Duplicates Skipped: ${totalDuplicates}`,
    "",
    ...allApps.map(
      (app) => `- ${app.job.title} at ${app.job.company} (${app.match_score}%) — ${app.career_page_url}`
    ),
    ...(allErrors.length > 0 ? ["", "Errors:", ...allErrors.map((e) => `  - ${e}`)] : []),
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: `ApplyPilot: ${totalApplied} job${totalApplied !== 1 ? "s" : ""} applied — ${date}`,
        html,
        text: textContent,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("Resend API error:", res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Failed to send email:", e);
    return false;
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
