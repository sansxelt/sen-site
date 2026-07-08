// lib/v-checks.ts
// AI Output Check — orchestration between the evaluator (v-evaluator), the credit
// ledger (v-credits), and storage (v_checks).
//
// Checks are ASYNC in the app. startCheck() validates, CHARGES, and creates a RUNNING
// row fast (no LLM call), so the UI can route to the activity list immediately;
// finishCheck() runs the eval afterwards (in-app: via next/server after(); public API:
// inline) and finalizes the row to complete (with result) or failed (+ refund). A
// 'running' row whose background eval was killed is reconciled to failed + refund on
// read (reconcileStuckChecks), so a charge can never be stranded.
//
// Money discipline: CHARGE FIRST (atomic v_spend_credit RPC, spend() fallback), REFUND
// on every failure path — so the customer is never charged for a check they didn't get.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { balance, spend, refundCheck } from "./v-credits";
import { evaluateOutput, evaluatorConfigured, OUTPUT_TYPES, type EvalInput, type EvalResult, type OutputType, type CheckContext } from "./v-evaluator";
import { logEvent } from "./v-events";
import { randomBytes, randomUUID } from "crypto";

const norm = (e: string) => e.trim().toLowerCase();

export const CHECK_CREDITS = 1;      // 1 credit per check (pivot decision)
export const MAX_CANDIDATES = 8;     // matches the evaluator + product spec (2 to 8 versions)
export const MAX_TEXT_CHARS = 8000;  // per candidate, to bound token cost
export const MAX_BATCH = 10;         // outputs per batch API request; each is its own 1-credit check
const STUCK_MS = 120_000;            // a 'running' check older than this had its bg eval killed → fail + refund

export type CheckStatus = "running" | "complete" | "failed";

export type VCheck = {
  id: string;
  user_id: string;
  output_type: OutputType;
  title: string | null;
  audience: string | null;
  goal: string | null;
  candidate_count: number;
  result: EvalResult | null;   // null while running or on failure
  model: string | null;
  status: string;              // running | complete | failed
  error: string | null;
  credits_charged: number;
  source: string;
  share_token: string | null;   // set once shared; unguessable public link segment
  share_enabled: boolean;       // public /r/c/<token> report is live only while true
  created_at: string;
};

// Lightweight row for the activity list (no heavy result payload).
export type VCheckSummary = { id: string; output_type: OutputType; title: string | null; status: string; credits_charged: number; created_at: string };

export type RunCheckInput = {
  outputType: string;
  title?: string;
  audience?: string;
  goal?: string;
  candidates: { label?: string; text?: string }[];
  source: "app" | "api";
  context?: CheckContext;   // "pre_ship" (default) | "published"
};

export type StartResult =
  | { status: "ok"; checkId: string; evalInput: EvalInput }
  | { status: "invalid"; message: string }
  | { status: "insufficient_credits" }
  | { status: "unavailable" };

export type RunCheckResult =
  | { status: "ok"; check: VCheck }
  | { status: "invalid"; message: string }
  | { status: "insufficient_credits" }
  | { status: "unavailable" };

