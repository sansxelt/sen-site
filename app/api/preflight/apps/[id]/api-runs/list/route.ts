// API-beta customer route: list the API target's run history (newest first) — the repair/lineage timeline.
// GET -> { runs: [{ runId, verdict, state, createdAt }] }. Uniform 404.

import { NextResponse } from "next/server";
import { apiBetaOwner } from "@/lib/preflight/api-beta-gate";
import { getApplication } from "@/lib/v-applications";
import { getApiTarget } from "@/lib/preflight/runtime/targets-db";
import { listApiRuns } from "@/lib/preflight/runtime/api-run-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
const VERDICT: Record<string, string> = { ready: "READY", blocked: "BLOCKED", needs_review: "NEEDS REVIEW", repair_verified: "REPAIR VERIFIED", infra_failure: "COULD NOT COMPLETE", not_verified: "NOT VERIFIED" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await apiBetaOwner();
  if (!owner) return notFound();
  const { id } = await params;
  if (!(await getApplication(owner, id))) return notFound();
  const target = await getApiTarget(owner, id);
  if (!target) return NextResponse.json({ runs: [] });
  const runs = await listApiRuns(getSupabaseAdminClient(), owner, id, target.id);
  return NextResponse.json({
    runs: runs.map((r) => ({ runId: r.runId, verdict: r.decision ? (VERDICT[r.decision] ?? "NOT VERIFIED") : "NOT VERIFIED", state: r.state, createdAt: r.createdAt })),
  });
}
