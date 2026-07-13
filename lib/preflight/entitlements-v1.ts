// Versioned per-pass entitlements (docs/pricing-verdict-final.md) — the ENFORCEMENT layer over the pure
// money math in lib/preflight/pass-pricing.ts. Server-only, owner-scoped (user_id = lowercased email, the
// same tenancy model as lib/v-credits.ts); nothing here is reachable from a client body. Everything is
// INERT until VRAELIS_PASS_PRICING=1: gatePassLaunch returns { mode: 'legacy' } with the flag off and the
// routes take today's credit-hold path untouched.
//
// Division of labor: pass-pricing.ts owns every pure DECISION (prices, plan catalog, monthly windows,
// canRunPass); this module only supplies the COUNTED USAGE (metered flow units in the anchor window, the
// lifetime free pass, the application count) and records usage on created runs. The metering rule mirrors
// the money rule exactly: a run consumes allowance iff the ledger would have kept its hold — completed
// runs and executed-then-failed runs consume; harness-invalidated runs (target_mismatch,
// flow_selection_invalid) and terminal failures/cancels that never executed a flow do not.

import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import {
  passPricingEnabled, planV1, canRunPass, passPriceCents, rerunPriceCents,
  monthlyWindow, FREE_TIER, PLAN_CATALOG_V1, type PlanV1,
} from "./pass-pricing";
import { resolveCanonicalCluster, activeFreeGrantOverride } from "./free-grant-cluster";
import { isBillingFrozen } from "./billing-freeze";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// ── Pure metering rules (no DB; fully covered by scripts/preflight-entitlements-verify.ts) ──────────

// Failure codes that NEVER consume allowance, even when a browser ran: target_mismatch is an operator
// invalidation of a harness bug (the run was refunded), and flow_selection_invalid fails before any
// browser session exists (never billable). Everything else defers to "did any flow actually execute".
export const NEVER_METERED_FAILURE_CODES = ["target_mismatch", "flow_selection_invalid"] as const;

export type MeterableRun = {
  state: string;                    // v_preflight_runs.state
  failureCode: string | null;       // v_preflight_runs.failure_code
  flowUnits: number | null;         // v_preflight_runs.flow_units (null on legacy rows)
  flowIdsLength: number;            // fallback unit count from the run snapshot's flow_ids
  executedAnyFlow: boolean;         // does the run have >= 1 v_flow_runs row
};

// Does this run consume subscription allowance / the lifetime free pass? Mirrors the ledger settlement:
// completed => charged; in-flight (queued/discovering/running/analyzing) => consumes like a hold, so a
// burst of concurrent launches cannot outrun the meter; terminal failed/cancelled => only if a flow
// actually executed (the worker refunds terminal failures that ran nothing), and never for the
// harness-invalidated codes above (those are refunded even after execution).
export function runConsumesAllowance(run: { state: string; failureCode: string | null; executedAnyFlow: boolean }): boolean {
  if (run.state === "completed") return true;
  if (run.state !== "failed" && run.state !== "cancelled") return true; // in-flight holds its units
  if (run.failureCode && (NEVER_METERED_FAILURE_CODES as readonly string[]).includes(run.failureCode)) return false;
  return run.executedAnyFlow;
}

// The flow units one run contributes: the recorded flow_units, falling back to the authoritative
// selection length (flow_ids) for the enqueue-to-record race window. Legacy rows (both null/0) meter 0.
export function meteredUnits(run: Pick<MeterableRun, "flowUnits" | "flowIdsLength">): number {
  return run.flowUnits ?? (run.flowIdsLength > 0 ? run.flowIdsLength : 0);
}

// Total metered flow units for a set of runs (one subscription month). A full pass adds its selected
// flow count; a targeted rerun adds only its selected count (approved ruling: reruns never burn a
// full-pass allowance — both are just their own flow_units here).
export function countMeterableUnits(runs: MeterableRun[]): number {
  return runs.reduce((sum, r) => (runConsumesAllowance(r) ? sum + meteredUnits(r) : sum), 0);
}

