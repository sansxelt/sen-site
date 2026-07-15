// Preflight team/workspace access — the ONE resolver every Preflight route/page uses to answer "may this
// caller touch this application, and as what role?" without changing the owner-scoped data plane underneath.
//
// ARCHITECTURE (owner-anchored, shared applications):
//   - Every Preflight table is scoped by user_id = the app OWNER's lowercased email. That never changes.
//   - A workspace SHARES an application (and everything hanging off it — contract, flows, runs, issues,
//     deployments) with its members. Access resolves: appId -> v_applications.{user_id, workspace_id} ->
//     v_workspace_members role. The app OWNER is always the data-plane key (`owner`); a member simply gets
//     to act inside the owner's data plane, gated by their role.
//   - Billing/credits/plan/free-pass stay anchored to the app owner: because the launch/spend paths all take
//     `owner` (the app owner) as their key, an editor launching a run charges the OWNER, never the editor.
//
// DEGRADATION: when the workspace tables/columns are absent (pre-migration 14) or an app has a NULL
// workspace_id, this resolves EXACTLY to today's single-user behavior — only the app owner has access, every
// non-owner gets `null` (a 404, indistinguishable from "does not exist"). So the whole feature is a no-op
// until migration 14 backfills workspace_id and teammates are invited.

import { NextResponse } from "next/server";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { auth } from "../../auth";
import { preflightEnabled, apiRuntimeEnabled } from "../v-preflight-flags";
import { apiRuntimeBetaAllowed } from "../v-entitlements";
import { preflightDbReady } from "./db-ready";
import { hasAtLeastRole, membershipFor, type Role } from "../v-workspace";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// The result of resolving a caller's access to an application. `owner` is the app owner's user_id — the key
// the entire Preflight data plane is scoped by; callers pass THIS to getApplication/createRun/hold/etc., not
// their own email. `role` is the caller's role in the app's workspace ("owner" when they ARE the owner).
// `level` distinguishes a direct owner from a workspace member (for logging/telemetry; access is identical).
export type AppAccess = { owner: string; role: Role; level: "owner" | "workspace" };

// Look up an application by id ALONE (no owner filter) to learn its owner + workspace. This is the only place
// a Preflight app row is read without an owner scope; it is safe because this function itself is the tenancy
// gate — it never returns the row, only resolves whether the caller may act and as what role. Returns null
// when the app doesn't exist or the tables aren't migrated.
async function appOwnerAndWorkspace(appId: string): Promise<{ owner: string; workspaceId: string | null } | null> {
  if (!appId || !isDatabaseConfigured()) return null;
  try {
    const { data } = await db().from("v_applications").select("user_id,workspace_id").eq("id", appId).maybeSingle();
    const row = data as unknown as { user_id: string; workspace_id: string | null } | null;
    return row ? { owner: norm(row.user_id), workspaceId: row.workspace_id ?? null } : null;
  } catch {
    return null; // table not migrated / transient — degrade to no-access (owner-only paths still work directly)
  }
}

// PURE access-decision core (no I/O) — the exact tenancy logic, extracted so it can be unit-tested
// deterministically. Given the caller, the app's owner + workspace, and a resolved membership role (null =
// not an active member), decide the access. Owner match is the fast path and the no-workspace / pre-migration
// path (a solo user always hits it). A non-owner only gets access through an active workspace membership.
export function resolveAccessDecision(
  callerUid: string,
  appOwner: string,
  workspaceId: string | null,
  memberRole: Role | null,
): AppAccess | null {
  const uid = norm(callerUid);
  const owner = norm(appOwner);
  if (owner === uid) return { owner, role: "owner", level: "owner" };
  if (!workspaceId) return null;      // non-owner + no shared workspace -> no access (single-user behavior)
  if (!memberRole) return null;       // not an active member (never invited, or revoked) -> no access
  return { owner, role: memberRole, level: "workspace" };
}

// THE resolver. Returns the app OWNER's user_id + the caller's role when the caller is either the owner or an
// active member of the app's workspace; null otherwise (caller must render a 404, exactly like a non-owner
// today). Pass `owner` to every owner-scoped read/write; gate mutations on `role`.
export async function applicationAccess(callerEmail: string | null | undefined, appId: string): Promise<AppAccess | null> {
  if (!callerEmail || !appId) return null;
  const uid = norm(callerEmail);
  const meta = await appOwnerAndWorkspace(appId);
  if (!meta) return null;
  if (meta.owner === uid) return { owner: meta.owner, role: "owner", level: "owner" }; // fast path, no membership read
  if (!meta.workspaceId) return null;
  const m = await membershipFor(uid, meta.workspaceId);
  return resolveAccessDecision(uid, meta.owner, meta.workspaceId, m?.role ?? null);
}

// Convenience: the app owner's user_id if the caller has ANY access, else null. For read-only routes/pages
// that don't need the role (they already render owner-scoped data the caller may see).
export async function accessibleAppOwner(callerEmail: string | null | undefined, appId: string): Promise<string | null> {
  const a = await applicationAccess(callerEmail, appId);
  return a ? a.owner : null;
}

