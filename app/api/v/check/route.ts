// POST /api/v/check — run an AI Output Check from the signed-in app (the in-app form).
// Session-authenticated (any signed-in user with credits — NOT Scale-gated like the
// public API). Charges 1 credit on success; returns { id } so the form can navigate to
// the report at /app/checks/<id>. Shares the same runCheck() core as /api/v1/check.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runCheck, CHECK_CREDITS } from "@/lib/v-checks";
import { OUTPUT_TYPES } from "@/lib/v-evaluator";

export const runtime = "nodejs";
export const maxDuration = 60;

function toCandidate(c: unknown): { text: string } {
  if (typeof c === "string") return { text: c };
  const o = c as { text?: unknown } | null;
  return { text: typeof o?.text === "string" ? o.text : "" };
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const outputType = String(body?.output_type ?? body?.outputType ?? "").trim();
  if (outputType && !(OUTPUT_TYPES as readonly string[]).includes(outputType)) {
    return NextResponse.json({ error: "invalid_output_type" }, { status: 400 });
  }
  const candidates = (Array.isArray(body?.candidates) ? body.candidates : []).map(toCandidate);

  const r = await runCheck(email, {
    outputType: outputType || "other",
    title: typeof body?.title === "string" ? body.title : undefined,
    audience: typeof body?.audience === "string" ? body.audience : undefined,
    goal: typeof body?.goal === "string" ? body.goal : undefined,
    candidates,
    source: "app",
  });

  if (r.status === "invalid") return NextResponse.json({ error: r.message }, { status: 400 });
  if (r.status === "insufficient_credits") return NextResponse.json({ error: "insufficient_credits", needed: CHECK_CREDITS }, { status: 402 });
  if (r.status === "unavailable") return NextResponse.json({ error: "evaluator_unavailable" }, { status: 503 });
  return NextResponse.json({ id: r.check.id });
}
