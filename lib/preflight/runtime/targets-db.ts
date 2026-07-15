// Owner-scoped data layer for API runtime targets + builds (API beta). Server-only, service-role, scoped by
// user_id = lowercased email — same ownership model as v-applications.ts. Reads/writes only the migration-12
// tables (v_runtime_targets, v_builds); never touches web rows. Degrades to null/empty if the tables aren't
// migrated yet. No canary import: this is the customer path.

import { getSupabaseAdminClient } from "../../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

export type ApiRuntimeTarget = {
  id: string; application_id: string; user_id: string; kind: string; label: string; environment: string | null;
};
export type ApiBuild = { id: string; runtime_target_id: string; base_url: string | null; version: string | null; environment?: string | null };

const CUSTOMER_API_ENVIRONMENTS = new Set(["production", "staging", "preview"]);

// The app's API runtime target (at most one per app for the beta). Owner-scoped.
export async function getApiTarget(owner: string, appId: string): Promise<ApiRuntimeTarget | null> {
  const { data } = await db().from("v_runtime_targets").select("id,application_id,user_id,kind,label,environment")
    .eq("user_id", norm(owner)).eq("application_id", appId).eq("kind", "api").limit(1);
  const row = (data as ApiRuntimeTarget[] | null)?.[0];
  return row ?? null;
}

// Create the app's API runtime target. Idempotent (returns the existing one). `environment` is validated to a
// small safe set. Ownership is enforced by the caller (the route checks getApplication first).
export async function createApiTarget(owner: string, appId: string, input: { environment: string; label?: string }): Promise<{ ok: true; target: ApiRuntimeTarget } | { ok: false; reason: string }> {
  const uid = norm(owner);
  const environment = input.environment.trim().toLowerCase();
  if (!CUSTOMER_API_ENVIRONMENTS.has(environment)) return { ok: false, reason: "Choose a production, staging, or preview environment." };
  const existing = await getApiTarget(uid, appId);
  if (existing) return { ok: true, target: existing };
  const { data, error } = await db().from("v_runtime_targets")
    .insert({ user_id: uid, application_id: appId, kind: "api", label: input.label?.slice(0, 60) || "API", environment } as never)
    .select("id,application_id,user_id,kind,label,environment").single();
  if (error || !data) return { ok: false, reason: "Could not create the API target." };
  return { ok: true, target: data as ApiRuntimeTarget };
}

// Double-launch guard: an existing terminal run for this (owner, submission_id) means a concurrent/replayed
// launch already ran. Returns that run's id so the route can return it instead of executing (and billing)
// again. Reuses the existing unique (user_id, submission_id) constraint on v_preflight_runs.
export async function findRunBySubmission(owner: string, submissionId: string): Promise<string | null> {
  const { data } = await db().from("v_preflight_runs").select("id").eq("user_id", norm(owner)).eq("submission_id", submissionId).limit(1);
  return (data as { id: string }[] | null)?.[0]?.id ?? null;
}

// The latest build (base URL + identity) for a target.
export async function getLatestApiBuild(owner: string, targetId: string): Promise<ApiBuild | null> {
  const { data } = await db().from("v_builds").select("id,runtime_target_id,base_url,version")
    .eq("user_id", norm(owner)).eq("runtime_target_id", targetId).order("created_at", { ascending: false }).limit(1);
  const row = (data as ApiBuild[] | null)?.[0];
  return row ?? null;
}

// Set/replace the target's build identity: the API base URL + an optional version tag. A new v_builds row per
// change (append-only history). The base URL is validated with the SAME safe-URL string guard as web app URLs
// (https + not a private-host literal); the real SSRF defense runs at execution via safeFetch.
export async function setApiBuild(owner: string, targetId: string, input: { baseUrl: string; version?: string }): Promise<{ ok: true; build: ApiBuild } | { ok: false; reason: string }> {
  const reason = unsafeBaseUrlReason(input.baseUrl);
  if (reason) return { ok: false, reason };
  const { data, error } = await db().from("v_builds")
    .insert({ user_id: norm(owner), runtime_target_id: targetId, kind: "api", base_url: input.baseUrl.trim(), version: input.version?.slice(0, 80) || null, detail: {} } as never)
    .select("id,runtime_target_id,base_url,version").single();
  if (error || !data) return { ok: false, reason: "Could not save the API base URL." };
  return { ok: true, build: data as ApiBuild };
}

