// GET /api/v1/tests/[id] — evaluation status + results (once complete). Auth: API key.

import { apiAuth } from "../../_auth";
import { apiError } from "../../_lib";
import { getTestWithOptions, getReport, updateTestMeta, completeTest } from "@/lib/v-db";
import { buildDecisionPackage } from "@/lib/v-decision-package";

export const runtime = "nodejs";

const EDITABLE_STATES = new Set(["draft", "active"]);
// Fields that must NEVER be changed through this endpoint (escrow/plan/tenant/
// voting-integrity). Present-but-forbidden keys fail loudly, never silently dropped.
const FORBIDDEN = ["credits", "credits_held", "votes", "votes_target", "user_id",
  "owner", "workspace_id", "org_id", "category", "audience", "target_audience",
  "options", "project_id", "share_token", "share_enabled", "is_sandbox", "status_force"];

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth(req, "tests:read");
  if (!a.ok) return a.response;
  const { id } = await params;
  const data = await getTestWithOptions(id);
  if (!data) return apiError("not_found", "No evaluation with that id.", 404);
  if (data.test.user_id !== a.userId) return apiError("forbidden", "This evaluation belongs to another account.", 403);

  const { test } = data;
  let results = null;
  if (test.status === "complete") {
    const rep = await getReport(id);
    results = rep?.results ?? null;
  }
  // Additive: the full Decision Package for the (owned) evaluation. Old clients
  // that read `results` are unaffected.
  const decision_package = await buildDecisionPackage(id, "scale");
  return Response.json({
    id: test.id, status: test.status,
    votes_valid: test.votes_valid, votes_target: test.votes_target,
    results,
    decision_package,
  });
}

// PATCH /api/v1/tests/[id] — edit safe metadata (title/context, while draft|active)
// OR close an active run early. Scope: tests:write. Closing delegates to the
// HARDENED, idempotent completeTest() — no refund/escrow logic lives here.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiAuth(req, "tests:write");
  if (!a.ok) return a.response;
  const { id } = await params;

  // Ownership first (same shape/order as GET). Never reveal foreign rows.
  const data = await getTestWithOptions(id);
  if (!data) return apiError("not_found", "No evaluation with that id.", 404);
  if (data.test.user_id !== a.userId) return apiError("forbidden", "This evaluation belongs to another account.", 403);
  const { test } = data;

  const body = await req.json().catch(() => ({}));

  // Reject any forbidden field up front (escrow / plan / tenant / voting integrity).
  const bad = FORBIDDEN.find((k) => body && typeof body === "object" && k in body);
  if (bad) return apiError("validation_error", `The '${bad}' field can't be changed through this endpoint.`, 400);

  // ── Close path: action:'close' OR status:'complete'. Active-only, idempotent. ──
  const wantsClose = body?.action === "close" || body?.status === "complete";
  if (wantsClose) {
    if (test.status === "complete") {
      return Response.json({ id: test.id, status: "complete", votes_valid: test.votes_valid, votes_target: test.votes_target, closed: true });
    }
    if (test.status !== "active") return apiError("validation_error", `Only an active evaluation can be closed early (this one is ${test.status}).`, 400);
    // HARDENED: atomic flip active→complete + exact refund of unfilled escrow, fully
    // idempotent. No refund logic added here — completeTest owns all of it.
    await completeTest(id);
    const rep = await getReport(id);
    return Response.json({ id, status: "complete", votes_valid: test.votes_valid, votes_target: test.votes_target, closed: true, results: rep?.results ?? null });
  }

  // ── Edit path: title / context only, draft|active only. ──
  if (!EDITABLE_STATES.has(test.status)) return apiError("validation_error", `A ${test.status} evaluation can no longer be edited.`, 400);
  const patch: { title?: string; context?: string } = {};
  if (typeof body?.title === "string") patch.title = body.title.trim().slice(0, 140);
  if (typeof body?.context === "string") patch.context = body.context.slice(0, 2000);
  if (patch.title !== undefined && !patch.title) return apiError("validation_error", "Title can't be empty.", 400);
  if (patch.title === undefined && patch.context === undefined) return apiError("validation_error", "Nothing to update. Send title and/or context, or action:'close'.", 400);

  // Data-only, DB-scoped by user_id + editable status (defense in depth vs a TOCTOU
  // between the read above and the write). ok:false ⇒ row changed under us.
  const r = await updateTestMeta(a.userId, id, patch);
  if (!r.ok) return apiError("validation_error", "This evaluation can no longer be edited.", 409);
  return Response.json({ id: r.test.id, status: r.test.status, title: r.test.title, context: r.test.context ?? null });
}
