// Data layer for Vraelis Preflight — connected applications, their Production Contract, requirements, and
// test flows. Server-only: service-role client scoped by user_id = lowercased email (the same ownership
// model as the rest of the app; RLS is only a deny-anon backstop). Every read degrades to empty/null if
// the tables aren't migrated yet, so the Product Shell renders cleanly before sql/vraelis-preflight.sql
// is applied. No browser execution, discovery, or billing lives here — this is the shell's data plane.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { pickHealthRun } from "./preflight/target-url";
import { logEvent } from "./v-events";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

export type Severity = "critical" | "important" | "informational";
export type Builder = "claude_code" | "cursor" | "lovable" | "bolt" | "replit" | "v0" | "other";

export type Application = {
  id: string; user_id: string; workspace_id: string | null; name: string; app_url: string;
  framework: string | null; builder: string | null; repo: string | null; deployment_provider: string | null;
  ownership_confirmed: boolean; status: string; created_at: string; updated_at: string;
};
export type ProductionContract = {
  id: string; application_id: string; version: number; status: "draft" | "approved"; source_prompt: string | null; approved_at: string | null; created_at: string;
};
export type ContractRequirement = {
  id: string; contract_id: string; category: string; requirement: string; severity: Severity; enabled: boolean;
  source: string | null; confidence: number | null; role: string | null; area: string | null; approved: boolean; order_index: number;
  // Phase-2 additive column (sql/vraelis-preflight-2-discovery.sql); absent until that migration runs.
  // "inference" marks a requirement Vraelis proposed from a presence signal rather than observed evidence.
  origin?: string | null;
};
export type TestFlow = {
  id: string; contract_id: string; name: string; goal: string | null; role: string | null; start_path: string | null;
  steps: unknown[]; expected: Record<string, unknown>; destructive_allowed: boolean; max_ms: number; priority: Severity; enabled: boolean; order_index: number;
  // Phase-2 additive columns (sql/vraelis-preflight-2-discovery.sql); absent until that migration runs.
  requirement_ids?: string[] | null; review_state?: string | null;
};
// Lightweight run row for the dashboard/list (no heavy evidence payload).
export type RunSummary = {
  id: string; application_id: string; state: string; decision: string | null; summary: Record<string, unknown>;
  deployment_url: string | null; commit_sha: string | null; created_at: string; completed_at: string | null;
};

export type NewApplication = { name: string; appUrl: string; builder?: string; repo?: string; sourcePrompt?: string; ownershipConfirmed: boolean; workspaceId?: string | null };

// ── Applications ──
export async function listApplications(userId: string): Promise<Application[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_applications").select("*").eq("user_id", norm(userId)).order("created_at", { ascending: false });
  if (error) return []; // table not migrated yet, or transient — the shell renders an empty state
  return (data as Application[]) ?? [];
}

export async function getApplication(userId: string, id: string): Promise<Application | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_applications").select("*").eq("user_id", norm(userId)).eq("id", id).maybeSingle();
  return (data as unknown as Application) ?? null;
}

// Create an application + its initial draft Production Contract (with the build prompt as the contract
// source). Ownership must be confirmed by the caller (the "I own/authorized this app" attestation).
export async function createApplication(userId: string, input: NewApplication): Promise<{ ok: true; application: Application } | { ok: false; error: string }> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const uid = norm(userId);
  if (!input.ownershipConfirmed) return { ok: false, error: "ownership_required" };
  const name = (input.name || "").trim().slice(0, 140);
  const appUrl = (input.appUrl || "").trim().slice(0, 2000);
  if (!name || !appUrl) return { ok: false, error: "name_and_url_required" };

  const { data, error } = await db().from("v_applications").insert({
    user_id: uid, name, app_url: appUrl, builder: input.builder ?? null, repo: input.repo ?? null,
    ownership_confirmed: true, workspace_id: input.workspaceId ?? null,
  } as never).select("*").single();
  if (error || !data) return { ok: false, error: "insert_failed" };
  const app = data as Application;

  // Seed a draft contract so the user immediately lands on something to review/edit (discovery fills it
  // in Phase 2; for now it starts empty + editable).
  await db().from("v_production_contracts").insert({ application_id: app.id, user_id: uid, version: 1, status: "draft", source_prompt: (input.sourcePrompt || "").slice(0, 20000) || null } as never);
  await logEvent({ userId: uid, eventType: "preflight_app_connected", actorType: "owner", source: "app", metadata: { application_id: app.id } });
  return { ok: true, application: app };
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  // True only when a row was actually removed: a zero-row delete is no PostgREST error, and a false
  // "deleted" would also falsely imply the cascade (connections + sealed credentials) ran.
  const { data, error } = await db().from("v_applications").delete().eq("user_id", norm(userId)).eq("id", id).select("id");
  return !error && Array.isArray(data) && data.length > 0;
}

// ── Production Contract + requirements + flows (read for the shell; manual edits in Phase 1) ──
export async function getContract(userId: string, applicationId: string): Promise<ProductionContract | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_production_contracts").select("*").eq("user_id", norm(userId)).eq("application_id", applicationId).order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as unknown as ProductionContract) ?? null;
}

// A contract by its own id, owner-scoped (route guards read this before allowing a mutation).
export async function getContractById(userId: string, contractId: string): Promise<ProductionContract | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_production_contracts").select("*").eq("user_id", norm(userId)).eq("id", contractId).maybeSingle();
  return (data as unknown as ProductionContract) ?? null;
}

