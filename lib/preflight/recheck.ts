// Re-checks: the coding agent's half of the repair loop.
//
// A person approves a plan once, on /review/{id}. The agent that asked for the check can then run that SAME
// approved plan again after each fix, without another click, until it comes back Verified. That is the whole
// feature, and every rule below exists to keep "without another click" from turning into "the agent approves
// its own work":
//
//   1. The approval at the root of the chain was given by a PERSON. A plan approved with an API key (which
//      the approve route no longer allows, but older rows exist) cannot be re-checked: nobody stood behind
//      it, so there is nothing to carry forward.
//   2. The re-check runs the approved contract verbatim. The caller picks nothing but the moment.
//   3. It targets the SAME ORIGIN the person approved. A different host would let an agent point the
//      approved journeys at a copy of the app it controls and collect a Verified the real app never earned.
//   4. It is bounded: RECHECK_WINDOW_MS after the approval, and MAX_RECHECKS_PER_APPROVAL runs in total.
//      Past either, the agent asks the person again. Every re-check is also a normal paid verification
//      through the unchanged acceptance path, so every owner and per-key spend limit still applies.
//
// This file is the pure decision plus the two reads it needs. The route renders it.
import { getReviewedPlanByRunId, type ReviewedPlanProvenance } from "./reviewed-plan-db";
import { getRunParentId, listChildRuns } from "./runs-db";

export const RECHECK_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MAX_RECHECKS_PER_APPROVAL = 10;

// A lineage walk can never be longer than the cap allows, plus slack for runs launched before the cap
// existed. Bounded so a corrupt parent cycle can never hang a request.
const MAX_WALK = MAX_RECHECKS_PER_APPROVAL + 5;

/** An approver recorded as an email is a signed-in person. Anything else is a key prefix. */
export function approvedByPerson(approvedBy: string | null | undefined): boolean {
  const a = (approvedBy ?? "").trim();
  return a.includes("@") && !a.startsWith("vr_");
}

/** Same scheme and host. Paths may differ; the approved journeys decide where they navigate. */
export function sameOrigin(a: string, b: string): boolean {
  try {
    const x = new URL(a), y = new URL(b);
    return x.protocol === y.protocol && x.host.toLowerCase() === y.host.toLowerCase();
  } catch { return false; }
}

export type RecheckRoot = { rootRunId: string; plan: ReviewedPlanProvenance; hops: number };

/** Walk parent_run_id up from a run to the run that consumed a reviewed plan. That plan's approval is the
 *  one every re-check in the chain stands on. Null when no run in the chain consumed one. */
export async function findApprovalRoot(owner: string, runId: string): Promise<RecheckRoot | null> {
  let current: string | null = runId;
  for (let hops = 0; current && hops <= MAX_WALK; hops++) {
    const plan = await getReviewedPlanByRunId(owner, current);
    if (plan) return { rootRunId: current, plan, hops };
    current = await getRunParentId(owner, current);
  }
  return null;
}

/** Every run descended from the root, at any depth. Siblings count too: ten parallel re-checks of the root
 *  are ten re-checks, not one. */
export async function countRechecks(owner: string, rootRunId: string): Promise<number> {
  let count = 0;
  const queue = [rootRunId];
  const seen = new Set(queue);
  while (queue.length && count <= MAX_WALK * 4) {
    const children = await listChildRuns(owner, queue.shift() as string);
    for (const c of children) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      count++;
      queue.push(c.id);
    }
  }
  return count;
}

export type RecheckInput = {
  /** The run being re-checked has a verdict. Re-checking a run still in flight would race it. */
  parentCompleted: boolean;
  /** Guarantee runs re-verify through their own route, which re-reads the guarantee's current meaning. */
  parentGuaranteeId: string | null;
  root: RecheckRoot | null;
  used: number;
  /** The origin the person approved, and the one this re-check would hit. */
  approvedUrl: string;
  targetUrl: string;
  nowMs: number;
};

export type RecheckVerdict =
  | { ok: true; windowEndsAt: string; left: number }
  | { ok: false; code: string; status: number; message: string };

const refuse = (code: string, status: number, message: string): RecheckVerdict => ({ ok: false, code, status, message });

/** Pure and total, so every refusal is testable without a database. Order: what the run is, who approved
 *  it, where it would run, then the two bounds. */
export function decideRecheck(i: RecheckInput): RecheckVerdict {
  if (!i.parentCompleted) return refuse("verification_running", 409, "That verification has not finished. Wait for its decision, then re-check.");
  if (i.parentGuaranteeId) return refuse("guarantee_verification", 409, "That verification proves a guarantee. Verify the guarantee again instead.");
  if (!i.root) return refuse("recheck_not_available", 409, "That verification did not run an approved plan, so there is nothing to re-check. Start a new verification.");
  if (i.root.plan.approvalState !== "approved" || !approvedByPerson(i.root.plan.approvedBy)) {
    return refuse("plan_requires_human", 403, "A person has to approve a plan before it can be re-checked. Start a new verification and approve its plan in Vraelis.");
  }
  if (!sameOrigin(i.approvedUrl, i.targetUrl)) {
    return refuse("recheck_origin_changed", 409, "A re-check runs on the site the plan was approved for. For a different site, start a new verification.");
  }
  const approvedAt = new Date(i.root.plan.approvedAt ?? "").getTime();
  if (!Number.isFinite(approvedAt)) return refuse("plan_requires_human", 403, "That plan records no approval time, so it cannot be re-checked. Start a new verification.");
  const windowEnds = approvedAt + RECHECK_WINDOW_MS;
  if (i.nowMs >= windowEnds) return refuse("recheck_window_closed", 409, "The approval behind this verification is more than 24 hours old. Start a new verification and approve its plan again.");
  if (i.used >= MAX_RECHECKS_PER_APPROVAL) return refuse("recheck_limit_reached", 409, `This approval has been re-checked ${MAX_RECHECKS_PER_APPROVAL} times. Start a new verification and approve its plan again.`);
  return { ok: true, windowEndsAt: new Date(windowEnds).toISOString(), left: MAX_RECHECKS_PER_APPROVAL - i.used - 1 };
}