// ── API flow storage (v_test_flows scoped by runtime_target_id; migration 13) ─────────────────────────
// API flows live in v_test_flows like web flows, but carry runtime_target_id = the API target, so they never
// mix with web flows and the overview blocker filter can scope by target. `steps` holds the CUSTOMER
// vocabulary (ApiFlowStep[]); translation to ApiStep happens in the executor at launch, never in the DB.
export type ApiFlowRow = {
  id: string; name: string; goal: string | null; priority: "critical" | "important" | "informational";
  steps: unknown[]; enabled: boolean; review_state: string | null;
};

export async function listApiFlows(owner: string, appId: string, targetId: string): Promise<ApiFlowRow[]> {
  const { data } = await db().from("v_test_flows").select("id,name,goal,priority,steps,enabled,review_state")
    .eq("user_id", norm(owner)).eq("application_id", appId).eq("runtime_target_id", targetId).order("order_index", { ascending: true });
  return ((data as ApiFlowRow[] | null) ?? []).map((f) => ({ ...f, steps: Array.isArray(f.steps) ? f.steps : [] }));
}

export async function createApiFlow(owner: string, appId: string, targetId: string, contractId: string | null, input: { name: string; goal?: string; priority?: "critical" | "important" | "informational"; steps: unknown[] }): Promise<{ ok: true; id: string } | { ok: false; reason: string }> {
  const { data, error } = await db().from("v_test_flows").insert({
    user_id: norm(owner), application_id: appId, runtime_target_id: targetId, contract_id: contractId,
    name: input.name.slice(0, 140), goal: (input.goal || "").slice(0, 400) || null, priority: input.priority || "critical",
    steps: input.steps, enabled: true, review_state: "approved", order_index: Date.now() % 1_000_000,
  } as never).select("id").single();
  if (error || !data) return { ok: false, reason: "Could not save the flow." };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updateApiFlow(owner: string, appId: string, targetId: string, flowId: string, patch: { name?: string; goal?: string; priority?: "critical" | "important" | "informational"; steps?: unknown[]; enabled?: boolean }): Promise<boolean> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = patch.name.slice(0, 140);
  if (patch.goal !== undefined) set.goal = (patch.goal || "").slice(0, 400) || null;
  if (patch.priority !== undefined) set.priority = patch.priority;
  if (patch.steps !== undefined) set.steps = patch.steps;
  if (patch.enabled !== undefined) set.enabled = patch.enabled;
  if (Object.keys(set).length === 0) return true;
  const { data } = await db().from("v_test_flows").update(set as never)
    .eq("user_id", norm(owner)).eq("application_id", appId).eq("runtime_target_id", targetId).eq("id", flowId).select("id");
  return Array.isArray(data) && data.length > 0;
}

export async function deleteApiFlow(owner: string, appId: string, targetId: string, flowId: string): Promise<boolean> {
  const { data } = await db().from("v_test_flows").delete()
    .eq("user_id", norm(owner)).eq("application_id", appId).eq("runtime_target_id", targetId).eq("id", flowId).select("id");
  return Array.isArray(data) && data.length > 0;
}

// Cheap create-time string guard for the API base URL (https + host must not be an obvious private literal).
// safeFetch is the real defense at run time; this just rejects an obviously-wrong URL at author time with a
// clear message. Reuses the same rules as lib/safe-fetch.ts unsafeHttpsUrlReason without importing DNS.
export function unsafeBaseUrlReason(url: string): string | null {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return "Enter a valid URL (starting with https://)."; }
  if (u.protocol !== "https:") return "The API base URL must use https.";
  if (u.port && u.port !== "443") return "The API base URL must use the default https port (443).";
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) return "That looks like an internal address. Enter your API's public https URL.";
  // reject bare IPv4 private literals (the run-time guard covers the rest, incl. DNS-resolved private IPs)
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return "That is a private address. Enter your API's public https URL.";
    }
  }
  return null;
}
