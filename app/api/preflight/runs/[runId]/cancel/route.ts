// POST /api/preflight/runs/[runId]/cancel — cooperatively request cancellation of a live run.
// Guards, in order: Preflight flag (404 when dark) -> session auth (401) -> owner-scoped mutation (404 when
// the run is not owned). It only sets cancel_requested_at=now on a NON-TERMINAL run; it never force-
// terminates. The worker observes the flag on its next ownership-checked heartbeat and aborts browser work
// itself (safe state transition). Idempotent: a re-request or an already-terminal run returns { ok: true }.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { requestRunCancel } from "@/lib/preflight/runs-db";
import { applicationAccessForRun } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId } = await params;

  // Cancelling a live run is an EDITOR+ action. Resolve the run's app owner; a view-only member is
  // forbidden, a non-member gets a uniform 404. requestRunCancel stays owner-scoped.
  const access = await applicationAccessForRun(email, runId);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application." }, { status: 403 });
  const result = await requestRunCancel(access.owner, runId);
  if (result === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (result === "unavailable") return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