// The latest APPROVED contract for an app (may differ from getContract when a newer draft revision
// exists). Runs verify against this one until the draft is approved.
export async function getApprovedContract(userId: string, applicationId: string): Promise<ProductionContract | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_production_contracts").select("*").eq("user_id", norm(userId)).eq("application_id", applicationId)
    .eq("status", "approved").order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as unknown as ProductionContract) ?? null;
}

// Status of the contract that owns a requirement, both lookups owner-scoped. Null when the requirement
// (or its contract) does not exist for this owner, so callers fall through to their normal not-found path.
export async function contractStatusForRequirement(userId: string, requirementId: string): Promise<"draft" | "approved" | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(userId);
  const { data } = await db().from("v_contract_requirements").select("contract_id").eq("user_id", uid).eq("id", requirementId).maybeSingle();
  const contractId = (data as { contract_id?: string } | null)?.contract_id;
  if (!contractId) return null;
  const contract = await getContractById(uid, contractId);
  return contract?.status ?? null;
}

export async function listRequirements(userId: string, contractId: string): Promise<ContractRequirement[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_contract_requirements").select("*").eq("user_id", norm(userId)).eq("contract_id", contractId).order("order_index", { ascending: true });
  return (data as ContractRequirement[]) ?? [];
}

// Verify a contract belongs to this owner (used before any requirement mutation).
async function ownsContract(uid: string, contractId: string): Promise<boolean> {
  const { data } = await db().from("v_production_contracts").select("id").eq("user_id", uid).eq("id", contractId).maybeSingle();
  return !!data;
}

export async function addRequirement(userId: string, contractId: string, input: { requirement: string; category?: string; severity?: Severity; role?: string; area?: string }): Promise<ContractRequirement | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(userId);
  if (!(await ownsContract(uid, contractId))) return null;
  const requirement = (input.requirement || "").trim().slice(0, 400);
  if (!requirement) return null;
  const { data } = await db().from("v_contract_requirements").insert({
    contract_id: contractId, user_id: uid, requirement, category: (input.category || "general").slice(0, 60),
    // Provenance (S7): hand-added requirements record source "manual" (the closed provenance set); the
    // origin column keeps its default "user". Older rows with source "user"/"seed" stay labeled honestly.
    severity: input.severity ?? "important", source: "manual", approved: true, enabled: true,
    role: input.role ?? null, area: input.area ?? null, order_index: 9999,
  } as never).select("*").single();
  return (data as unknown as ContractRequirement) ?? null;
}

// Owner-scoped patch of a requirement (toggle enabled, change severity, edit text). Marks it approved so
// a later AI regeneration never silently overwrites a user-touched requirement.
export async function updateRequirement(userId: string, id: string, patch: { enabled?: boolean; severity?: Severity; requirement?: string }): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const fields: Record<string, unknown> = { approved: true };
  if (typeof patch.enabled === "boolean") fields.enabled = patch.enabled;
  if (patch.severity) fields.severity = patch.severity;
  if (typeof patch.requirement === "string") fields.requirement = patch.requirement.trim().slice(0, 400);
  const { error } = await db().from("v_contract_requirements").update(fields as never).eq("user_id", norm(userId)).eq("id", id);
  return !error;
}

export async function deleteRequirement(userId: string, id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error } = await db().from("v_contract_requirements").delete().eq("user_id", norm(userId)).eq("id", id);
  return !error;
}

// Approve a contract (requires at least one enabled requirement). Approval is the gate before a paid run.
export async function approveContract(userId: string, contractId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const uid = norm(userId);
  const reqs = await listRequirements(uid, contractId);
  if (!reqs.some((r) => r.enabled)) return false;
  const { error } = await db().from("v_production_contracts").update({ status: "approved", approved_at: new Date().toISOString() } as never).eq("user_id", uid).eq("id", contractId);
  if (!error) await logEvent({ userId: uid, eventType: "preflight_contract_approved", actorType: "owner", source: "app", metadata: { contract_id: contractId, requirements: reqs.length } });
  return !error;
}

export async function listFlows(userId: string, contractId: string): Promise<TestFlow[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_test_flows").select("*").eq("user_id", norm(userId)).eq("contract_id", contractId).order("order_index", { ascending: true });
  return (data as TestFlow[]) ?? [];
}

export async function listRuns(userId: string, applicationId: string, limit = 20): Promise<RunSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_preflight_runs").select("id,application_id,state,decision,summary,deployment_url,commit_sha,created_at,completed_at").eq("user_id", norm(userId)).eq("application_id", applicationId).order("created_at", { ascending: false }).limit(limit);
  return (data as RunSummary[]) ?? [];
}

// Latest run per application, for dashboard status chips. One query, grouped in memory.
export async function latestRunByApp(userId: string, appIds: string[]): Promise<Record<string, RunSummary>> {
  if (!isDatabaseConfigured() || !appIds.length) return {};
  const { data } = await db().from("v_preflight_runs").select("id,application_id,state,decision,summary,deployment_url,commit_sha,created_at,completed_at").eq("user_id", norm(userId)).in("application_id", appIds).order("created_at", { ascending: false });
  // Application HEALTH comes from pickHealthRun, never "newest terminal row": the newest ACTIVE run still
  // surfaces as in-progress, but a failed / invalidated run (e.g. a harness target_mismatch) can never
  // displace the newest VALID completed decision.
  const byApp = new Map<string, RunSummary[]>();
  for (const r of (data as RunSummary[]) ?? []) {
    if (!byApp.has(r.application_id)) byApp.set(r.application_id, []);
    byApp.get(r.application_id)!.push(r);
  }
  const out: Record<string, RunSummary> = {};
  for (const [appId, runs] of byApp) {
    const pick = pickHealthRun(runs);
    if (pick) out[appId] = pick;
  }
  return out;
}
