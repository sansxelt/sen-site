// POST /api/v1/check — run an AI Output Check via the public developer API.
// Auth: X-Api-Key (or Authorization: Bearer), Scale plan, tests:write scope.
//
// Two shapes:
//   Single: { output_type, candidates: [{text} | "..."], audience?, goal?, title?, threshold? }
//   Batch:  { items: [ {output_type?, candidates, audience?, goal?, title?, threshold?}, ... ],
//            output_type?, audience?, goal?, threshold? }   // top-level keys are per-item defaults
//
// `threshold` turns the check into a QUALITY GATE: pass a number (overall) or
// { overall?, criteria? } and the response carries `passed: true|false` (plus a `gate`
// breakdown), so a CI step can fail the build when output scores below the bar.
//
// Money: 1 credit per check (per item in a batch), charged on success and refunded on any
// failure. A batch never overdraws — the atomic v_spend_credit lock serializes the charges.

import { apiAuth } from "../_auth";
import { apiError } from "../_lib";
import { runCheck, runChecks, reconcileStuckChecks, setCheckShare, CHECK_CREDITS, MAX_BATCH, type RunCheckInput, type RunCheckResult, type VCheck } from "@/lib/v-checks";
import { OUTPUT_TYPES, type EvalResult, type CheckContext } from "@/lib/v-evaluator";
import { parseThreshold, evaluateGate, type ThresholdSpec, type Gate } from "@/lib/v-gate";

export const runtime = "nodejs";
export const maxDuration = 300; // batch: up to MAX_BATCH checks (each <=40s) across a few concurrency lanes

function toCandidate(c: unknown): { text: string } {
  if (typeof c === "string") return { text: c };
  const o = c as { text?: unknown } | null;
  return { text: typeof o?.text === "string" ? o.text : "" };
}

// "" = not supplied (caller/default decides), null = supplied but invalid, else the value.
function validOutputType(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return (OUTPUT_TYPES as readonly string[]).includes(s) ? s : null;
}

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
// "published" flips the verdict away from a ship/no-ship decision (a live page can't be
// "not ready to ship"). Anything else (incl. absent) is the default pre-ship review.
const validContext = (v: unknown): CheckContext | undefined => (v === "published" || v === "pre_ship" ? v : undefined);
const THRESHOLD_HELP = "threshold must be a number (overall) or an object { overall?, criteria? } with numeric 0-100 values.";

// Shape a completed check into the public response body, optionally with a gate verdict.
// No candidate text is echoed back (flags already carry the verbatim spans).
function renderCheck(check: VCheck, res: EvalResult, gate: Gate | null): Record<string, unknown> {
  const body: Record<string, unknown> = {
    id: check.id,
    output_type: check.output_type,
    model: check.model,
    assessment: "ai",
    credits_charged: check.credits_charged,
    recommended: res.recommendedIndex != null ? { index: res.recommendedIndex, label: res.recommendedLabel, margin: res.margin } : null,
    recommendation: res.recommendation,
    candidates: res.candidates.map((x) => ({ index: x.index, label: x.label, overall: x.overall, summary: x.summary, scores: x.scores, ...(x.correctedVersion ? { corrected_version: x.correctedVersion } : {}) })),
    flags: res.flags.map((f) => ({ candidate: f.candidateLabel, span: f.span, issue: f.issue, severity: f.severity, why: f.why, fix: f.fix })),
    note: "This is an AI assessment, not a human judgment or a guarantee.",
  };
  if (gate) { body.passed = gate.passed; body.gate = gate; }
  return body;
}

export async function POST(req: Request) {
  const a = await apiAuth(req, "tests:write");
  if (!a.ok) return a.response;

  // Heal any of this caller's checks left 'running' by a prior request whose eval was
  // killed mid-flight (bounded, indexed sweep of rows older than STUCK_MS). The in-app
  // pages do this on render; an API-only caller never loads them, so without this a batch
  // item killed after its charge committed would never get refunded. Fresh checks from the
  // current request are untouched (too recent to be swept).
  await reconcileStuckChecks(a.userId);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const hasItems = Array.isArray(body.items);
  const hasCandidates = Array.isArray(body.candidates);
  if (hasItems && hasCandidates) {
    return apiError("validation_error", "Provide either `candidates` (single check) or `items` (batch), not both.", 400);
  }

  return hasItems ? handleBatch(a.userId, body) : handleSingle(a.userId, body);
}

async function handleSingle(userId: string, body: Record<string, unknown>): Promise<Response> {
  const outputType = validOutputType(body.output_type);
  if (outputType === null) return apiError("validation_error", `output_type must be one of: ${OUTPUT_TYPES.join(", ")}.`, 400);

  const threshold = parseThreshold(body.threshold);
  if (threshold === "invalid") return apiError("validation_error", THRESHOLD_HELP, 400);

  const candidates = (Array.isArray(body.candidates) ? body.candidates : []).map(toCandidate);

  const r = await runCheck(userId, {
    outputType: outputType || "other",
    title: str(body.title),
    audience: str(body.audience),
    goal: str(body.goal),
    candidates,
    source: "api",
    context: validContext(body.context),
  });

  if (r.status === "invalid") return apiError("validation_error", r.message, 400);
  if (r.status === "insufficient_credits") return apiError("insufficient_credits", `Not enough credits. A check costs ${CHECK_CREDITS} credit.`, 402);
  if (r.status !== "ok") return apiError("internal_error", "The evaluator is temporarily unavailable and you were not charged. Try again shortly.", 503);
  const res = r.check.result;
  if (!res) return apiError("internal_error", "The check did not complete and you were not charged. Try again shortly.", 503);

  // Always gate on HIGH flags (the reproducible signal); the optional threshold adds score bars.
  const gate = evaluateGate(res, threshold);
  const out = renderCheck(r.check, res, gate);

  // Opt-in public share link: `share: true` enables the read-only /r/c/<token> report and
  // returns its URL. Runs AFTER the charge + eval and only touches the share flag, so it
  // never affects billing. Owner-scoped (setCheckShare filters on userId); a share failure
  // is non-fatal (the check already succeeded and was charged).
  if (body.share === true) {
    try {
      const sh = await setCheckShare(userId, r.check.id, true);
      if (sh.ok && sh.token) out.report_url = `https://vraelis.com/r/c/${sh.token}`;
    } catch (e) { console.error("check share:", e); }
  }
  return Response.json(out);
}

