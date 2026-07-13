// Data layer for Vraelis Preflight — connected applications, their Production Contract, requirements, and
// test flows. Server-only: service-role client scoped by user_id = lowercased email (the same ownership
// model as the rest of the app; RLS is only a deny-anon backstop). Every read degrades to empty/null if
// the tables aren't migrated yet, so the Product Shell renders cleanly before sql/vraelis-preflight.sql
// is applied. No browser execution, discovery, or billing lives here — this is the shell's data plane.

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { pickHealthRun } from "./preflight/target-url";
import { logEvent } from "./v-events";
import { unsafeHttpsUrlReason } from "./safe-fetch";
import { canonicalDeploymentUrl } from "./preflight/deployments-db";
import type { FlowStep } from "./preflight/flow-steps";

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

// The safe, owner-editable fields of an application. Everything else (builder, framework, ownership,
// the connection graph) is set at connect time or on its own tab and is intentionally not patchable here.
export type ApplicationPatch = {
  name?: string;
  app_url?: string;
  environment?: string | null;
  description?: string;                          // maps to the "summary" context source (merged, not clobbered)
};

// Result of updateApplication. `updated` is false for a no-op / zero-row (not owned, or nothing valid to
// change), which callers must render honestly rather than as success. When the deployment target moved to
// a genuinely different URL (canonical compare), `targetChanged` is true and oldUrl/newUrl carry the pair
// so the route can record a NEW deployment identity and log the change; historical runs are untouched.
export type UpdateApplicationResult =
  | { ok: false; error: string }
  | { ok: true; updated: boolean; application: Application; targetChanged: boolean; oldUrl: string; newUrl: string };

// Owner-scoped patch of an application's editable fields. Tenancy is enforced by the query itself (eq
// user_id + id); a client-supplied owner or app id is never trusted. app_url is validated with the same
// SSRF string guard the connect route uses (https only; no private/loopback/malformed host), so an
// unsafe target can never be stored. The description is merged into the context array as a single
// "summary" source, PRESERVING every other product-definition source. Returns updated:false honestly on
// a zero-row write (not owned / nothing to change). Never rewrites any historical run's deployment_url.
export async function updateApplication(userId: string, id: string, patch: ApplicationPatch): Promise<UpdateApplicationResult> {
  if (!isDatabaseConfigured()) return { ok: false, error: "unavailable" };
  const uid = norm(userId);

  // Load the current row FIRST, owner-scoped: it is the ownership gate, the source of the old URL for the
  // target-change compare, and the current context array we must merge (not clobber) the description into.
  const current = await getApplication(uid, id);
  if (!current) return { ok: false, error: "not_found" };

  const fields: Record<string, unknown> = {};

  if (typeof patch.name === "string") {
    const name = patch.name.trim().slice(0, 140);
    if (!name) return { ok: false, error: "name_required" };
    fields.name = name;
  }

  let newUrl = current.app_url;
  if (typeof patch.app_url === "string") {
    const url = patch.app_url.trim().slice(0, 2000);
    if (!url) return { ok: false, error: "url_required" };
    const reason = unsafeHttpsUrlReason(url);
    if (reason) return { ok: false, error: "invalid_url" };
    fields.app_url = url;
    newUrl = url;
  }

  if (patch.environment !== undefined) {
    const env = (patch.environment || "").trim().toLowerCase();
    if (env === "") fields.environment = null;                       // explicit clear
    else if (env === "preview" || env === "staging" || env === "production") fields.environment = env;
    else return { ok: false, error: "invalid_environment" };
  }

  if (typeof patch.description === "string") {
    // Merge a single "summary" context source; keep every other source exactly as it was. An empty
    // description removes the summary source rather than storing a blank one.
    const desc = patch.description.trim().slice(0, 60_000);
    const raw = Array.isArray((current as unknown as { context?: unknown }).context)
      ? ((current as unknown as { context: unknown[] }).context)
      : [];
    const others = raw.filter((e) => !(e && typeof e === "object" && (e as Record<string, unknown>).kind === "summary"));
    const next = desc
      ? [...others, { kind: "summary", name: "Summary", chars: desc.length, added_at: new Date().toISOString(), content: desc }]
      : others;
    fields.context = next;
  }

  if (!Object.keys(fields).length) {
    return { ok: true, updated: false, application: current, targetChanged: false, oldUrl: current.app_url, newUrl: current.app_url };
  }

  fields.updated_at = new Date().toISOString();
  // The update is itself owner-scoped: a cross-owner id matches zero rows and returns updated:false, never
  // touching another tenant's application. select() confirms the row actually changed (honest zero-row).
  const { data, error } = await db().from("v_applications").update(fields as never)
    .eq("user_id", uid).eq("id", id).select("*");
  if (error) return { ok: false, error: "update_failed" };
  const rows = (data as Application[] | null) ?? [];
  if (!rows.length) return { ok: true, updated: false, application: current, targetChanged: false, oldUrl: current.app_url, newUrl: current.app_url };

  const targetChanged = canonicalDeploymentUrl(current.app_url) !== canonicalDeploymentUrl(newUrl);
  return { ok: true, updated: true, application: rows[0], targetChanged, oldUrl: current.app_url, newUrl };
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

// ── Flow authoring (S8A) — owner-scoped, contract-draft-only, mirror of the requirement funcs ──
// A flow belongs to a contract; it is editable only while that contract is a DRAFT and frozen once the
// contract is approved (same immutability rule as requirements). The step list is validated by the PURE
// flow-steps model in the route BEFORE it reaches here — this layer stores already-validated steps and
// never trusts a client-supplied owner, contract, or flow id (tenancy is the query's eq user_id filter).
export type FlowInput = {
  name: string;
  goal?: string | null;
  role?: string | null;               // set for authenticated flows; the launch auth-readiness gate reads this
  steps: FlowStep[];                  // pre-validated by validateSteps
  priority?: Severity;
  requirementIds?: string[];
};
export type FlowPatch = {
  name?: string;
  goal?: string | null;
  role?: string | null;
  steps?: FlowStep[];                 // pre-validated when present
  priority?: Severity;
  enabled?: boolean;
  requirementIds?: string[];
};
export type FlowMutationError = { error: "contract_approved" | "not_found" | "invalid" | "unavailable" };

// The status of the contract that owns a flow, both lookups owner-scoped (mirror of
// contractStatusForRequirement). Null when the flow (or its contract) does not exist for this owner.
export async function contractStatusForFlow(userId: string, flowId: string): Promise<"draft" | "approved" | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(userId);
  const { data } = await db().from("v_test_flows").select("contract_id").eq("user_id", uid).eq("id", flowId).maybeSingle();
  const contractId = (data as { contract_id?: string } | null)?.contract_id;
  if (!contractId) return null;
  const contract = await getContractById(uid, contractId);
  return contract?.status ?? null;
}

