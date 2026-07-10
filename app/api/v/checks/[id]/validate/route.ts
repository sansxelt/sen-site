// POST /api/v/checks/[id]/validate — route a check's output through the human flow to
// validate it (the calibration bridge). Session-authenticated; spawns a real human
// evaluation test (charges the usual human-eval credits) and links it to the check.
// Returns { testId } so the UI can point at the run.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { validateCheckWithHumans } from "@/lib/v-calibration";
import { humanEvalEnabled } from "@/lib/v-entitlements";
import { piiMessage } from "@/lib/v-content-policy";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  // Human validation is demoted until an evaluator pool exists.
  if (!humanEvalEnabled()) return NextResponse.json({ error: "human_eval_unavailable" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const votes = typeof body?.votes === "number" && Number.isFinite(body.votes) ? body.votes : undefined;

  const r = await validateCheckWithHumans(email, id, votes);
  switch (r.status) {
    case "ok": return NextResponse.json({ testId: r.testId, existing: !!r.existing });
    case "not_found": return NextResponse.json({ error: "not_found" }, { status: 404 });
    case "not_comparable": return NextResponse.json({ error: "not_comparable" }, { status: 400 });
    case "too_many_versions": return NextResponse.json({ error: "too_many_versions", max: r.max }, { status: 422 });
    case "pii_detected": return NextResponse.json({ error: "pii_detected", message: piiMessage(r.categories), categories: r.categories }, { status: 422 });
    case "insufficient_credits": return NextResponse.json({ error: "insufficient_credits", needed: r.needed }, { status: 402 });
    case "plan_limit": return NextResponse.json({ error: "plan_limit", limit: r.limit }, { status: 403 });
    case "in_progress": return NextResponse.json({ error: "in_progress" }, { status: 409 });
    default: return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