// Validate, charge, and create a RUNNING check. Fast: no LLM call. Returns the checkId
// and the prepared eval input for finishCheck to consume.
export async function startCheck(userId: string, input: RunCheckInput): Promise<StartResult> {
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

  // If the evaluator has no key it would fail-soft anyway — bail BEFORE charging.
  if (!evaluatorConfigured()) return { status: "unavailable" };
  // Fast pre-check; the atomic charge below is the authoritative gate.
  if ((await balance(uid)) < CHECK_CREDITS) return { status: "insufficient_credits" };

  const checkId = randomUUID();

  // Charge FIRST (atomic). Refund on any post-charge failure.
  const charge = await chargeForCheck(uid, checkId, CHECK_CREDITS);
  if (charge === "insufficient_credits") return { status: "insufficient_credits" }; // no debit written
  if (charge !== "ok") {
    // Ambiguous: the debit may have committed. refundCheck reverses it if so, no-ops if
    // not. No v_checks row exists yet, so if the refund itself fails there is nothing for
    // reconcileStuckChecks to find later — log loudly for manual reversal.
    if (!(await refundCheck(uid, checkId))) console.error(`ORPHANED CHARGE (ambiguous charge) check=${checkId} user=${uid}: manual reconciliation required`);
    return { status: "unavailable" };
  }

  const created = await insertRunningCheck({ id: checkId, userId: uid, outputType, title, audience: audience ?? null, goal: goal ?? null, candidateCount: candidates.length, source: input.source });
  if (!created) {
    // Charged but no row was written → no anchor for the reconcile sweep. Refund now; if
    // that also fails, log loudly (the only recovery is manual).
    if (!(await refundCheck(uid, checkId))) console.error(`ORPHANED CHARGE (row insert failed) check=${checkId} user=${uid}: manual reconciliation required`);
    return { status: "unavailable" };
  }

  await logEvent({ userId: uid, eventType: "check_started", actorType: input.source === "api" ? "api" : "owner", source: input.source, metadata: { check_id: checkId, output_type: outputType, candidate_count: candidates.length, source: input.source } });
  return { status: "ok", checkId, evalInput: { outputType, audience, goal, candidates, context: input.context } };
}

// Evaluate a running check and finalize it. Fail-soft; the sole finalizer in the normal
// flow (reconcile only fires far later). complete → result stored; failed → refund.
export async function finishCheck(userId: string, checkId: string, evalInput: EvalInput): Promise<CheckStatus> {
  const uid = norm(userId);
  let result: EvalResult | null = null;
  try { result = await evaluateOutput(evalInput); } catch (e) { console.error("finishCheck evaluate:", e); }

  if (!result) {
    // Flip running → failed ONLY once the refund is CONFIRMED (refundCheck returns true
    // when the charge is reversed, including idempotent re-runs). If it didn't land, leave
    // the row 'running' so reconcileStuckChecks retries — a 'failed' row is never revisited,
    // so flipping before a confirmed refund would strand the charge permanently.
    if (await refundCheck(uid, checkId)) await markCheckFailed(uid, checkId, "evaluator_unavailable");
    return "failed";
  }
  const stored = await completeCheck(uid, checkId, result);
  if (!stored) {
    if (await refundCheck(uid, checkId)) await markCheckFailed(uid, checkId, "store_failed");
    return "failed";
  }
  await logEvent({ userId: uid, eventType: "check_completed", actorType: "system", source: "check", metadata: { check_id: checkId, output_type: evalInput.outputType, recommended: result.recommendedLabel } });
  return "complete";
}

// Public-API SYNC path: start + finish + fetch the finalized check.
export async function runCheck(userId: string, input: RunCheckInput): Promise<RunCheckResult> {
  const started = await startCheck(userId, input);
  if (started.status === "invalid") return { status: "invalid", message: started.message };
  if (started.status === "insufficient_credits") return { status: "insufficient_credits" };
  if (started.status !== "ok") return { status: "unavailable" };
  const final = await finishCheck(userId, started.checkId, started.evalInput);
  if (final !== "complete") return { status: "unavailable" };
  const check = await getCheck(userId, started.checkId);
  return check && check.status === "complete" && check.result ? { status: "ok", check } : { status: "unavailable" };
}

// Run several independent checks for ONE user in a single request (the batch API path),
// with bounded concurrency and original order preserved. Each item goes through runCheck,
// so batch introduces NO new money logic. With the atomic v_spend_credit RPC (its per-user
// advisory lock serializes the concurrent per-item charges) a batch can never overdraw:
// excess items cleanly return insufficient_credits. The lock-free JS spend() fallback is
// reached only when the RPC is unapplied — which, per the migration that creates the RPC
// and the v_checks table together, also means the table is absent, so each racy charge's
// insertRunningCheck fails and is refunded before any eval runs. The only window where
// concurrent fallback charges could overdraw is a hand-split migration (table present, RPC
// dropped), which the shipped migrations do not produce. One item failing (invalid, no
// credits, eval error) refunds itself and never affects the others.
//
// Concurrency is capped so a batch never fans out more than `concurrency` LLM calls at
// once (gentler on the model's rate limit); with MAX_BATCH=10 and the evaluator's 40s
// cap, the whole batch finishes well inside the route's maxDuration.
export async function runChecks(userId: string, inputs: RunCheckInput[], concurrency = 6): Promise<RunCheckResult[]> {
  const results = new Array<RunCheckResult>(inputs.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (;;) {
      const i = next++;
      if (i >= inputs.length) return;
      try {
        results[i] = await runCheck(userId, inputs[i]);
      } catch (e) {
        // runCheck is fail-soft and self-refunds on its own failure paths; this only
        // catches an UNEXPECTED throw (e.g. a DB write rejecting) so one bad item can't
        // reject the whole batch. A throw between charge and refund leaves a 'running' row
        // that the API route's reconcileStuckChecks() sweep refunds on a later call.
        console.error("runChecks item failed:", e);
        results[i] = { status: "unavailable" };
      }
    }
  };
  const lanes = Math.max(1, Math.min(concurrency, inputs.length));
  await Promise.all(Array.from({ length: lanes }, () => worker()));
  return results;
}

