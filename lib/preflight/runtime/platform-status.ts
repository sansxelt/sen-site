// Per-runtime platform status (API beta). Produces INDEPENDENT web and API verdicts for an application so the
// overview never collapses them into one scalar. Web is read the EXACT way page.tsx reads it today
// (pickHealthRun over the app's runs) — unchanged. API is read from v_platform_decisions filtered to the
// app's api target — a SEPARATE table, so an API decision can never overwrite or be conflated with web.

import { getSupabaseAdminClient } from "../../supabase-admin";
import { toPublicDecision } from "../public-decision";
import { getApiTarget } from "./targets-db";

function db() { return getSupabaseAdminClient(); }

export type PlatformVerdict = "VERIFIED" | "FAILED" | "BLOCKED" | "NOT VERIFIED" | "COULD NOT COMPLETE";

// THE LAST FALSE VERIFIED, AND IT WAS ON A LINE LABELLED "API".
//
// This file used to hold its own decision table, and that table said `repair_verified: "VERIFIED"`.
// toPublicDecision says blocked, and says it for a reason the product is built on: a targeted repair rerun
// exercises only the flows that had already failed, so it is evidence the repair worked and never evidence
// the system's critical promises hold. Every other surface had been brought onto the canonical mapper —
// the public API, the CI gate, the outbound webhooks, the api-runtime workspace one click away, and, in
// this very component, the WEB half of the same two-chip strip. The API half went on printing VERIFIED in
// green for a run all of them call Blocked, so the strip whose entire purpose is showing web and API as
// two independent truths was showing one true answer beside one false one.
//
// There is no corrected second table here now, because a second table is the defect: a decision added to
// one map and forgotten in the other is how this happened. The three real conclusions are whatever the one
// mapper says they are, rendered in this surface's uppercase house style.
const PUBLIC_VERDICT: Record<string, PlatformVerdict> = {
  verified: "VERIFIED", failed: "FAILED", blocked: "BLOCKED",
};
// The two decisions that are an ABSENCE of a verdict rather than a verdict. toPublicDecision has nothing to
// say about them by design (lib/preflight/public-decision.ts skips exactly these two when it round-trips
// payload labels), so this surface keeps its own words for "no answer was reached".
const ABSENCE: Record<string, PlatformVerdict> = {
  infra_failure: "COULD NOT COMPLETE", not_verified: "NOT VERIFIED",
};

/** A recorded platform decision -> the customer-facing verdict for this strip. A row in
 *  v_platform_decisions exists only because a run reached a decision, which is the "completed" state the
 *  mapper is asked about; an unrecognized decision falls to the mapper's own answer for one, which is
 *  Blocked, never a pass. */
function platformVerdict(decision: string): PlatformVerdict {
  const absent = ABSENCE[decision];
  if (absent) return absent;
  const pub = toPublicDecision("completed", decision);
  return pub ? PUBLIC_VERDICT[pub] : "NOT VERIFIED";
}

export type ApiStatus = { hasTarget: boolean; verdict: PlatformVerdict; latestRunId: string | null; testedAt: string | null };

// The API target's latest platform decision -> a customer verdict. NOT_VERIFIED when no target or no decision.
export async function getApiStatus(owner: string, appId: string): Promise<ApiStatus> {
  const target = await getApiTarget(owner, appId);
  if (!target) return { hasTarget: false, verdict: "NOT VERIFIED", latestRunId: null, testedAt: null };
  const { data } = await db().from("v_platform_decisions").select("decision,run_id,created_at")
    .eq("user_id", owner).eq("application_id", appId).eq("runtime_target_id", target.id)
    .order("created_at", { ascending: false }).limit(1);
  const row = (data as { decision: string; run_id: string | null; created_at: string }[] | null)?.[0];
  if (!row) return { hasTarget: true, verdict: "NOT VERIFIED", latestRunId: null, testedAt: null };
  return { hasTarget: true, verdict: platformVerdict(row.decision), latestRunId: row.run_id, testedAt: row.created_at };
}
