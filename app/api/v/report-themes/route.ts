// GET /api/v/report-themes?id=<testId> — owner-only. Lazily generates (and caches)
// the AI theme summary for a completed test and returns it. Pulled out of the
// report render so the page loads instantly and the client shows a loading / retry
// state. Summarization only: themes never affect the recommendation or any number.
// Caching + all fail-soft paths live in ensureReportThemes.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTestWithOptions, ensureReportThemes } from "@/lib/v-db";

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
  if (data.test.status !== "complete") return NextResponse.json({ themes: null, pending: true });

  const rep = await ensureReportThemes(id);
  return NextResponse.json({ themes: rep?.results?.themes ?? null });
}
