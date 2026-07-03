// POST /api/v1/check — run an AI Output Check via the public developer API.
// Auth: X-Api-Key (or Authorization: Bearer), Scale plan, tests:write scope.
// Body: { output_type, candidates: [{text} | "..."], audience?, goal?, title? }.
// Charges 1 credit on success; you are not charged if the evaluator is unavailable.

import { apiAuth } from "../_auth";
import { apiError } from "../_lib";
import { runCheck, CHECK_CREDITS } from "@/lib/v-checks";
import { OUTPUT_TYPES } from "@/lib/v-evaluator";

export const runtime = "nodejs";
export const maxDuration = 60; // above the evaluator's 40s client timeout

function toCandidate(c: unknown): { text: string } {
  if (typeof c === "string") return { text: c };
  const o = c as { text?: unknown } | null;
  return { text: typeof o?.text === "string" ? o.text : "" };
}

export async function POST(req: Request) {
  const a = await apiAuth(req, "tests:write");
  if (!a.ok) return a.response;

  const body = await req.json().catch(() => ({}));
  const outputType = String(body?.output_type ?? "").trim();
  if (outputType && !(OUTPUT_TYPES as readonly string[]).includes(outputType)) {
    return apiError("validation_error", `output_type must be one of: ${OUTPUT_TYPES.join(", ")}.`, 400);
  }
  const candidates = (Array.isArray(body?.candidates) ? body.candidates : []).map(toCandidate);

  const r = await runCheck(a.userId, {
    outputType: outputType || "other",
    title: typeof body?.title === "string" ? body.title : undefined,
    audience: typeof body?.audience === "string" ? body.audience : undefined,
    goal: typeof body?.goal === "string" ? body.goal : undefined,
    candidates,
    source: "api",
  });

  if (r.status === "invalid") return apiError("validation_error", r.message, 400);
  if (r.status === "insufficient_credits") return apiError("insufficient_credits", `Not enough credits. A check costs ${CHECK_CREDITS} credit.`, 402);
  if (r.status === "unavailable") return apiError("internal_error", "The evaluator is temporarily unavailable and you were not charged. Try again shortly.", 503);

  const c = r.check;
  const res = c.result;
  if (!res) return apiError("internal_error", "The check did not complete and you were not charged. Try again shortly.", 503);
  return Response.json({
    id: c.id,
    output_type: c.output_type,
    model: c.model,
    assessment: "ai",
    credits_charged: c.credits_charged,
    recommended: res.recommendedIndex != null ? { index: res.recommendedIndex, label: res.recommendedLabel, margin: res.margin } : null,
    recommendation: res.recommendation,
    candidates: res.candidates.map((x) => ({ index: x.index, label: x.label, overall: x.overall, summary: x.summary, scores: x.scores })),
    flags: res.flags.map((f) => ({ candidate: f.candidateLabel, span: f.span, issue: f.issue, severity: f.severity, why: f.why, fix: f.fix })),
    note: "This is an AI assessment, not a human judgment or a guarantee.",
  });
}
