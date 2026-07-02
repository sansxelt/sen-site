// lib/v-checks.ts
// AI Output Check (pivot stage 2) — the orchestration between the evaluator engine
// (lib/v-evaluator.ts), the credit ledger (lib/v-credits.ts), and storage (v_checks).
// One entry point, runCheck(), backs BOTH surfaces: the API-key POST /api/v1/check
// and the session-authed in-app POST /api/v/check.
//
// Money discipline mirrors the human-eval path: CHARGE FIRST (atomically), evaluate,
// and REFUND if the evaluation fails — so the balance can never leak and a customer is
// never charged for a check they didn't get. The atomic v_spend_credit RPC is the
// authoritative gate; a migration-tolerant JS fallback (spend()) covers pre-migration.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { balance, spend, refundCheck } from "./v-credits";
import { evaluateOutput, evaluatorConfigured, OUTPUT_TYPES, type EvalInput, type EvalResult, type OutputType } from "./v-evaluator";
import { logEvent } from "./v-events";
import { randomUUID } from "crypto";

const norm = (e: string) => e.trim().toLowerCase();

export const CHECK_CREDITS = 1;      // 1 credit per check (pivot decision)
export const MAX_CANDIDATES = 8;     // matches the evaluator + product spec (2 to 8 versions)
export const MAX_TEXT_CHARS = 8000;  // per candidate, to bound token cost

export type VCheck = {
  id: string;
  user_id: string;
  output_type: OutputType;
  title: string | null;
  audience: string | null;
  goal: string | null;
  candidate_count: number;
  result: EvalResult;
  model: string | null;
  credits_charged: number;
  source: string;
  created_at: string;
};

export type RunCheckInput = {
  outputType: string;
  title?: string;
  audience?: string;
  goal?: string;
  candidates: { label?: string; text?: string }[];
  source: "app" | "api";
};

export type RunCheckResult =
  | { status: "ok"; check: VCheck }
  | { status: "invalid"; message: string }
  | { status: "insufficient_credits" }
  | { status: "unavailable" };       // evaluator not configured, or a transient failure

// Run one AI Output Check end to end: validate → charge → evaluate → store (refund on
// failure). `userId` is already an authenticated tenant (email); we never trust a
// client-supplied id.
export async function runCheck(userId: string, input: RunCheckInput): Promise<RunCheckResult> {
  if (!isDatabaseConfigured()) return { status: "unavailable" };
  const uid = norm(userId);

  const outputType: OutputType = (OUTPUT_TYPES as readonly string[]).includes(input.outputType) ? (input.outputType as OutputType) : "other";
  const candidates = (Array.isArray(input.candidates) ? input.candidates : [])
    .map((c) => ({ text: String(c?.text || "").trim().slice(0, MAX_TEXT_CHARS) }))
    .filter((c) => c.text.length > 0)
    .slice(0, MAX_CANDIDATES);
  if (candidates.length < 1) return { status: "invalid", message: "Provide at least one non-empty version to check." };

  const audience = input.audience ? String(input.audience).trim().slice(0, 400) : undefined;
  const goal = input.goal ? String(input.goal).trim().slice(0, 800) : undefined;
  const title = input.title ? String(input.title).trim().slice(0, 140) : null;

  // If the evaluator has no API key it would fail-soft to null anyway — bail BEFORE
  // charging so we never write a pointless charge/refund pair (e.g. before the key is set).
  if (!evaluatorConfigured()) return { status: "unavailable" };

  // Fast pre-check so we don't do LLM work for a definitely-broke account. The atomic
  // charge below is the authoritative gate (this read on its own is racy).
  if ((await balance(uid)) < CHECK_CREDITS) return { status: "insufficient_credits" };

  const checkId = randomUUID();

  // Charge FIRST (atomic), then evaluate; refund on EVERY post-charge failure.
  const charge = await chargeForCheck(uid, checkId, CHECK_CREDITS);
  if (charge === "insufficient_credits") return { status: "insufficient_credits" }; // no debit was written
  if (charge !== "ok") {
    // "error" is ambiguous: the RPC may have COMMITTED the debit and then lost the
    // response (network reset / gateway timeout). refundCheck reverses a committed
    // debit and safely no-ops when nothing was charged, so we never leak the credit.
    await refundCheck(uid, checkId);
    return { status: "unavailable" };
  }

  let result: EvalResult | null = null;
  try {
    const evalInput: EvalInput = { outputType, audience, goal, candidates };
    result = await evaluateOutput(evalInput);
  } catch (e) {
    console.error("runCheck evaluate:", e);
  }
  if (!result) {
    await refundCheck(uid, checkId); // evaluator unavailable / failed — give the credit back
    return { status: "unavailable" };
  }

  const saved = await insertCheck({
    id: checkId, userId: uid, outputType, title, audience: audience ?? null, goal: goal ?? null,
    candidateCount: candidates.length, result, model: result.model, creditsCharged: CHECK_CREDITS, source: input.source,
  });
  if (!saved) {
    await refundCheck(uid, checkId); // stored nowhere — don't charge for a lost result
    return { status: "unavailable" };
  }

  await logEvent({
    userId: uid, eventType: "check_created", actorType: input.source === "api" ? "api" : "owner", source: input.source,
    metadata: { check_id: checkId, output_type: outputType, candidate_count: candidates.length, source: input.source },
  });
  return { status: "ok", check: saved };
}

// Atomic per-check charge. Prefers the v_spend_credit RPC; falls back to the JS
// spend() when the RPC isn't applied yet (Postgres 42883), same tolerance as launchTest.
async function chargeForCheck(userId: string, checkId: string, amount: number): Promise<"ok" | "insufficient_credits" | "error"> {
  const s = getSupabaseAdminClient();
  try {
    const { data, error } = await s.rpc("v_spend_credit" as never, { p_user: norm(userId), p_ref: checkId, p_amount: amount } as never);
    if (error) {
      if ((error as { code?: string }).code === "42883") {
        const ok = await spend(userId, checkId, amount);
        return ok ? "ok" : "insufficient_credits";
      }
      console.error("chargeForCheck rpc:", error.message);
      return "error";
    }
    const status = (data as unknown as { status?: string } | null)?.status;
    if (status === "ok") return "ok";
    if (status === "insufficient_credits") return "insufficient_credits";
    return "error";
  } catch (e) {
    console.error("chargeForCheck:", e);
    return "error";
  }
}

async function insertCheck(row: {
  id: string; userId: string; outputType: OutputType; title: string | null; audience: string | null; goal: string | null;
  candidateCount: number; result: EvalResult; model: string | null; creditsCharged: number; source: string;
}): Promise<VCheck | null> {
  const s = getSupabaseAdminClient();
  const { data, error } = await s.from("v_checks" as never).insert({
    id: row.id, user_id: row.userId, output_type: row.outputType, title: row.title, audience: row.audience, goal: row.goal,
    candidate_count: row.candidateCount, result: row.result, model: row.model, credits_charged: row.creditsCharged, source: row.source,
  } as never).select("*").single();
  if (error || !data) { console.error("insertCheck:", error?.message); return null; }
  return data as unknown as VCheck;
}

// Owner-scoped fetch (never trusts a client id — scoped to the authenticated user).
export async function getCheck(userId: string, id: string): Promise<VCheck | null> {
  if (!isDatabaseConfigured() || !id) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_checks" as never).select("*").eq("id", id).eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as VCheck) ?? null;
}