// Atomic per-check charge. Prefers the v_spend_credit RPC; falls back to the JS spend()
// when the RPC isn't applied yet (Postgres 42883), same tolerance as launchTest.
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

async function insertRunningCheck(row: {
  id: string; userId: string; outputType: OutputType; title: string | null; audience: string | null; goal: string | null; candidateCount: number; source: string;
}): Promise<boolean> {
  const s = getSupabaseAdminClient();
  const { error } = await s.from("v_checks" as never).insert({
    id: row.id, user_id: row.userId, output_type: row.outputType, title: row.title, audience: row.audience, goal: row.goal,
    candidate_count: row.candidateCount, result: null, model: null, credits_charged: CHECK_CREDITS, source: row.source, status: "running",
  } as never).select("id").single();
  if (error) { console.error("insertRunningCheck:", error.message); return false; }
  return true;
}

// Store the result and flip running → complete. Guarded on status='running' so it can't
// resurrect a row a reconcile already failed. Returns false only on a persistent DB error
// (the caller then fails + refunds). Retries once.
async function completeCheck(userId: string, checkId: string, result: EvalResult): Promise<boolean> {
  const s = getSupabaseAdminClient();
  const patch = { result, model: result.model, status: "complete", error: null } as never;
  let res = await s.from("v_checks" as never).update(patch).eq("id", checkId).eq("user_id", norm(userId)).eq("status", "running");
  if ((res as { error?: unknown }).error) res = await s.from("v_checks" as never).update(patch).eq("id", checkId).eq("user_id", norm(userId)).eq("status", "running");
  if ((res as { error?: { message?: string } }).error) { console.error("completeCheck:", (res as { error?: { message?: string } }).error?.message); return false; }
  return true;
}

// Flip running → failed (+ zero the recorded charge, since we refund separately).
// Guarded on status='running' so it never overwrites a completed row. Fail-soft.
async function markCheckFailed(userId: string, checkId: string, reason: string): Promise<void> {
  try {
    const s = getSupabaseAdminClient();
    await s.from("v_checks" as never).update({ status: "failed", error: reason, credits_charged: 0 } as never).eq("id", checkId).eq("user_id", norm(userId)).eq("status", "running");
  } catch (e) { console.error("markCheckFailed:", e); }
}

// Safety net: fail + refund any of the user's 'running' checks whose background eval was
// killed (older than STUCK_MS). Bounded; called on the checks list/report render.
export async function reconcileStuckChecks(userId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    const s = getSupabaseAdminClient();
    const cutoff = new Date(Date.now() - STUCK_MS).toISOString();
    const { data } = await s.from("v_checks" as never).select("id").eq("user_id", norm(userId)).eq("status", "running").lt("created_at", cutoff).limit(20);
    for (const row of (data as unknown as { id: string }[] | null) ?? []) {
      // Mark failed ONLY once the refund is confirmed; otherwise leave it 'running' so a
      // later sweep retries the refund (never strand a charge as an unrefunded 'failed').
      if (await refundCheck(norm(userId), row.id)) await markCheckFailed(userId, row.id, "timed_out");
    }
  } catch (e) { console.error("reconcileStuckChecks:", e); }
}

