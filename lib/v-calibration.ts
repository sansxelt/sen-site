// lib/v-calibration.ts
// Calibration (pivot stage 3) — the moat seed. It measures how often the AI check's
// pick matches what real people pick, by routing the SAME output through the human
// validation flow and comparing.
//
//   validateCheckWithHumans  spawn a human validation test from a check, link the two,
//                            and record the AI's prediction (by LETTER, captured now).
//   resolveCalibrationForTest back-fill the human outcome + agreement when the test
//                            completes. Lazy + fail-soft, NOT inside completeTest, so
//                            the money-critical path is never touched.
//   calibrationSummary       the rolling agreement rate (betaBinom), surfaced only once
//                            it is real (n >= CALIBRATION_MIN_N).
//
// Honesty: agreement is counted only when BOTH sides have a definite winner; ties on
// either side are stored but excluded from the rate. Nothing here is faked before it
// exists — the stat renders only past the threshold.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { getPlan, launchTest, getReport, getTestWithOptions, OPTION_LETTERS } from "./v-db";
import { entitlements, MIN_VOTES } from "./v-entitlements";
import { evaluationIntelligence } from "./v-intelligence";
import { betaBinom } from "./v-stats";
import { getCheck } from "./v-checks";
import { scanFields, type PiiCategory } from "./v-content-policy";
import { logEvent } from "./v-events";

const norm = (e: string) => e.trim().toLowerCase();

export const CALIBRATION_MIN_N = 8;          // below this we don't surface a rate
const DEFAULT_VALIDATION_VOTES = 30;         // human judgments per validation, before clamping
const VALIDATION_TEXT_CAP = 2000;            // per option, so real people can read it
const STALE_LAUNCH_MS = 90_000;              // a 'launching' claim older than this (> route maxDuration) is stale and reclaimable

export type VCalibration = {
  id: string; user_id: string; check_id: string; test_id: string | null;
  output_type: string | null; model: string | null;
  ai_winner_label: string | null; ai_recommendation: string | null; ai_margin: number | null;
  status: string;
  human_winner_label: string | null; human_win_probability: number | null; human_valid_judgments: number | null;
  agreement: boolean | null;
  created_at: string; resolved_at: string | null;
};

export type ValidateResult =
  | { status: "ok"; testId: string; existing?: boolean }
  | { status: "not_found" }
  | { status: "not_comparable" }             // < 2 candidates or no definite AI pick
  | { status: "too_many_versions"; max: number } // more versions than the plan can run as a human test
  | { status: "pii_detected"; categories: PiiCategory[] } // candidate text carries end-user PII; can't show it to reviewers
  | { status: "insufficient_credits"; needed?: number }
  | { status: "plan_limit"; limit?: number }
  | { status: "in_progress" }                // a concurrent claim is mid-launch; retry
  | { status: "error" };

// Owner-scoped fetch of the calibration linked to a check (any status).
export async function getCalibrationForCheck(userId: string, checkId: string): Promise<VCalibration | null> {
  if (!isDatabaseConfigured() || !checkId) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_calibration" as never).select("*").eq("check_id", checkId).eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as VCalibration) ?? null;
}