// Insert a flow onto a DRAFT contract. Owner-scoped: the contract must belong to this owner (ownsContract)
// and be a draft (refused with contract_approved when approved — flows freeze with the contract). order_index
// is max+1 within the contract so a new flow sorts last; enabled defaults true. Steps arrive already
// validated. Returns the row, or a specific error.
export async function addFlow(userId: string, contractId: string, input: FlowInput): Promise<TestFlow | FlowMutationError> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  const uid = norm(userId);
  const contract = await getContractById(uid, contractId);
  if (!contract) return { error: "not_found" };
  if (contract.status === "approved") return { error: "contract_approved" };
  const name = (input.name || "").trim().slice(0, 140);
  if (!name) return { error: "invalid" };

  // order_index = max+1 among this owner's flows for the contract (a zero-row max yields 0, so first is 1).
  const existing = await listFlows(uid, contractId);
  const maxIdx = existing.reduce((m, f) => Math.max(m, typeof f.order_index === "number" ? f.order_index : 0), 0);

  const { data, error } = await db().from("v_test_flows").insert({
    contract_id: contractId, user_id: uid, name,
    goal: (input.goal || "").trim().slice(0, 400) || null,
    role: (input.role || "").trim().slice(0, 60) || null,
    steps: input.steps,
    priority: input.priority ?? "important",
    enabled: true,
    order_index: maxIdx + 1,
    requirement_ids: Array.isArray(input.requirementIds) ? input.requirementIds.slice(0, 200) : [],
  } as never).select("*").single();
  if (error || !data) return { error: "unavailable" };
  return data as unknown as TestFlow;
}

// Owner-scoped patch of a flow. Refused when the owning contract is approved. Only the provided fields
// change; steps (when present) are already validated. A cross-owner flow id resolves to not_found via the
// owner-scoped status lookup, never touching another tenant's row.
export async function updateFlow(userId: string, flowId: string, patch: FlowPatch): Promise<{ ok: true } | FlowMutationError> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  const uid = norm(userId);
  const status = await contractStatusForFlow(uid, flowId);
  if (status === null) return { error: "not_found" };
  if (status === "approved") return { error: "contract_approved" };

  const fields: Record<string, unknown> = {};
  if (typeof patch.name === "string") {
    const name = patch.name.trim().slice(0, 140);
    if (!name) return { error: "invalid" };
    fields.name = name;
  }
  if (patch.goal !== undefined) fields.goal = (patch.goal || "").trim().slice(0, 400) || null;
  if (patch.role !== undefined) fields.role = (patch.role || "").trim().slice(0, 60) || null;
  if (patch.steps !== undefined) fields.steps = patch.steps;
  if (patch.priority) fields.priority = patch.priority;
  if (typeof patch.enabled === "boolean") fields.enabled = patch.enabled;
  if (patch.requirementIds !== undefined) fields.requirement_ids = Array.isArray(patch.requirementIds) ? patch.requirementIds.slice(0, 200) : [];
  if (!Object.keys(fields).length) return { ok: true };

  const { error } = await db().from("v_test_flows").update(fields as never).eq("user_id", uid).eq("id", flowId);
  return error ? { error: "unavailable" } : { ok: true };
}

// Owner-scoped delete of a flow, refused on an approved contract. Honest zero-row: reports removed only
// when a row was actually deleted (a cross-owner / already-gone id removes nothing and is not "removed").
export async function deleteFlow(userId: string, flowId: string): Promise<{ ok: true } | FlowMutationError> {
  if (!isDatabaseConfigured()) return { error: "unavailable" };
  const uid = norm(userId);
  const status = await contractStatusForFlow(uid, flowId);
  if (status === null) return { error: "not_found" };
  if (status === "approved") return { error: "contract_approved" };
  const { data, error } = await db().from("v_test_flows").delete().eq("user_id", uid).eq("id", flowId).select("id");
  if (error) return { error: "unavailable" };
  if (!Array.isArray(data) || data.length === 0) return { error: "not_found" };
  return { ok: true };
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