// Owner-scoped fetch (never trusts a client id — scoped to the authenticated user).
export async function getCheck(userId: string, id: string): Promise<VCheck | null> {
  if (!isDatabaseConfigured() || !id) return null;
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_checks" as never).select("*").eq("id", id).eq("user_id", norm(userId)).maybeSingle();
  return (data as unknown as VCheck) ?? null;
}

// The user's checks, newest first — the activity list. Light columns only.
export async function listChecks(userId: string, opts: { limit?: number } = {}): Promise<VCheckSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const s = getSupabaseAdminClient();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const { data } = await s.from("v_checks" as never)
    .select("id, output_type, title, status, credits_charged, created_at")
    .eq("user_id", norm(userId)).order("created_at", { ascending: false }).limit(limit);
  return (data as unknown as VCheckSummary[]) ?? [];
}

// ── Public sharing ────────────────────────────────────────────────────────────
// A completed check can be shared as a read-only public report at /r/c/<token>.
// Sharing is OPT-IN and OWNER-CONTROLLED: the owner flips share_enabled, and the
// public read path (getSharedCheck) is the ONLY way to read another user's check
// — gated strictly on (unguessable token AND share_enabled AND status=complete).
// Flipping it off kills the link immediately. No owner identity is ever exposed.

// Only the report content, never user_id / audience / goal / internal columns.
export type PublicCheck = { output_type: OutputType; title: string | null; result: EvalResult; model: string | null; created_at: string };

// 128 bits of URL-safe randomness → an unguessable ~22-char path segment.
function newShareToken(): string {
  return randomBytes(16).toString("base64url");
}

// Owner-scoped. Enabling a completed check mints a token; disabling flips share_enabled
// off. Returns the token ONLY while enabled. Enabling a check that isn't complete is
// rejected. Turning sharing OFF then ON ROTATES the token — so revoking a leaked link is
// permanent, and a fresh enable never resurrects an old URL. A redundant enable while
// already live keeps the existing token (idempotent, link stays stable).
export async function setCheckShare(
  userId: string,
  checkId: string,
  enabled: boolean,
): Promise<{ ok: boolean; enabled: boolean; token: string | null }> {
  if (!isDatabaseConfigured() || !checkId) return { ok: false, enabled: false, token: null };
  const uid = norm(userId);
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_checks" as never)
    .select("id, status, share_token, share_enabled")
    .eq("id", checkId).eq("user_id", uid).maybeSingle();
  const row = data as unknown as { status: string; share_token: string | null; share_enabled: boolean } | null;
  if (!row) return { ok: false, enabled: false, token: null };
  if (enabled && row.status !== "complete") return { ok: false, enabled: false, token: null };

  // Rotate on every off→on transition; keep the token only when it's already live.
  const token = enabled
    ? (row.share_enabled && row.share_token ? row.share_token : newShareToken())
    : row.share_token;
  const { error } = await s.from("v_checks" as never)
    .update({ share_enabled: enabled, share_token: token } as never)
    .eq("id", checkId).eq("user_id", uid);
  if (error) { console.error("setCheckShare:", error); return { ok: false, enabled: row.share_enabled, token: null }; }
  return { ok: true, enabled, token: enabled ? token : null };
}

// PUBLIC read — NOT user-scoped. Returns a report ONLY when it is explicitly shared
// and complete. The admin client bypasses row scoping, so the WHERE clause here is the
// entire access gate: an empty/short token, a disabled share, or a non-complete check
// all resolve to null. Never selects or returns user_id.
export async function getSharedCheck(token: string): Promise<PublicCheck | null> {
  if (!isDatabaseConfigured()) return null;
  const t = (token || "").trim();
  if (t.length < 16) return null; // guard: never match on a blank/short token
  const s = getSupabaseAdminClient();
  const { data } = await s.from("v_checks" as never)
    .select("output_type, title, result, model, created_at")
    .eq("share_token", t).eq("share_enabled", true).eq("status", "complete").maybeSingle();
  const row = data as unknown as PublicCheck | null;
  if (!row || !row.result) return null;
  return { output_type: row.output_type, title: row.title, result: row.result, model: row.model, created_at: row.created_at };
}
