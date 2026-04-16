import type { Connection } from "./types";

const LINKEDIN_CLIENT_ID = () => process.env.LINKEDIN_CLIENT_ID || "";
const LINKEDIN_CLIENT_SECRET = () => process.env.LINKEDIN_CLIENT_SECRET || "";
const LINKEDIN_REDIRECT_URI = () => process.env.LINKEDIN_REDIRECT_URI || "http://localhost:3000/api/auth/linkedin/callback";

export function getLinkedInAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: LINKEDIN_CLIENT_ID(),
    redirect_uri: LINKEDIN_REDIRECT_URI(),
    scope: "openid profile email",
    state: crypto.randomUUID(),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: LINKEDIN_REDIRECT_URI(),
      client_id: LINKEDIN_CLIENT_ID(),
      client_secret: LINKEDIN_CLIENT_SECRET(),
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export async function getProfile(accessToken: string) {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`LinkedIn profile fetch failed: ${res.status}`);
  return res.json();
}

export async function findConnectionsAtCompany(
  accessToken: string,
  companyName: string
): Promise<Connection[]> {
  // LinkedIn's v2 API heavily restricts connection search for most apps.
  // For apps with the "Connections" product approved, you can query:
  //   GET https://api.linkedin.com/v2/connections?q=viewer&count=500
  // Most apps won't have this, so we provide a search-link fallback.
  //
  // If RAPIDAPI_KEY is set, we can use a third-party LinkedIn people search.
  const rapidKey = process.env.RAPIDAPI_KEY;
  if (rapidKey) {
    try {
      const res = await fetch(
        `https://linkedin-data-api.p.rapidapi.com/search-people?current_company=${encodeURIComponent(companyName)}&limit=10`,
        {
          headers: {
            "x-rapidapi-key": rapidKey,
            "x-rapidapi-host": "linkedin-data-api.p.rapidapi.com",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        return (data.items || []).map((p: Record<string, string>) => ({
          name: p.full_name || p.name || "",
          headline: p.headline || "",
          company: companyName,
          profile_url: p.profile_url || p.linkedin_url || "",
          relationship: "2nd" as const,
        }));
      }
    } catch (e) {
      console.error("RapidAPI people search failed:", e);
    }
  }

  // Fallback: return a LinkedIn search link the user can click
  return [
    {
      name: `Search your connections at ${companyName}`,
      headline: "Click to search on LinkedIn",
      company: companyName,
      profile_url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}&network=%5B%22F%22%5D`,
      relationship: "1st",
    },
  ];
}

export function getLinkedInSearchUrl(companyName: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}&network=%5B%22F%22%5D`;
}
