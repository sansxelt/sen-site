// POST /api/v/check — start an AI Output Check from the signed-in app (the in-app form).
// ASYNC: validate + charge + create a RUNNING row fast, respond { id } immediately so the
// UI can route to the activity list, then run the eval AFTER the response (next/server
// after()) and finalize the row to complete/failed. Session-authenticated; any signed-in
// user with credits (NOT Scale-gated like the public API). Charges 1 credit; refunded on
// failure.

import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { startCheck, finishCheck, CHECK_CREDITS } from "@/lib/v-checks";
import { ensureSignupGrant } from "@/lib/v-credits";
import { OUTPUT_TYPES } from "@/lib/v-evaluator";

export const runtime = "nodejs";
export const maxDuration = 60; // after() runs the eval within this budget (40s client timeout)

function toCandidate(c: unknown): { text: string; versionKey?: string } {
  if (typeof c === "string") return { text: c };
  const o = c as { text?: unknown; version_key?: unknown; versionKey?: unknown } | null;
  const vk = typeof o?.version_key === "string" ? o.version_key : (typeof o?.versionKey === "string" ? o.versionKey : undefined);
  return { text: typeof o?.text === "string" ? o.text : "", ...(vk ? { versionKey: vk } : {}) };
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  // A brand-new signup can land straight on the check form (the free-check entry flow)
  // without first hitting /api/v/me, so grant the one-time free credits here too. Idempotent
  // and one-per-account (see ensureSignupGrant), so this is a no-op for existing users.
  await ensureSignupGrant(email);

  const body = await req.json().catch(() => ({}));
  const outputType = String(body?.output_type ?? body?.outputType ?? "").trim();
  if (outputType && !(OUTPUT_TYPES as readonly string[]).includes(outputType)) {
    return NextResponse.json({ error: "invalid_output_type" }, { status: 400 });
  }
  const candidates = (Array.isArray(body?.candidates) ? body.candidates : []).map(toCandidate);
  const context = body?.context === "published" ? "published" : undefined; // default: pre-ship review

  // Attachment lifecycle (only present when the check has uploads). All metadata is authoritative from
  // the DB snapshot; the client may only say which attachment ids it expects + the idempotency key.
  const draftKey = typeof body?.draft_key === "string" ? body.draft_key : undefined;
  const attachmentIds = Array.isArray(body?.expected_attachment_ids) ? body.expected_attachment_ids.filter((x: unknown): x is string => typeof x === "string").slice(0, 64) : undefined;
  const contextText = typeof body?.context_text === "string" ? body.context_text : undefined;
  const submissionId = typeof body?.submission_id === "string" ? body.submission_id : undefined;

  const started = await startCheck(email, {
    outputType: outputType || "other",
    title: typeof body?.title === "string" ? body.title : undefined,
    audience: typeof body?.audience === "string" ? body.audience : undefined,
    goal: typeof body?.goal === "string" ? body.goal : undefined,
    originalRequest: typeof body?.original_request === "string" ? body.original_request : (typeof body?.originalRequest === "string" ? body.originalRequest : undefined),
    candidates,
    source: "app",
    context,
    draftKey, attachmentIds, contextText, submissionId,
  });

  if (started.status === "invalid") return NextResponse.json({ error: started.message }, { status: 400 });
  if (started.status === "insufficient_credits") return NextResponse.json({ error: "insufficient_credits", needed: CHECK_CREDITS }, { status: 402 });
  // Duplicate submission id: no new charge/eval -- point the UI at the existing check.
  if (started.status === "duplicate") return NextResponse.json({ id: started.checkId, status: "duplicate" }, { status: 200 });
  if (started.status !== "ok") return NextResponse.json({ error: "evaluator_unavailable" }, { status: 503 });

  // Respond now; run the eval after the response is sent. If this invocation is killed
  // before it finishes, reconcileStuckChecks fails + refunds the row on a later view.
  const { checkId, evalInput, bind } = started;
  after(async () => { await finishCheck(email, checkId, evalInput, bind); });

  return NextResponse.json({ id: checkId, status: "running" });
}
