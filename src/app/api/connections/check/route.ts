import { NextResponse } from "next/server";
import { findConnectionsAtCompany, getLinkedInSearchUrl } from "@/lib/linkedin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const company = searchParams.get("company") || "";
  const token = searchParams.get("token") || "";

  if (!company) {
    return NextResponse.json({ error: "company parameter required" }, { status: 400 });
  }

  const connections = await findConnectionsAtCompany(token, company);
  const searchUrl = getLinkedInSearchUrl(company);

  return NextResponse.json({ connections, searchUrl, company });
}
