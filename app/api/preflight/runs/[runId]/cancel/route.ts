// POST /api/preflight/runs/[runId]/cancel — cooperatively request cancellation of a live run.
// Guards, in order: Preflight flag (404 when dark) -> session auth (401) -> owner-scoped mutation (404 when
// the run is not owned). It only sets cancel_requested_at=now on a NON-TERMINAL run; it never force-
// terminates. The worker observes the flag on its next ownership-checked heartbeat and aborts browser work
// itself (safe state transition). Idempotent: a re-request or an already-terminal run returns { ok: true }.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { requestRunCancel } from "@/lib/preflight/runs-db";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId } = await params;

  const result = await requestRunCancel(email.toLowerCase(), runId);
  if (result === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result === "unavailable") return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