// Lifetime free pass: consumed by the FIRST run that consumes allowance under the same rule — an
// infra-failed or cancelled-before-execution run never uses up the free pass.
export function freePassConsumed(runs: { state: string; failureCode: string | null; executedAnyFlow: boolean }[]): boolean {
  return runs.some(runConsumesAllowance);
}

// ── The gate decision (pure; gatePassLaunch gathers the inputs) ──────────────────────────────────────

export type PassGateDecision =
  | { mode: "legacy"; ok: true }
  | { mode: "subscription"; ok: true; plan: PlanV1; unitsAfter: number }
  | { mode: "subscription"; ok: false; error: "flow_cap" | "allowance_exhausted"; message: string; status: 400 | 402 }
  | { mode: "free"; ok: true }
  | { mode: "payg"; ok: true; cents: number }
  // Blocker 2: a dispute/chargeback froze this owner's execution access. Refuses ALL spend surfaces
  // (new passes, reruns, PAYG, subscription allowance, new free entitlements) until manual restore.
  | { mode: "frozen"; ok: false; error: "billing_frozen"; message: string; status: 403 };

// Ladder: an active _v1 subscription is gated purely by canRunPass (flow cap + metered monthly
// allowance; NEVER auto-spilled into paid cents — exhaustion is a refusal, not a surprise charge). No
// subscription: the lifetime free pass covers a selection within FREE_TIER.flowsPerPass; everything else
// is PAYG at the public per-pass price ($15 base; reruns $3 x selected, capped at the comparable pass).
export function decidePassGate(input: {
  plan: PlanV1 | null; unitsUsedInWindow: number; freePassUsed: boolean; selectedFlows: number; rerun?: boolean;
}): PassGateDecision {
  if (input.plan) {
    const gate = canRunPass(input.plan, input.unitsUsedInWindow, input.selectedFlows);
    if (!gate.ok) {
      return { mode: "subscription", ok: false, error: gate.error, message: gate.message, status: gate.error === "flow_cap" ? 400 : 402 };
    }
    return { mode: "subscription", ok: true, plan: input.plan, unitsAfter: gate.unitsAfter };
  }
  if (!input.freePassUsed && input.selectedFlows <= FREE_TIER.flowsPerPass) return { mode: "free", ok: true };
  const cents = input.rerun ? rerunPriceCents(input.selectedFlows) : passPriceCents(input.selectedFlows);
  return { mode: "payg", ok: true, cents };
}

// ── Stripe price-id resolver for the six operator-created _v1 prices ─────────────────────────────────
// Env names extend the legacy STRIPE_PRICE_<PLAN>_<CYCLE> scheme: STRIPE_PRICE_BUILDER_V1_MONTHLY, ...
// Distinct names from the legacy plans, so a _v1 price can never resolve as starter/creator/pro/scale
// (and vice versa). Null when the id matches none of the six (fail closed: no plan_v1 is ever set from
// an unrecognized price).
export type PlanV1Cycle = "monthly" | "yearly";
export function resolvePlanV1FromPriceId(priceId: string | null | undefined): { key: PlanV1["key"]; cycle: PlanV1Cycle } | null {
  if (!priceId) return null;
  for (const plan of PLAN_CATALOG_V1) {
    for (const cycle of ["monthly", "yearly"] as const) {
      if (process.env[`STRIPE_PRICE_${plan.key.toUpperCase()}_${cycle.toUpperCase()}`] === priceId) {
        return { key: plan.key, cycle };
      }
    }
  }
  return null;
}

// ── Owner-scoped reads (all degrade to a safe null/zero pre-migration) ───────────────────────────────

export type PlanV1State = { plan: string; anchor: string | null; cycle: string | null };

