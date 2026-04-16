import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/linkedin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL(`/connections?error=${error || "no_code"}`, req.url));
  }

  try {
    const token = await exchangeCodeForToken(code);
    // Pass token back to client via URL param — client stores in localStorage.
    // In production, use httpOnly cookies or a session store.
    return NextResponse.redirect(
      new URL(`/connections?token=${encodeURIComponent(token)}`, req.url)
    );
  } catch (e) {
    console.error("LinkedIn OAuth error:", e);
    return NextResponse.redirect(new URL("/connections?error=token_exchange_failed", req.url));
  }
}
