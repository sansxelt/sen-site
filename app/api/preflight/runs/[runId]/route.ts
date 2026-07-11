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

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId } = await params;

  const detail = await getRun(email.toLowerCase(), runId);
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(detail, { headers: { "cache-control": "no-store" } });
}
