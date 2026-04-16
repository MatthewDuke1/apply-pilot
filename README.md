# ApplyPilot — Skip the Ghost Jobs

Upload your resume, find real jobs on Indeed and LinkedIn, detect ghost postings with AI, and apply directly to company career pages. Leverage your LinkedIn network for referrals.

## The Problem

LinkedIn is full of ghost jobs — postings with no intent to fill. They exist for data harvesting, benchmarking, or compliance. You spend hours tailoring applications that vanish into a black hole. ApplyPilot fixes this by:

1. **Ghost job detection** — AI analyzes every posting for red flags (vague descriptions, impossible requirements, stale listings)
2. **Direct-to-company** — every job card links to the company's actual careers page, bypassing LinkedIn's "Easy Apply"
3. **Network leverage** — connect LinkedIn to see which jobs have connections who can refer you (referrals are 10x more effective)
4. **AI-powered matching** — your resume is analyzed and scored against each job, with specific reasons and gaps

## Features

- **Resume parsing** — upload a PDF, AI extracts skills, experience, and suggests matching job titles
- **Job search** — search Indeed and LinkedIn from one interface
- **Match scoring** — AI scores each job 0–100 against your resume with specific reasons
- **Ghost detection** — flags suspicious postings with confidence levels and red flags
- **Career page resolver** — automatically finds the company's real careers URL
- **Cover letter generator** — AI writes a tailored cover letter using your resume + the job description
- **LinkedIn connections** — find first-degree connections at target companies for referrals
- **Application tracker** — kanban-style pipeline (Saved → Applied → Referral → Interviewing → Offer)

## Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **AI:** Claude (Anthropic SDK) for resume analysis, match scoring, ghost detection, cover letters
- **Job data:** Indeed + LinkedIn via RapidAPI
- **Auth:** LinkedIn OAuth 2.0
- **Storage:** localStorage (upgrade to Supabase for persistence)

## Setup

```bash
cp .env.example .env.local
# Fill in API keys (see .env.example for details)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Required keys

| Key | Purpose | Where to get it |
|-----|---------|-----------------|
| `ANTHROPIC_API_KEY` | Resume analysis, matching, cover letters | [console.anthropic.com](https://console.anthropic.com/) |
| `RAPIDAPI_KEY` | Indeed + LinkedIn job search | [rapidapi.com](https://rapidapi.com/) |
| `LINKEDIN_CLIENT_ID` / `SECRET` | OAuth for connection matching | [LinkedIn Developer Portal](https://www.linkedin.com/developers/) |
| `NEXT_PUBLIC_SUPABASE_*` | Optional persistent storage | [supabase.com](https://supabase.com/) |

The app works in demo mode without any API keys — it shows sample jobs so you can explore the UI.
