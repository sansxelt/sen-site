// Per-runtime platform status (API beta). Produces INDEPENDENT web and API verdicts for an application so the
// overview never collapses them into one scalar. Web is read the EXACT way page.tsx reads it today
// (pickHealthRun over the app's runs) — unchanged. API is read from v_platform_decisions filtered to the
// app's api target — a SEPARATE table, so an API decision can never overwrite or be conflated with web.

import { getSupabaseAdminClient } from "../../supabase-admin";
import { getApiTarget } from "./targets-db";

function db() { return getSupabaseAdminClient(); }

export type PlatformVerdict = "READY" | "BLOCKED" | "REPAIR VERIFIED" | "NEEDS REVIEW" | "NOT VERIFIED" | "COULD NOT COMPLETE";
const DECISION_VERDICT: Record<string, PlatformVerdict> = {
  ready: "READY", blocked: "BLOCKED", repair_verified: "REPAIR VERIFIED", needs_review: "NEEDS REVIEW",
  infra_failure: "COULD NOT COMPLETE", not_verified: "NOT VERIFIED",
};

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
  return { hasTarget: true, verdict: DECISION_VERDICT[row.decision] ?? "NOT VERIFIED", latestRunId: row.run_id, testedAt: row.created_at };
}
