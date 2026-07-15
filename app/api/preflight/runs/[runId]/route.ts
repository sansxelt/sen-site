// GET /api/preflight/runs/[runId] — the run POLLING payload for the RUN half of the vertical loop.
// Guards, in order: Preflight flag (404 when dark) -> session auth (401) -> owner-scoped read (404 when the
// run is not owned / not found / not migrated). The payload is owner-safe ONLY: the run header, its per-flow
// steps, and deterministic issues. It NEVER carries a provider session id, a storage path, a signed URL, or
// any lease / billing field (see getRun's enumerated SELECTs). Artifacts (screenshots, traces) are fetched
// separately through the owner-checked artifacts route, which mints a fresh short-TTL signed URL.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { getRun } from "@/lib/preflight/runs-db";
import { applicationAccessForRun } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId } = await params;

  // A run report is a READ shared with the app's workspace (VIEWER+). Resolve the run's app owner + caller
  // role; a non-member OR a client_viewer (report-only role that must never see app internals) gets a uniform
  // 404 — the run report carries deployment URL, per-step observations, and issue detail. getRun stays
  // owner-scoped, so the payload is always the app owner's run. This role gate matches every other viewer+
  // read (gatePreflightApp("viewer") likewise excludes client_viewer).
  const access = await applicationAccessForRun(email, runId);
  if (!access || !hasAtLeastRole(access.role, "viewer")) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const detail = await getRun(access.owner, runId);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
}