// The owner's _v1 subscription state from v_profiles. Null when: DB unconfigured, the phase-6 migration
// is unapplied (the select errors on the missing columns), no profile row, or no plan_v1 set — every
// degradation reads as "no subscription", which routes to free/PAYG, never to a free allowance.
export async function getPlanV1State(owner: string): Promise<PlanV1State | null> {
  if (!owner || !isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_profiles" as never)
    .select("plan_v1, plan_v1_anchor, plan_v1_cycle").eq("user_id", norm(owner)).maybeSingle();
  if (error || !data) return null;
  const r = data as { plan_v1?: string | null; plan_v1_anchor?: string | null; plan_v1_cycle?: string | null };
  if (!r.plan_v1) return null;
  return { plan: r.plan_v1, anchor: r.plan_v1_anchor ?? null, cycle: r.plan_v1_cycle ?? null };
}

type RunRow = { id: string; state: string; failure_code: string | null; flow_units: number | null; flow_ids: unknown };

async function loadRuns(owner: string, startIso?: string, endIso?: string): Promise<RunRow[]> {
  if (!isDatabaseConfigured()) return [];
  let q = db().from("v_preflight_runs" as never)
    .select("id, state, failure_code, flow_units, flow_ids").eq("user_id", norm(owner));
  if (startIso) q = q.gte("created_at", startIso);
  if (endIso) q = q.lt("created_at", endIso);
  const { data, error } = await q.limit(1000);
  if (error) return []; // pre-migration / transient: degrade to "no usage" (routes stay usable)
  return (data as unknown as RunRow[]) ?? [];
}

// Load runs for a SET of owners (the canonical cluster) in one query. `ok` reports whether the read
// succeeded — the free-pass gate needs to distinguish "no runs" from "could not read", because the
// former means the pass is available and the latter must fail closed. Unlike loadRuns (which degrades to
// [] for the always-usable metering paths), this surfaces the error so freePassUsed can fail closed.
async function loadRunsForOwners(owners: string[]): Promise<{ rows: RunRow[]; ok: boolean }> {
  if (!isDatabaseConfigured() || owners.length === 0) return { rows: [], ok: false };
  const uids = owners.map(norm);
  const { data, error } = await db().from("v_preflight_runs" as never)
    .select("id, state, failure_code, flow_units, flow_ids").in("user_id", uids).limit(1000);
  if (error) return { rows: [], ok: false };
  return { rows: (data as unknown as RunRow[]) ?? [], ok: true };
}

// Which of these runs executed at least one flow (has a v_flow_runs row). Only queried for the terminal
// failed/cancelled candidates whose metering depends on it.
async function executedRunIds(runIds: string[]): Promise<Set<string>> {
  if (!runIds.length || !isDatabaseConfigured()) return new Set();
  const { data } = await db().from("v_flow_runs" as never)
    .select("preflight_run_id").in("preflight_run_id", runIds);
  return new Set(((data as unknown as { preflight_run_id: string }[]) ?? []).map((r) => String(r.preflight_run_id)));
}

async function toMeterable(rows: RunRow[]): Promise<MeterableRun[]> {
  const needExec = rows
    .filter((r) => (r.state === "failed" || r.state === "cancelled")
      && !(r.failure_code && (NEVER_METERED_FAILURE_CODES as readonly string[]).includes(r.failure_code)))
    .map((r) => r.id);
  const executed = await executedRunIds(needExec);
  return rows.map((r) => ({
    state: String(r.state ?? ""), failureCode: r.failure_code ?? null,
    flowUnits: r.flow_units == null ? null : Number(r.flow_units),
    flowIdsLength: Array.isArray(r.flow_ids) ? r.flow_ids.length : 0,
    executedAnyFlow: executed.has(r.id),
  }));
}

// Metered flow units the owner consumed in the subscription month containing `now`, computed from the
// anchor at request time (the same window function serves monthly AND annual billing — that is what
// releases an annual plan's usage month by month with no scheduler). Concurrency note: like the routes'
// other counters this is check-then-write; the per-owner active-run cap (2) bounds how far a racing
// burst can overshoot the allowance.
export async function flowUnitsUsedInWindow(owner: string, anchorIso: string, nowIso?: string): Promise<number> {
  const { start, end } = monthlyWindow(anchorIso, nowIso ?? new Date().toISOString());
  const rows = await loadRuns(owner, start, end);
  return countMeterableUnits(await toMeterable(rows));
}

// Has the owner's ONE lifetime free pass been used? The free pass is per REAL INBOX, not per exact email:
// it is consumed if ANY account in the owner's canonical cluster (you+a@ / you+b@ / dotted Gmail / a
// Google + a GitHub account on the same inbox) has a run that consumed allowance. This is what closes the
// OAuth free-pass hole — the cluster is resolved from user_profiles.canonical_email, which OAuth signup
// now populates.
//
// FAIL-CLOSED: if we cannot RELIABLY determine eligibility (cluster resolution unreliable, or the runs
// read errors), the pass is treated as USED so the launch routes to PAYG rather than leaking a free run.
// The escape valve is an operator comp (activeFreeGrantOverride): a legitimate user wrongly routed to
// PAYG by a transient error can be granted a free pass out of band, which short-circuits to "not used".
//
// A run consumes allowance when completed, in-flight, or executed-then-failed — an infra failure or a
// cancel before execution never burns the free pass (runConsumesAllowance).
export async function freePassUsed(owner: string): Promise<boolean> {
  const cluster = await resolveCanonicalCluster(owner);
  // Operator comp always wins: an explicit grant means the free pass is available regardless of history
  // or reliability. Checked first so a comped user is never blocked by a fail-closed path.
  if (await activeFreeGrantOverride(owner, cluster.canonical)) return false;
  // Cluster resolution unreliable (DB error / column missing) -> cannot trust dedup -> fail closed.
  if (!cluster.ok) return true;
  const { rows, ok } = await loadRunsForOwners(cluster.members);
  if (!ok) return true; // runs read failed -> cannot confirm the pass is unused -> fail closed
  // Fast path: any completed or in-flight run across the cluster settles it without touching v_flow_runs.
  if (rows.some((r) => r.state !== "failed" && r.state !== "cancelled")) return true;
  return freePassConsumed(await toMeterable(rows));
}

// Application cap: FREE_TIER 1; builder_v1 2; pro_v1 10; scale_v1 uncapped (maxApplications null). A
// PAYG owner with no subscription is capped at the free tier's count. Degrades open on a read error —
// the cap is a plan perk, not a security boundary.
export async function applicationCapReached(owner: string, planKey: string | null): Promise<boolean> {
  const plan = planKey ? planV1(planKey) : null;
  const cap = plan ? plan.maxApplications : FREE_TIER.maxApplications;
  if (cap === null) return false;
  if (!isDatabaseConfigured()) return false;
  const { count, error } = await db().from("v_applications" as never)
    .select("id", { count: "exact", head: true }).eq("user_id", norm(owner));
  if (error) return false;
  return (count ?? 0) >= cap;
}

// ── The launch gate the run routes call ──────────────────────────────────────────────────────────────
// Flag off => { mode: 'legacy' } and the caller takes today's credit-hold path byte-for-byte. Flag on:
// subscription => canRunPass over the metered window; free => the lifetime pass; payg => the cents to
// hold (the route holds them with unit='cent' under the exact legacy reservation semantics).
export async function gatePassLaunch(owner: string, selectedFlowCount: number, opts: { rerun?: boolean } = {}): Promise<PassGateDecision> {
  if (!passPricingEnabled()) return { mode: "legacy", ok: true };
  // Blocker 2: a disputed/chargebacked owner is frozen — refuse EVERY spend surface (this single gate
  // covers new passes, reruns, PAYG, subscription allowance, and new free entitlements) until an operator
  // restores access after a won dispute. Checked FIRST so a frozen subscriber can't spend their metered
  // allowance and a frozen free user can't take a free/PAYG run.
  if (await isBillingFrozen(owner)) {
    return { mode: "frozen", ok: false, error: "billing_frozen", status: 403,
      message: "This account is on hold while a payment dispute is resolved. Contact support to restore access." };
  }
  const state = await getPlanV1State(owner);
  const plan = state ? planV1(state.plan) : null;
  if (plan) {
    // A plan without an anchor (webhook raced/degraded) meters an empty window — fail-open by at most
    // one window for a PAYING subscriber, never a charge.
    const units = state?.anchor ? await flowUnitsUsedInWindow(owner, state.anchor) : 0;
    return decidePassGate({ plan, unitsUsedInWindow: units, freePassUsed: true, selectedFlows: selectedFlowCount, rerun: opts.rerun });
  }
  const used = await freePassUsed(owner);
  return decidePassGate({ plan: null, unitsUsedInWindow: 0, freePassUsed: used, selectedFlows: selectedFlowCount, rerun: opts.rerun });
}

// ── Usage recording + webhook plan state (writes) ────────────────────────────────────────────────────

// Record the selected-flow units a just-created run consumes (subscription metering) and, for PAYG, the
// cents escrowed (audit mirror of the 'cent' hold). Best-effort: the run is already queued and billed;
// a missing column degrades to a warn, and metering falls back to flow_ids length.
export async function recordRunPassUsage(owner: string, runId: string, usage: { flowUnits: number; heldCents?: number | null }): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const patch: Record<string, unknown> = { flow_units: usage.flowUnits };
  if (usage.heldCents != null) patch.held_cents = usage.heldCents;
  const { error } = await db().from("v_preflight_runs" as never)
    .update(patch as never).eq("user_id", norm(owner)).eq("id", runId);
  if (error) console.warn(`recordRunPassUsage (${runId}): ${error.message} — apply sql/vraelis-preflight-6-pass-pricing.sql`);
}