// Spawn a human validation for a check and link them. CLAIM-FIRST: we insert the
// calibration row (unique on check_id) BEFORE launching, so two concurrent requests
// can't both launch (and double-charge) a validation for the same check.
export async function validateCheckWithHumans(userId: string, checkId: string, requestedVotes?: number, _retried = false): Promise<ValidateResult> {
  if (!isDatabaseConfigured()) return { status: "error" };
  const uid = norm(userId);
  const check = await getCheck(uid, checkId);
  if (!check) return { status: "not_found" };

  // Use the candidates in their ORIGINAL order (no filtering): position i must equal
  // candidate index i must equal letter i, so the AI's predicted letter lines up with
  // the human option at that position. Candidates always carry text (finalizeEvaluation
  // only emits non-empty ones), so no option is ever blank.
  const cands = check.result?.candidates ?? [];
  const aiWinner = check.result?.recommendedLabel ?? null;
  if (cands.length < 2 || !aiWinner) return { status: "not_comparable" };

  // The human test must show EVERY version the AI ranked, in the same order. v_launch_test
  // SILENTLY TRUNCATES options past the plan's maxOptions, which would drop versions the
  // AI scored (possibly the winner) and record a structurally-false comparison that
  // poisons the agreement rate. So refuse when the check has more versions than this plan
  // can run as a human test, rather than launch a truncated validation.
  const ent = entitlements(await getPlan(uid));
  if (cands.length > ent.maxOptions) return { status: "too_many_versions", max: ent.maxOptions };

  // PII guard. The AI-check path deliberately does NOT scan candidate text (it only goes to
  // the model). A human validation, though, shows that same text to real evaluators, so scan
  // it here and refuse when it carries an end-user's structured PII (email/phone/SSN/card) —
  // otherwise this bridge is exactly the leak the evaluator's skip assumed could not happen.
  const pii = scanFields([check.title, ...cands.map((c) => c.text)]);
  if (pii.length) return { status: "pii_detected", categories: pii };

  const s = getSupabaseAdminClient();

  // Claim the check (unique on check_id) BEFORE launching, so a concurrent request can't
  // double-launch (double-charge) a validation for the same check.
  const claim = await s.from("v_calibration" as never).insert({
    user_id: uid, check_id: checkId, status: "launching",
    output_type: check.output_type ?? null, model: check.model ?? null,
    ai_winner_label: aiWinner, ai_recommendation: check.result?.recommendation ?? null, ai_margin: check.result?.margin ?? null,
  } as never).select("id").single();
  if (claim.error) {
    if ((claim.error as { code?: string }).code === "23505") {
      const ex = await getCalibrationForCheck(uid, checkId);
      if (ex?.test_id) return { status: "ok", testId: ex.test_id, existing: true };
      // A prior claim is stuck 'launching' with no linked test. If it's stale (a crash or
      // timeout left it behind), reclaim it ONCE so the check isn't permanently blocked; a
      // fresh one means a concurrent request is genuinely mid-launch.
      if (!_retried && ex && ex.status === "launching" && Date.now() - new Date(ex.created_at).getTime() > STALE_LAUNCH_MS) {
        await s.from("v_calibration" as never).delete().eq("id", ex.id).eq("status", "launching").is("test_id", null);
        return validateCheckWithHumans(uid, checkId, requestedVotes, true);
      }
      return { status: "in_progress" };
    }
    console.error("validateCheckWithHumans claim:", (claim.error as { message?: string }).message);
    return { status: "error" };
  }
  const calId = (claim.data as unknown as { id: string }).id;

  // Options in the SAME order as the check (position i -> letter i). Guarded above to be
  // <= ent.maxOptions, so nothing is truncated.
  const options = cands.map((c) => ({ label: (c.text || "").trim().slice(0, VALIDATION_TEXT_CAP) }));
  const votes = Math.max(MIN_VOTES, Math.min(ent.maxVotes, Math.round(requestedVotes || DEFAULT_VALIDATION_VOTES)));
  const title = (check.title ? `Validation: ${check.title}` : `Validation: ${(check.output_type || "output").replace(/_/g, " ")} check`).slice(0, 140);
  const context = check.goal ? `Which version is better for: ${check.goal}` : "Which version would you ship, and why?";

  const launched = await launchTest({ userId: uid, title, context, category: "other", audience: "general", votesTarget: votes, options, activeLimit: ent.activeTestsPerMonth, maxOptions: ent.maxOptions });
  if (launched.status !== "ok" || !launched.id) {
    // Release the claim so the user can retry once they resolve the reason.
    await s.from("v_calibration" as never).delete().eq("id", calId);
    if (launched.status === "insufficient_credits") return { status: "insufficient_credits", needed: launched.needed };
    if (launched.status === "plan_limit") return { status: "plan_limit", limit: launched.limit };
    return { status: "error" };
  }
  const testId = launched.id;

  // Link the charged test to the claim. Retry once; if it STILL fails, log loudly with ids
  // so the charged-but-unlinked test is reconcilable (the stale-reclaim path above also
  // unblocks the check on a later attempt).
  let link = await s.from("v_calibration" as never).update({ test_id: testId, status: "pending" } as never).eq("id", calId);
  if ((link as { error?: unknown }).error) link = await s.from("v_calibration" as never).update({ test_id: testId, status: "pending" } as never).eq("id", calId);
  if ((link as { error?: unknown }).error) console.error(`CALIBRATION LINK FAILED (test charged, unlinked): check=${checkId} test=${testId} cal=${calId}: ${((link as { error?: { message?: string } }).error)?.message}`);

  await logEvent({ userId: uid, testId, eventType: "calibration_started", actorType: "owner", source: "calibration", metadata: { check_id: checkId, ai_winner: aiWinner, votes } });
  return { status: "ok", testId };
}

