// Owner-scoped reads/writes the RUN REPORT + RERUN need that the sanctioned polling payload (runs-db.ts
// getRun) deliberately omits. getRun is the id-less, owner-safe polling shape (run header + flows + steps +
// issues); it exposes no application_id, no contract id/version, no flow-run id, no test_flow_id, and no
// artifact id. Those internal handles are exactly what a rerun (which must re-target the same app + contract
// and re-run the parent's flows) and a rich report (readable flow names + evidence screenshots) require, so
// they live here as focused, owner-scoped, degrade-safe helpers — the same service-role + user_id = lowercased
// email model as v-applications.ts / runs-db.ts. Server-only. NEVER returns a storage_path, provider session,
// signed URL, or billing internal to a caller that forwards it to the client; the artifact ids returned here
// are resolved to short-TTL signed URLs only by the owner-checked artifacts route.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// The internal handles a rerun needs, read from the parent run row (owner-scoped). Null when the run is not
// owned / not found / tables unmigrated.
export type RunInternal = {
  applicationId: string; deploymentUrl: string | null;
  contractId: string | null; contractVersion: number | null; state: string;
  // The parent's guarantee pin, so a rerun can INHERIT the meaning it proved rather than look up whatever
  // the guarantee says today. Null on a plain verification and on every run predating migration 23.
  guaranteeId: string | null; guaranteePlanVersion: number | null;
  guaranteePlanHash: string | null; guaranteeReviewedPlanId: string | null;
};

const RUN_INTERNAL_BASE = "application_id, deployment_url, contract_id, contract_version, state";
const RUN_INTERNAL_GUARANTEE = "guarantee_id, guarantee_plan_version, guarantee_plan_hash, guarantee_reviewed_plan_id";

export async function getRunInternal(owner: string, runId: string): Promise<RunInternal | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);
  // The guarantee columns are additive (migration 23). Selecting a column that does not exist fails the
  // WHOLE query, so a rerun would stop working on an unmigrated database; ask for them, and on a
  // column-missing error fall back to the base select and carry nulls. Same degrade-cleanly rule the run
  // insert follows.
  let r: Record<string, unknown> | null = null;
  const withGuarantee = await db().from("v_preflight_runs")
    .select(`${RUN_INTERNAL_BASE}, ${RUN_INTERNAL_GUARANTEE}`)
    .eq("user_id", uid).eq("id", runId).maybeSingle();
  if (withGuarantee.error) {
    if (/guarantee_/i.test(withGuarantee.error.message ?? "")) {
      console.warn("getRunInternal: the guarantee binding columns are missing. Apply sql/vraelis-preflight-23-guarantee-binding.sql (migration 23). Reruns will not inherit a guarantee.");
    }
    const base = await db().from("v_preflight_runs").select(RUN_INTERNAL_BASE)
      .eq("user_id", uid).eq("id", runId).maybeSingle();
    r = (base.data as Record<string, unknown> | null) ?? null;
  } else {
    r = (withGuarantee.data as Record<string, unknown> | null) ?? null;
  }
  if (!r) return null;
  return {
    applicationId: String(r.application_id ?? ""), deploymentUrl: (r.deployment_url as string) ?? null,
    contractId: (r.contract_id as string) ?? null,
    contractVersion: typeof r.contract_version === "number" ? r.contract_version : null,
    state: String(r.state ?? ""),
    guaranteeId: (r.guarantee_id as string) ?? null,
    guaranteePlanVersion: typeof r.guarantee_plan_version === "number" ? r.guarantee_plan_version : null,
    guaranteePlanHash: (r.guarantee_plan_hash as string) ?? null,
    guaranteeReviewedPlanId: (r.guarantee_reviewed_plan_id as string) ?? null,
  };
}