// Set the owner's _v1 plan state from the Stripe webhook. anchorOnlyIfUnset=true (renewals, subscription
// updates) preserves the FIRST period's anchor so the monthly windows never drift; false
// (subscription_create) resets it — a brand-new subscription starts fresh windows. Flag-INDEPENDENT
// storage: writing plan_v1 is inert until the flag flips (nothing reads it before then). NEVER grants
// credits (the _v1 allowance is metered, not granted).
export async function setPlanV1(owner: string, args: { plan: string; cycle: string; anchorIso: string; anchorOnlyIfUnset: boolean }): Promise<void> {
  if (!owner || !isDatabaseConfigured()) return;
  const uid = norm(owner);
  const s = db();
  // Resurrect guard (blocker 2): if this owner is frozen by a dispute, an out-of-order 'active' webhook
  // (Stripe redelivers out of order) must NOT re-activate plan_v1. A frozen owner's plan is preserved in
  // previous_plan_v1 and restored MANUALLY after a won dispute — never by a racing subscription event.
  // Best-effort read; a missing column (pre-migration) simply skips the guard (no behavior change then).
  {
    const { data: frozenRow } = await s.from("v_profiles" as never)
      .select("billing_access_state").eq("user_id", uid).maybeSingle();
    if ((frozenRow as { billing_access_state?: string | null } | null)?.billing_access_state === "frozen_dispute") {
      console.warn(`[entitlements] setPlanV1 suppressed for frozen (disputed) owner ${uid}; plan stays frozen until manual restore.`);
      return;
    }
  }
  let keepAnchor = false;
  if (args.anchorOnlyIfUnset) {
    const { data } = await s.from("v_profiles" as never).select("plan_v1_anchor").eq("user_id", uid).maybeSingle();
    keepAnchor = Boolean((data as { plan_v1_anchor?: string | null } | null)?.plan_v1_anchor);
  }
  const payload: Record<string, unknown> = { user_id: uid, plan_v1: args.plan, plan_v1_cycle: args.cycle };
  if (!keepAnchor) payload.plan_v1_anchor = args.anchorIso;
  const { error } = await s.from("v_profiles" as never).upsert(payload as never, { onConflict: "user_id" } as never);
  if (error) console.error(`setPlanV1 (${args.plan}): ${error.message} — apply sql/vraelis-preflight-6-pass-pricing.sql`);
}

// Clear the _v1 plan on the subscription DELETION event only (ruling 8: cancel-at-period-end keeps
// paid-for access — plan_v1 stays through the notice period and past_due dunning; there is no credit
// clawback because nothing was ever granted).
export async function clearPlanV1(owner: string): Promise<void> {
  if (!owner || !isDatabaseConfigured()) return;
  const { error } = await db().from("v_profiles" as never)
    .update({ plan_v1: null, plan_v1_anchor: null, plan_v1_cycle: null } as never).eq("user_id", norm(owner));
  if (error) console.error(`clearPlanV1: ${error.message}`);
}