type ParsedItem =
  | { ok: true; input: RunCheckInput; threshold: ThresholdSpec | null }
  | { ok: false; error: string };

async function handleBatch(userId: string, body: Record<string, unknown>): Promise<Response> {
  const items = body.items as unknown[];
  if (items.length === 0) return apiError("validation_error", "`items` must contain at least one output to check.", 400);
  if (items.length > MAX_BATCH) return apiError("validation_error", `A batch is limited to ${MAX_BATCH} items. You sent ${items.length}.`, 400);

  // Top-level keys are per-item defaults (an item may override each).
  const defOutputType = validOutputType(body.output_type);
  if (defOutputType === null) return apiError("validation_error", `output_type must be one of: ${OUTPUT_TYPES.join(", ")}.`, 400);
  const defThreshold = parseThreshold(body.threshold);
  if (defThreshold === "invalid") return apiError("validation_error", THRESHOLD_HELP, 400);
  const defAudience = str(body.audience);
  const defGoal = str(body.goal);
  const defContext = validContext(body.context);

  const parsed: ParsedItem[] = items.map((raw) => {
    const it = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
    const ot = validOutputType(it.output_type);
    if (ot === null) return { ok: false, error: `output_type must be one of: ${OUTPUT_TYPES.join(", ")}.` };
    const th = it.threshold !== undefined ? parseThreshold(it.threshold) : defThreshold;
    if (th === "invalid") return { ok: false, error: THRESHOLD_HELP };
    const candidates = (Array.isArray(it.candidates) ? it.candidates : []).map(toCandidate);
    return {
      ok: true,
      input: {
        outputType: (ot || defOutputType) || "other",
        title: str(it.title),
        // `||` not `??`: an item that sends audience/goal as "" should inherit the batch
        // default (startCheck drops "" anyway), matching an item that omits the field.
        audience: str(it.audience) || defAudience,
        goal: str(it.goal) || defGoal,
        context: validContext(it.context) ?? defContext,
        candidates,
        source: "api",
      },
      threshold: th,
    };
  });

  // Only run the well-formed items; if none are valid, reject the whole batch (nothing charged).
  const runnable = parsed.map((p, i) => ({ p, i })).filter((x): x is { p: Extract<ParsedItem, { ok: true }>; i: number } => x.p.ok);
  if (runnable.length === 0) {
    const firstErr = parsed.find((p): p is Extract<ParsedItem, { ok: false }> => !p.ok);
    return apiError("validation_error", "No valid items in the batch. " + (firstErr?.error ?? ""), 400);
  }

  const runResults = await runChecks(userId, runnable.map((x) => x.p.input));

  const results = new Array<Record<string, unknown>>(parsed.length);
  let creditsCharged = 0;
  let okCount = 0;
  let allGatePassed = true;

  runnable.forEach((x, k) => {
    const m = mapBatchResult(x.i, runResults[k], x.p.threshold);
    results[x.i] = m.body;
    creditsCharged += m.charged;
    if (m.ok) okCount++;
    if (m.gatePassed === false) allGatePassed = false;
  });
  parsed.forEach((p, i) => {
    if (!p.ok) results[i] = { index: i, ok: false, error: { code: "validation_error", message: p.error } };
  });

  return Response.json({
    batch: true,
    count: parsed.length,
    ok_count: okCount,
    credits_charged: creditsCharged,
    // The batch passes only if EVERY item ran AND none has a HIGH flag (or fails a score bar).
    // A HIGH flag on any output, or any item that failed to run, blocks the whole release.
    passed: allGatePassed && okCount === parsed.length,
    results,
    note: "This is an AI assessment, not a human judgment or a guarantee.",
  });
}

function mapBatchResult(index: number, rr: RunCheckResult, threshold: ThresholdSpec | null): { body: Record<string, unknown>; charged: number; ok: boolean; gatePassed: boolean | null } {
  if (rr.status === "invalid") return { body: { index, ok: false, error: { code: "validation_error", message: rr.message } }, charged: 0, ok: false, gatePassed: null };
  if (rr.status === "insufficient_credits") return { body: { index, ok: false, error: { code: "insufficient_credits", message: `Not enough credits. A check costs ${CHECK_CREDITS} credit.` } }, charged: 0, ok: false, gatePassed: null };
  if (rr.status !== "ok" || !rr.check.result) return { body: { index, ok: false, error: { code: "internal_error", message: "The check did not complete and you were not charged." } }, charged: 0, ok: false, gatePassed: null };

  const res = rr.check.result;
  const gate = evaluateGate(res, threshold);
  return { body: { index, ok: true, ...renderCheck(rr.check, res, gate) }, charged: rr.check.credits_charged, ok: true, gatePassed: gate.passed };
}
