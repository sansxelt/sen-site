// GET /api/v/report-analysis?id=<testId> — owner-only. Lazily generates (and
// caches) the AI analysis for a completed test and returns it. Pulled out of the
// report render so the page loads instantly and the client can show a polished
// loading / retry state. Caching lives in ensureReportAnalysis (unchanged).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTestWithOptions, ensureReportAnalysis } from "@/lib/v-db";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";

  const data = await getTestWithOptions(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.test.user_id !== email.trim().toLowerCase()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (data.test.status !== "complete") return NextResponse.json({ analysis: null, pending: true });

  const rep = await ensureReportAnalysis(id);
  return NextResponse.json({ analysis: rep?.results?.analysis ?? null });
}