// The flows a parent run actually executed, with their test_flow_id + terminal state — the basis for a
// "rerun failed" / "rerun all" selection. Only rows with a real test_flow_id are returned (a flow with no
// contract linkage can't be re-selected by id). Owner-scoped; degrades to [].
export type ParentRunFlow = { testFlowId: string; state: string };
export async function parentRunFlows(owner: string, runId: string): Promise<ParentRunFlow[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_flow_runs")
    .select("test_flow_id, state").eq("user_id", norm(owner)).eq("preflight_run_id", runId);
  const rows = (data as Record<string, unknown>[] | null) ?? [];
  const out: ParentRunFlow[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const tid = r.test_flow_id ? String(r.test_flow_id) : "";
    if (!tid || seen.has(tid)) continue;                 // de-dup: a flow appears once per run
    seen.add(tid);
    out.push({ testFlowId: tid, state: String(r.state ?? "") });
  }
  return out;
}

// Best-effort parent linkage on a freshly created rerun. createRun (stream 1's shared creator) does not
// accept a parent id, so the immutable run is stamped here right after creation. Owner-scoped; if the
// parent_run_id column is not in the applied migration, this degrades to a silent no-op and the rerun still
// stands on its own (the linkage is provenance, not correctness).
export async function setParentRun(owner: string, runId: string, parentRunId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  try {
    await db().from("v_preflight_runs").update({ parent_run_id: parentRunId } as never)
      .eq("user_id", norm(owner)).eq("id", runId);
  } catch { /* column absent pre-migration -> provenance is best-effort */ }
}

// Per-flow display metadata for the report: a human flow name (resolved from the contract, since the worker
// stores the flow's id in v_flow_runs.name) and the ids of any evidence screenshots. Keyed by rawName =
// v_flow_runs.name, which is exactly the value getRun surfaces as flow.name, so the report can join this onto
// getRun's flows by name without needing an id getRun does not expose. Owner-scoped; degrades to [].
export type FlowRunMeta = { rawName: string; displayName: string; screenshotIds: string[] };
export async function listFlowRunMeta(owner: string, runId: string): Promise<FlowRunMeta[]> {
  if (!isDatabaseConfigured()) return [];
  const uid = norm(owner);
  const { data: flowRows } = await db().from("v_flow_runs")
    .select("id, name, test_flow_id, created_at").eq("user_id", uid).eq("preflight_run_id", runId)
    .order("created_at", { ascending: true });
  const flows = (flowRows as Record<string, unknown>[] | null) ?? [];
  if (!flows.length) return [];

  // Resolve human names from the contract's test flows (worker persists v_flow_runs.name = the flow id).
  const testFlowIds = Array.from(new Set(flows.map((f) => (f.test_flow_id ? String(f.test_flow_id) : "")).filter(Boolean)));
  const nameByTestFlow = new Map<string, string>();
  if (testFlowIds.length) {
    const { data: tfRows } = await db().from("v_test_flows").select("id, name").eq("user_id", uid).in("id", testFlowIds);
    for (const t of (tfRows as Record<string, unknown>[] | null) ?? []) nameByTestFlow.set(String(t.id), String(t.name ?? ""));
  }

  // Screenshot artifacts grouped by flow run. Filtered to screenshot-kind artifacts; ids only (paths never
  // leave the server — the owner-checked artifacts route mints the signed URL from the id).
  const shotsByFlowRun = new Map<string, string[]>();
  const { data: artRows } = await db().from("v_run_artifacts")
    .select("id, flow_run_id, kind").eq("user_id", uid).eq("preflight_run_id", runId);
  for (const a of (artRows as Record<string, unknown>[] | null) ?? []) {
    if (!String(a.kind ?? "").toLowerCase().includes("screenshot")) continue;
    const frId = a.flow_run_id ? String(a.flow_run_id) : "";
    if (!frId) continue;
    const arr = shotsByFlowRun.get(frId) ?? [];
    arr.push(String(a.id));
    shotsByFlowRun.set(frId, arr);
  }

  return flows.map((f) => {
    const rawName = String(f.name ?? "");
    const tid = f.test_flow_id ? String(f.test_flow_id) : "";
    const resolved = (tid && nameByTestFlow.get(tid)) || "";
    return { rawName, displayName: resolved || rawName, screenshotIds: shotsByFlowRun.get(String(f.id)) ?? [] };
  });
}