// Back-fill the human outcome once the validation test is complete. Lazy + fail-soft;
// safe to call repeatedly (the status guard makes the resolve idempotent).
export async function resolveCalibrationForTest(testId: string): Promise<void> {
  try {
    if (!isDatabaseConfigured() || !testId) return;
    const s = getSupabaseAdminClient();
    const { data: rows } = await s.from("v_calibration" as never).select("*").eq("test_id", testId).eq("status", "pending").limit(1);
    const cal = (rows as unknown as VCalibration[] | null)?.[0];
    if (!cal) return;

    const td = await getTestWithOptions(testId);
    if (!td || td.test.status !== "complete") return; // still collecting — stay pending
    const report = await getReport(testId);
    if (!report) return;
    const r = report.results;

    const winnerRow = r.winner_option_id ? r.ranked.find((x) => x.id === r.winner_option_id) : null;
    const humanWinnerLabel = winnerRow ? (OPTION_LETTERS[winnerRow.position] ?? null) : null;
    const intel = evaluationIntelligence(r, td.test.votes_target);
    const humanWinProb = typeof intel.winProbability === "number" ? intel.winProbability : null;
    // Agreement only when both sides have a definite winner; a tie on either side is
    // stored (resolved) but excluded from the rate (agreement stays null).
    const agreement = cal.ai_winner_label && humanWinnerLabel ? cal.ai_winner_label === humanWinnerLabel : null;

    await s.from("v_calibration" as never).update({
      status: "resolved",
      human_winner_label: humanWinnerLabel,
      human_win_probability: humanWinProb,
      human_valid_judgments: typeof r.total === "number" ? r.total : null,
      agreement,
      resolved_at: new Date().toISOString(),
    } as never).eq("id", cal.id).eq("status", "pending"); // guard double-resolve

    await logEvent({ userId: cal.user_id, testId, eventType: "calibration_resolved", actorType: "system", source: "calibration", metadata: { check_id: cal.check_id, ai_winner: cal.ai_winner_label, human_winner: humanWinnerLabel, agreement } });
  } catch (e) {
    console.error("resolveCalibrationForTest:", e);
  }
}

export type CalibrationSummary = { n: number; agree: number; ratePct: number | null; lo: number | null; hi: number | null; display: boolean };

// The rolling agreement rate across all resolved calibrations with a definite winner on
// both sides. Cheap enough for the report hot path: two bounded COUNT queries (no row
// transfer), no per-render batch resolution. Ties (agreement null) are excluded on both
// sides, so the rate is agree / (agree + disagree). Pending rows resolve lazily when
// their own check report is viewed; a background sweep is the long-term resolver.
// display is false until n >= CALIBRATION_MIN_N, so a rate is never shown before it's real.
export async function calibrationSummary(): Promise<CalibrationSummary> {
  const empty: CalibrationSummary = { n: 0, agree: 0, ratePct: null, lo: null, hi: null, display: false };
  if (!isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    const [agreeRes, disagreeRes] = await Promise.all([
      s.from("v_calibration" as never).select("*", { count: "exact", head: true }).eq("status", "resolved").eq("agreement", true),
      s.from("v_calibration" as never).select("*", { count: "exact", head: true }).eq("status", "resolved").eq("agreement", false),
    ]);
    const agree = (agreeRes as { count: number | null }).count ?? 0;
    const n = agree + ((disagreeRes as { count: number | null }).count ?? 0);
    if (n === 0) return empty;
    const bb = betaBinom(agree, n);
    return { n, agree, ratePct: Math.round(bb.mean * 100), lo: Math.round(bb.lo * 100), hi: Math.round(bb.hi * 100), display: n >= CALIBRATION_MIN_N };
  } catch (e) {
    console.error("calibrationSummary:", e);
    return empty;
  }
}