// ── Shared route gate ────────────────────────────────────────────────────────────────────────────────────
// The full Preflight app-route gate in ONE call: flag -> auth -> DB-ready -> access -> role. Returns the
// resolved app OWNER (data-plane key) + the caller's role, or a typed reason each route maps to its own
// response (json 404/401/403/503 or notFound()). `minRole` is the least-privileged role allowed; a read
// route passes "viewer", a mutation passes "editor", member management passes "admin". A view-only member on
// a mutation gets `forbidden` (403 — they already know the app exists); a non-member gets `not_found` (404,
// indistinguishable from "does not exist"). Degrades to owner-only when the app has no workspace.
export type GateReason = "disabled" | "signin" | "setup" | "not_found" | "forbidden";
export type GateResult = { ok: true; owner: string; role: Role; level: "owner" | "workspace"; actor: string } | { ok: false; reason: GateReason };

export async function gatePreflightApp(appId: string, minRole: Exclude<Role, "client_viewer"> = "viewer"): Promise<GateResult> {
  if (!preflightEnabled()) return { ok: false, reason: "disabled" };
  const email = (await auth())?.user?.email;
  if (!email) return { ok: false, reason: "signin" };
  if (!(await preflightDbReady())) return { ok: false, reason: "setup" };
  const access = await applicationAccess(email, appId);
  if (!access) return { ok: false, reason: "not_found" };
  if (!hasAtLeastRole(access.role, minRole)) return { ok: false, reason: "forbidden" };
  return { ok: true, owner: access.owner, role: access.role, level: access.level, actor: norm(email) };
}

// The API-runtime app gate: same as gatePreflightApp but ALSO requires the API surface to be enabled and both
// the CALLER and the app OWNER to have API-runtime access. A denial is a uniform 404 (never reveals the API
// surface or the app). Returns the app OWNER (billing/data key) + the caller's role. Used by every api-*
// route so an owner OR a workspace member (at the given min role) of an API-enabled owner can act, with
// billing anchored to the owner. When any condition fails, returns { ok:false, reason } that maps to a 404
// (disabled/not_found) or 403 (forbidden) exactly like the web gate.
export async function gateApiRuntimeApp(appId: string, minRole: Exclude<Role, "client_viewer"> = "viewer"): Promise<GateResult> {
  // Surface must be on and the CALLER must have API access (mirrors apiBetaOwner). Both fail as "disabled"
  // (uniform 404) so a caller without API access never learns the surface exists.
  if (!preflightEnabled() || !apiRuntimeEnabled()) return { ok: false, reason: "disabled" };
  const email = (await auth())?.user?.email;
  if (!email) return { ok: false, reason: "signin" };
  if (!apiRuntimeBetaAllowed(email)) return { ok: false, reason: "disabled" };
  const access = await applicationAccess(email, appId);
  if (!access) return { ok: false, reason: "not_found" };
  // The app OWNER must also have API access (an editor's API access does not extend the API surface onto an
  // owner who lacks it). Owner without API access -> the app is not an API-runtime app for anyone -> 404.
  if (!apiRuntimeBetaAllowed(access.owner)) return { ok: false, reason: "not_found" };
  if (!hasAtLeastRole(access.role, minRole)) return { ok: false, reason: "forbidden" };
  return { ok: true, owner: access.owner, role: access.role, level: access.level, actor: norm(email) };
}

