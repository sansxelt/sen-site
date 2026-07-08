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

function toCandidate(c: unknown): { text: string } {
  if (typeof c === "string") return { text: c };
  const o = c as { text?: unknown } | null;
  return { text: typeof o?.text === "string" ? o.text : "" };
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

  const started = await startCheck(email, {
    outputType: outputType || "other",
    title: typeof body?.title === "string" ? body.title : undefined,
    audience: typeof body?.audience === "string" ? body.audience : undefined,
    goal: typeof body?.goal === "string" ? body.goal : undefined,
    candidates,
    source: "app",
  });

  if (started.status === "invalid") return NextResponse.json({ error: started.message }, { status: 400 });
  if (started.status === "insufficient_credits") return NextResponse.json({ error: "insufficient_credits", needed: CHECK_CREDITS }, { status: 402 });
  if (started.status !== "ok") return NextResponse.json({ error: "evaluator_unavailable" }, { status: 503 });

  // Respond now; run the eval after the response is sent. If this invocation is killed
  // before it finishes, reconcileStuckChecks fails + refunds the row on a later view.
  const { checkId, evalInput } = started;
  after(async () => { await finishCheck(email, checkId, evalInput); });

  return NextResponse.json({ id: checkId, status: "running" });
}
