// Flow authoring for a Production Contract (S8A — the customer-facing Flow Designer foundation).
//   POST   /api/preflight/flows   { contract_id, name, goal?, role?, priority?, steps: [...] }   add
//   PATCH  /api/preflight/flows   { id, name?|goal?|role?|priority?|enabled?|steps? }             edit
//   DELETE /api/preflight/flows?id=...                                                            remove
// Session-authenticated + Preflight-flag gated; every mutation is owner-scoped in the data layer (eq
// user_id). The OWNER and the APP are derived server-side from the contract/flow row — a client-supplied
// owner_id or app_id is NEVER trusted. APPROVED contracts are IMMUTABLE: every mutating path loads the
// owning contract's status owner-scoped FIRST and returns 409 contract_approved when it is approved (flows
// freeze with the contract, exactly like requirements). Steps are validated by the PURE flow-steps model
// with the app's real test-account roles before anything is stored (no credential ever lands in a step).
// After a successful write the context changed, so snapshotIfChanged runs (best-effort, like requirements).
// Audit events carry the application id + contract id + flow NAME only — never a step value.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import {
  addFlow, updateFlow, deleteFlow, contractStatusForFlow,
  getContractById, type Severity,
} from "@/lib/v-applications";
import { validateSteps, flowRoles, type FlowStep } from "@/lib/preflight/flow-steps";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { logEvent } from "@/lib/v-events";
import { snapshotIfChanged } from "@/lib/preflight/context-snapshots";
import { applicationAccessForContract, applicationAccessForFlow } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";

export const runtime = "nodejs";

const SEVERITIES: Severity[] = ["critical", "important", "informational"];
const sev = (v: unknown): Severity | undefined => (typeof v === "string" && (SEVERITIES as string[]).includes(v) ? (v as Severity) : undefined);

const approvedImmutable = () => NextResponse.json(
  { error: "contract_approved", message: "Approved contracts are immutable. Create a new draft to change its flows." },
  { status: 409 },
);
const forbidden = () => NextResponse.json({ error: "forbidden", message: "You have view-only access to this application." }, { status: 403 });

// The test-account ROLE LABELS configured for an application, read owner + application scoped from the
// connection graph (meta.role, falling back to meta.label — the same resolution the launch auth-readiness
// gate uses). This is the ONLY set a sign_in_as / switch_role target may reference. Never selects the
// ciphertext. Empty when the app has no test accounts (an authenticated flow then fails validation with a
// specific reason, which is correct: you cannot author a sign-in for a role you have not connected).
async function rolesForApplication(owner: string, applicationId: string): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await getSupabaseAdminClient().from("v_app_connections")
    .select("meta").eq("user_id", owner.trim().toLowerCase()).eq("application_id", applicationId).eq("provider", "test_account");
  const out: string[] = [];
  for (const row of (data as { meta?: Record<string, unknown> }[] | null) ?? []) {
    const meta = row.meta ?? {};
    const label = typeof meta.label === "string" && meta.label.trim() ? meta.label.trim() : "Standard user";
    const role = typeof meta.role === "string" && meta.role.trim() ? meta.role.trim() : label;
    if (!out.includes(role)) out.push(role);
  }
  return out;
}

// Validate the authored steps against the app's real roles. Returns the normalized storage steps or a
// NextResponse carrying the specific reason (400). Shared by POST + PATCH.
async function validated(email: string, applicationId: string, rawSteps: unknown): Promise<{ steps: FlowStep[] } | { res: NextResponse }> {
  const roles = await rolesForApplication(email, applicationId);
  const v = validateSteps(rawSteps, { rolesAvailable: roles });
  if (!v.ok) return { res: NextResponse.json({ error: "invalid_steps", message: v.reason }, { status: 400 }) };
  return { steps: v.steps };
}

export async function POST(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const contractId = typeof body?.contract_id === "string" ? body.contract_id : "";
  if (!contractId) return NextResponse.json({ error: "missing_contract" }, { status: 400 });

  // TEAM ACCESS: contract -> app owner + role. Authoring flows is EDITOR+. owner = app owner (data-plane key).
  const access = await applicationAccessForContract(callerEmail, contractId);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;

  // Load the owning contract owner-scoped FIRST: it is the ownership gate, the source of the app id, and
  // the approval check. Null (not owned / not found) falls through to the normal failure path.
  const contract = await getContractById(email, contractId);
  if (!contract) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (contract.status === "approved") return approvedImmutable();

  const v = await validated(email, contract.application_id, body?.steps);
  if ("res" in v) return v.res;

  // The flow's role is DERIVED from its own sign-in steps (flowRoles), never trusted from the client body:
  // a stored role that named a nonexistent account would be a lie on the report's role chip. The steps'
  // sign_in_as/switch_role targets are already validated against the app's real roles, so the first one is
  // the authoritative role. An unauthenticated flow has no role.
  const derivedRoles = flowRoles(v.steps);
  const r = await addFlow(email, contractId, {
    name: typeof body?.name === "string" ? body.name : "",
    goal: typeof body?.goal === "string" ? body.goal : null,
    role: derivedRoles[0] ?? null,
    priority: sev(body?.priority),
    steps: v.steps,
  });
  if ("error" in r) {
    if (r.error === "contract_approved") return approvedImmutable();
    return NextResponse.json({ error: r.error === "invalid" ? "invalid_flow" : r.error }, { status: r.error === "not_found" ? 404 : 400 });
  }
  // Audit: application + contract id + flow name ONLY (never step values). Then re-snapshot the context.
  await logEvent({ userId: email, eventType: "preflight_flow_added", actorType: "owner", source: "app", metadata: { application_id: contract.application_id, contract_id: contractId, flow_name: r.name } });
  try { await snapshotIfChanged(email, contract.application_id, "owner"); } catch { /* context versioning never breaks the write */ }
  return NextResponse.json({ flow: r });
}