// Map a gate reason to the canonical route response. `disabled`/`not_found` are BOTH a bare 404 (a disabled
// surface and a non-existent/inaccessible app are indistinguishable — no hint the feature or app exists).
// `forbidden` is a 403 (the caller is a real view-only member who already knows the app exists). Imported by
// every app-scoped Preflight route so the posture is identical everywhere. Uses NextResponse-shaped JSON.
export function gateReasonResponse(reason: GateReason): NextResponse {
  switch (reason) {
    case "signin": return NextResponse.json({ error: "signin_required" }, { status: 401 });
    case "setup": return NextResponse.json({ error: "setup_required" }, { status: 503 });
    case "forbidden": return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application." }, { status: 403 });
    case "disabled":
    case "not_found":
    default: return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

// Resolve access via a CONTRACT id (the requirements/flows routes are contract-scoped, not app-scoped). Reads
// the contract's application_id unscoped, then defers to applicationAccess. Returns the access + the resolved
// applicationId (callers need it for owner-scoped contract/requirement/flow reads).
export async function applicationAccessForContract(callerEmail: string | null | undefined, contractId: string): Promise<(AppAccess & { applicationId: string }) | null> {
  if (!callerEmail || !contractId || !isDatabaseConfigured()) return null;
  try {
    const { data } = await db().from("v_production_contracts").select("application_id").eq("id", contractId).maybeSingle();
    const appId = (data as unknown as { application_id: string } | null)?.application_id;
    if (!appId) return null;
    const access = await applicationAccess(callerEmail, appId);
    return access ? { ...access, applicationId: appId } : null;
  } catch {
    return null;
  }
}

// Resolve access via a RUN id (the run report/cancel/artifacts/rerun routes are run-scoped). Reads the run's
// application_id unscoped, then defers to applicationAccess. Returns the access + the resolved applicationId.
export async function applicationAccessForRun(callerEmail: string | null | undefined, runId: string): Promise<(AppAccess & { applicationId: string }) | null> {
  if (!callerEmail || !runId || !isDatabaseConfigured()) return null;
  try {
    const { data } = await db().from("v_preflight_runs").select("application_id").eq("id", runId).maybeSingle();
    const appId = (data as unknown as { application_id: string } | null)?.application_id;
    if (!appId) return null;
    const access = await applicationAccess(callerEmail, appId);
    return access ? { ...access, applicationId: appId } : null;
  } catch {
    return null;
  }
}

// Resolve access via a REQUIREMENT id: requirement -> contract -> application -> access. Two unscoped hops,
// both gated by the final membership check. Used by the requirements PATCH/DELETE routes (which key off a
// requirement id, not a contract id).
export async function applicationAccessForRequirement(callerEmail: string | null | undefined, requirementId: string): Promise<AppAccess | null> {
  if (!callerEmail || !requirementId || !isDatabaseConfigured()) return null;
  try {
    const { data: r } = await db().from("v_contract_requirements").select("contract_id").eq("id", requirementId).maybeSingle();
    const contractId = (r as unknown as { contract_id: string } | null)?.contract_id;
    if (!contractId) return null;
    const c = await applicationAccessForContract(callerEmail, contractId);
    return c ? { owner: c.owner, role: c.role, level: c.level } : null;
  } catch {
    return null;
  }
}

// Resolve access via a FLOW id: flow -> contract -> application -> access. Used by the flows PATCH/DELETE
// routes (which key off a flow id).
export async function applicationAccessForFlow(callerEmail: string | null | undefined, flowId: string): Promise<AppAccess | null> {
  if (!callerEmail || !flowId || !isDatabaseConfigured()) return null;
  try {
    const { data: f } = await db().from("v_test_flows").select("contract_id").eq("id", flowId).maybeSingle();
    const contractId = (f as unknown as { contract_id: string } | null)?.contract_id;
    if (!contractId) return null;
    const c = await applicationAccessForContract(callerEmail, contractId);
    return c ? { owner: c.owner, role: c.role, level: c.level } : null;
  } catch {
    return null;
  }
}

// ── Dashboard / overview: cross-workspace shared apps ────────────────────────────────────────────────────
// The dashboard reads span ALL of an owner's data (listApplications / listAllRuns / overviewCounts), scoped
// by user_id = owner. Under teams, a member must also see the apps SHARED into workspaces they belong to.
// This resolves, for a caller, the FULL set of owner user_ids whose data plane the caller may read — their
// own, plus the owner of every workspace in which the caller is an active member. The dashboard then reads
// each owner's apps and unions them (and, critically, computes the api-target exclusion across this SAME set
// so a member's API runs never leak into another member's web metering — see webRuntimeFilter).
//
// Returns [caller] alone when the workspace tables are absent or the caller has no shared memberships — so a
// solo user's dashboard is byte-for-byte unchanged.
export async function accessibleOwners(callerEmail: string | null | undefined): Promise<string[]> {
  if (!callerEmail) return [];
  const uid = norm(callerEmail);
  const owners = new Set<string>([uid]);
  if (!isDatabaseConfigured()) return [uid];
  try {
    const s = db();
    // Every workspace the caller is an active member of...
    const { data: mem, error } = await s.from("v_workspace_members" as never)
      .select("workspace_id").eq("email", uid).eq("status", "active");
    if (error) return [uid]; // pre-migration -> just the caller
    const wsIds = ((mem as unknown as { workspace_id: string }[]) ?? []).map((r) => r.workspace_id);
    if (!wsIds.length) return [uid];
    // ...resolved to each workspace's OWNER user_id (the data-plane key for that workspace's shared apps).
    const { data: wss } = await s.from("v_workspaces" as never).select("owner_user_id").in("id", wsIds);
    for (const w of (wss as unknown as { owner_user_id: string }[]) ?? []) owners.add(norm(w.owner_user_id));
    return [...owners];
  } catch {
    return [uid];
  }
}

// The application ids VISIBLE to the caller inside a specific workspace they belong to (for a workspace-scoped
// dashboard view). Returns [] when not a member or pre-migration. Read-only; ownership of each app is still
// its own user_id. Not used by the default personal dashboard (that uses accessibleOwners) — this is for an
// explicit workspace selection.
export async function workspaceAppIds(callerEmail: string | null | undefined, workspaceId: string): Promise<string[]> {
  if (!callerEmail || !workspaceId || !isDatabaseConfigured()) return [];
  const uid = norm(callerEmail);
  const m = await membershipFor(uid, workspaceId);
  if (!m) return [];
  try {
    const { data } = await db().from("v_applications").select("id").eq("workspace_id", workspaceId);
    return ((data as unknown as { id: string }[] | null) ?? []).map((r) => r.id);
  } catch {
    return [];
  }
}
