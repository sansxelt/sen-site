// GET /api/v1/tests/[id] — test status + results (once complete). Auth: API key.

import { NextResponse } from "next/server";
import { apiAuth } from "../../_auth";
import { getTestWithOptions, getReport } from "@/lib/v-db";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth(req);
  if (!auth) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });
  const { id } = await params;
  const data = await getTestWithOptions(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (data.test.user_id !== auth.userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { test } = data;
  let results = null;
  if (test.status === "complete") {
    const rep = await getReport(id);
    results = rep?.results ?? null;
  }
  return NextResponse.json({
    id: test.id, status: test.status,
    votes_valid: test.votes_valid, votes_target: test.votes_target,
    results,
  });
}