export async function PATCH(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  // Resolve the flow -> app owner + role. Editing a flow is EDITOR+.
  const access = await applicationAccessForFlow(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;

  // Approved-immutable guard BEFORE any mutation. contractStatusForFlow is owner-scoped: a cross-owner /
  // missing flow returns null (404), never mutating another tenant's row.
  const status = await contractStatusForFlow(email, id);
  if (status === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (status === "approved") return approvedImmutable();

  // Resolve the flow's contract + app owner-scoped (for step validation roles + the audit/snapshot ids).
  const meta = await flowContext(email, id);
  if (!meta) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let steps: FlowStep[] | undefined;
  // When steps are edited, the role is RE-DERIVED from them (never the client body): the stored role can
  // never contradict what the flow signs into. A steps-less patch (rename, toggle) leaves the role alone.
  let derivedRole: string | null | undefined;
  if (body?.steps !== undefined) {
    const v = await validated(email, meta.applicationId, body.steps);
    if ("res" in v) return v.res;
    steps = v.steps;
    derivedRole = flowRoles(v.steps)[0] ?? null;
  }

  const reviewState = body?.review === "approve" ? "approved" : body?.review === "reject" ? "rejected" : undefined;
  const r = await updateFlow(email, id, {
    name: typeof body?.name === "string" ? body.name : undefined,
    goal: body?.goal !== undefined ? (typeof body.goal === "string" ? body.goal : null) : undefined,
    role: derivedRole,
    priority: sev(body?.priority),
    enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
    steps,
    reviewState,
  });
  if ("error" in r) {
    if (r.error === "contract_approved") return approvedImmutable();
    return NextResponse.json({ error: r.error === "invalid" ? "invalid_flow" : r.error }, { status: r.error === "not_found" ? 404 : 400 });
  }
  await logEvent({ userId: email, eventType: "preflight_flow_updated", actorType: "owner", source: "app", metadata: { application_id: meta.applicationId, contract_id: meta.contractId, flow_name: typeof body?.name === "string" ? body.name.slice(0, 140) : meta.name } });
  try { await snapshotIfChanged(email, meta.applicationId, "owner"); } catch { /* never breaks the write */ }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const callerEmail = (await auth())?.user?.email;
  if (!callerEmail) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const access = await applicationAccessForFlow(callerEmail, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return forbidden();
  const email = access.owner;

  const status = await contractStatusForFlow(email, id);
  if (status === null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (status === "approved") return approvedImmutable();
  const meta = await flowContext(email, id);

  const r = await deleteFlow(email, id);
  if ("error" in r) {
    if (r.error === "contract_approved") return approvedImmutable();
    return NextResponse.json({ error: r.error }, { status: r.error === "not_found" ? 404 : 400 });
  }
  if (meta) {
    await logEvent({ userId: email, eventType: "preflight_flow_removed", actorType: "owner", source: "app", metadata: { application_id: meta.applicationId, contract_id: meta.contractId, flow_name: meta.name } });
    try { await snapshotIfChanged(email, meta.applicationId, "owner"); } catch { /* never breaks the write */ }
  }
  return NextResponse.json({ ok: true });
}

// The owning contract id + application id + current name for a flow, owner-scoped. Used to derive the app
// (for role validation) and the audit/snapshot ids — all resolved server-side, never trusted from a client.
async function flowContext(email: string, flowId: string): Promise<{ contractId: string; applicationId: string; name: string } | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = email.trim().toLowerCase();
  const { data: flow } = await getSupabaseAdminClient().from("v_test_flows")
    .select("contract_id, name").eq("user_id", uid).eq("id", flowId).maybeSingle();
  const f = flow as { contract_id?: string; name?: string } | null;
  if (!f?.contract_id) return null;
  const contract = await getContractById(email, f.contract_id);
  if (!contract) return null;
  return { contractId: f.contract_id, applicationId: contract.application_id, name: String(f.name ?? "") };
}
