// Owner-scoped data layer for GUARANTEES (migration 19). Service-role client scoped by user_id = lowercased
// email, the same ownership model as the rest of the data plane (RLS is a deny-anon backstop only). A
// guarantee is a durable, named claim on a system; its live status is DERIVED from the runs tagged with its id
// (guarantee-status.ts), never stored here — the only durable state written is the approved plan content, the
// approval identity, and plan_state.
//
// MIGRATION RULE (migration 19 may not be applied yet): every touch of v_guarantees FAILS CLEARLY when the
// table is missing (console.warn naming the sql file, return null/[]), but NEVER breaks the parent operation.
// The runs read (latest tagged run) tolerates the guarantee_id column being absent the same way. Mirrors
// lib/preflight/deployments-db.ts.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import type { PlannedVerification } from "./verification-lane";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }
function newGuaranteeId(): string { return `grt_${crypto.randomUUID()}`; }

// ── Shapes ─────────────────────────────────────────────────────────────────────────────────────────────

export type GuaranteePlanState = "draft" | "ok" | "review_required";
export type GuaranteeCriticality = "critical";

export type Guarantee = {
  id: string; application_id: string; user_id: string;
  title: string; scope: string | null; criticality: string;
  approved_claim: string | null; approved_plan: PlannedVerification | null; approved_plan_hash: string | null;
  approved_role_refs: string[]; plan_version: number;
  plan_approved_by: string | null; plan_approved_at: string | null; plan_state: GuaranteePlanState;
  last_evaluated_at: string | null; status: "active" | "archived";
  created_at: string; updated_at: string;
};

// The owner-safe slice of a run needed to derive a guarantee's status and its last-proven deployment. Mirrors
// the ChildRun shape in runs-db.ts, with the deployment pin (migration 8) added.
export type GuaranteeRunRef = {
  id: string; state: string; decision: string | null;
  deployment_url: string | null; commit_sha: string | null; deployment_id: string | null;
  created_at: string; completed_at: string | null;
};

const GUARANTEE_COLUMNS =
  "id, application_id, user_id, title, scope, criticality, approved_claim, approved_plan, approved_plan_hash, approved_role_refs, plan_version, plan_approved_by, plan_approved_at, plan_state, last_evaluated_at, status, created_at, updated_at";

const RUN_REF_COLUMNS = "id, state, decision, deployment_url, commit_sha, deployment_id, created_at, completed_at";

function rowToGuarantee(r: Record<string, unknown>): Guarantee {
  const planState = r.plan_state as string;
  return {
    id: String(r.id), application_id: String(r.application_id), user_id: String(r.user_id ?? ""),
    title: String(r.title ?? ""), scope: (r.scope as string) ?? null, criticality: String(r.criticality ?? "critical"),
    approved_claim: (r.approved_claim as string) ?? null,
    approved_plan: (r.approved_plan as PlannedVerification) ?? null,
    approved_plan_hash: (r.approved_plan_hash as string) ?? null,
    approved_role_refs: Array.isArray(r.approved_role_refs) ? (r.approved_role_refs as unknown[]).map(String) : [],
    plan_version: Number(r.plan_version ?? 0),
    plan_approved_by: (r.plan_approved_by as string) ?? null, plan_approved_at: (r.plan_approved_at as string) ?? null,
    plan_state: (planState === "ok" || planState === "review_required" ? planState : "draft"),
    last_evaluated_at: (r.last_evaluated_at as string) ?? null,
    status: (r.status === "archived" ? "archived" : "active"),
    created_at: String(r.created_at ?? ""), updated_at: String(r.updated_at ?? ""),
  };
}

function rowToRunRef(r: Record<string, unknown>): GuaranteeRunRef {
  return {
    id: String(r.id), state: String(r.state ?? ""), decision: (r.decision as string) ?? null,
    deployment_url: (r.deployment_url as string) ?? null, commit_sha: (r.commit_sha as string) ?? null,
    deployment_id: (r.deployment_id as string) ?? null,
    created_at: String(r.created_at ?? ""), completed_at: (r.completed_at as string) ?? null,
  };
}

// ── Missing-migration detection (the migration rule made concrete) ─────────────────────────────────────

const MIGRATION_FILE = "sql/vraelis-preflight-19-guarantees.sql";

function missingGuaranteesTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return /v_guarantees/i.test(msg) && /(does not exist|schema cache|find the table)/i.test(msg);
}

function warnUnmigrated(where: string): void {
  console.warn(`${where}: v_guarantees is missing. Apply ${MIGRATION_FILE} (migration 19). The guarantee feature is inert; the parent operation is unaffected.`);
}

// True when v_guarantees exists (migration 19 applied). UI surfaces use this to render an honest one-line
// notice instead of pretending an empty list means "no guarantees defined".
export async function guaranteeStoreReady(owner: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error } = await db().from("v_guarantees").select("id").eq("user_id", norm(owner)).limit(1);
  return !missingGuaranteesTable(error);
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────────

export type CreateGuaranteeInput = { applicationId: string; title: string; scope?: string | null; criticality?: GuaranteeCriticality };

// Define a guarantee on an owned system. Ownership-gated on the application row before any write. The plan is
// NOT approved here (plan_state 'draft'); approval is a separate, human-only event (approveGuaranteePlan).
// Best-effort per the migration rule: null on a missing table (warned) or any failure, never throws.
export async function createGuarantee(owner: string, input: CreateGuaranteeInput): Promise<Guarantee | null> {
  try {
    if (!isDatabaseConfigured()) return null;
    const uid = norm(owner);
    const title = (input.title ?? "").trim().slice(0, 400);
    if (!title || !input.applicationId) return null;

    const { data: app } = await db().from("v_applications")
      .select("id").eq("user_id", uid).eq("id", input.applicationId).maybeSingle();
    if (!app) return null;                                      // not owned / not found

    const { data, error } = await db().from("v_guarantees").insert({
      id: newGuaranteeId(), user_id: uid, application_id: input.applicationId,
      title, scope: (input.scope ?? "").trim().slice(0, 2000) || null, criticality: input.criticality ?? "critical",
    } as never).select(GUARANTEE_COLUMNS).single();
    if (error || !data) { if (missingGuaranteesTable(error)) warnUnmigrated("createGuarantee"); return null; }
    return rowToGuarantee(data as Record<string, unknown>);
  } catch { return null; }
}

// Record a human's one-time approval of a guarantee's derived proof plan: copy the plan content off the
// reviewed plan onto the guarantee (durable, deployment-independent), stamp the approver, bump plan_version,
// and flip plan_state to 'ok'. This is the ONLY path that sets a guarantee approved; the caller must have
// authenticated a session principal (never an agent key) before calling. Returns the updated row or null.
export type ApproveGuaranteePlanInput = {
  claim: string; plan: PlannedVerification; planHash: string; roleRefs: string[]; approver: string;
  /** The immutable reviewed plan the approver actually read. Carried onto the guarantee so every run it
   *  later launches can point at the artifact a person accepted, rather than at a claim that it happened. */
  reviewedPlanId: string | null;
};

export async function approveGuaranteePlan(owner: string, id: string, input: ApproveGuaranteePlanInput): Promise<Guarantee | null> {
  try {
    if (!isDatabaseConfigured()) return null;
    const uid = norm(owner);
    // Read the current version (owner-scoped) so the bump is monotonic; a missing/foreign row aborts.
    const current = await getGuarantee(owner, id);
    if (!current) return null;
    const patch = {
      approved_claim: input.claim, approved_plan: input.plan, approved_plan_hash: input.planHash,
      approved_role_refs: input.roleRefs, plan_version: current.plan_version + 1,
      plan_approved_by: input.approver, plan_approved_at: new Date().toISOString(),
      plan_state: "ok", updated_at: new Date().toISOString(),
    };
    // approved_reviewed_plan_id is additive (migration 23). Written when the column exists, dropped when it
    // does not, so approval keeps working on an unmigrated database and simply records less provenance.
    const withProvenance = input.reviewedPlanId ? { ...patch, approved_reviewed_plan_id: input.reviewedPlanId } : patch;
    let { data, error } = await db().from("v_guarantees").update(withProvenance as never)
      .eq("user_id", uid).eq("id", id).select(GUARANTEE_COLUMNS).single();
    if (error && /approved_reviewed_plan_id/i.test((error as { message?: string }).message ?? "")) {
      console.warn("approveGuaranteePlan: v_guarantees.approved_reviewed_plan_id is missing. Apply sql/vraelis-preflight-23-guarantee-binding.sql (migration 23). Approved without approval provenance.");
      ({ data, error } = await db().from("v_guarantees").update(patch as never)
        .eq("user_id", uid).eq("id", id).select(GUARANTEE_COLUMNS).single());
    }
    if (error || !data) { if (missingGuaranteesTable(error)) warnUnmigrated("approveGuaranteePlan"); return null; }
    return rowToGuarantee(data as Record<string, unknown>);
  } catch { return null; }
}

// Flip a guarantee to 'review_required' (its definition drifted from what was approved: "workflow changed
// since approval"). App-written, never the worker. Also stamps last_evaluated_at.
export async function setGuaranteePlanReview(owner: string, id: string): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    const now = new Date().toISOString();
    await db().from("v_guarantees").update({ plan_state: "review_required", last_evaluated_at: now, updated_at: now } as never)
      .eq("user_id", norm(owner)).eq("id", id);
  } catch { /* best-effort */ }
}

// Stamp last_evaluated_at (a reverify was launched/decided). App-written, never the worker.
export async function markGuaranteeEvaluated(owner: string, id: string): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    const now = new Date().toISOString();
    await db().from("v_guarantees").update({ last_evaluated_at: now, updated_at: now } as never)
      .eq("user_id", norm(owner)).eq("id", id);
  } catch { /* best-effort */ }
}

export async function archiveGuarantee(owner: string, id: string): Promise<void> {
  try {
    if (!isDatabaseConfigured()) return;
    await db().from("v_guarantees").update({ status: "archived", updated_at: new Date().toISOString() } as never)
      .eq("user_id", norm(owner)).eq("id", id);
  } catch { /* best-effort */ }
}

// ── Reads (owner-scoped; null / empty and a clear warn when unmigrated) ────────────────────────────────

export async function getGuarantee(owner: string, id: string): Promise<Guarantee | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_guarantees")
    .select(GUARANTEE_COLUMNS).eq("user_id", norm(owner)).eq("id", id).maybeSingle();
  if (error) { if (missingGuaranteesTable(error)) warnUnmigrated("getGuarantee"); return null; }
  return data ? rowToGuarantee(data as Record<string, unknown>) : null;
}

// Every guarantee this tenant holds ACROSS the given systems, newest first.
//
// listGuarantees is per-application, which is right for a system page and wrong for the Guarantees map: the
// console had no way to answer "what has this company promised", only "what has this one system promised".
// One `in` query rather than a fan-out, so the cost does not grow with the number of systems.
//
// Owner-scoped like every read here. The caller passes the application ids the signed-in MEMBER can see
// (listApplicationsForMember), so a teammate's view is bounded by the systems shared with them and never by
// this function's own idea of tenancy.
export async function listGuaranteesForApps(owner: string, applicationIds: string[], includeArchived = false): Promise<Guarantee[]> {
  if (!isDatabaseConfigured() || applicationIds.length === 0) return [];
  let q = db().from("v_guarantees")
    .select(GUARANTEE_COLUMNS).eq("user_id", norm(owner)).in("application_id", applicationIds);
  if (!includeArchived) q = q.eq("status", "active");
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) { if (missingGuaranteesTable(error)) warnUnmigrated("listGuaranteesForApps"); return []; }
  return ((data as Record<string, unknown>[] | null) ?? []).map(rowToGuarantee);
}

// A system's active guarantees, newest first. Empty when unmigrated. Pass includeArchived to list archived too.
export async function listGuarantees(owner: string, applicationId: string, includeArchived = false): Promise<Guarantee[]> {
  if (!isDatabaseConfigured()) return [];
  let q = db().from("v_guarantees")
    .select(GUARANTEE_COLUMNS).eq("user_id", norm(owner)).eq("application_id", applicationId);
  if (!includeArchived) q = q.eq("status", "active");
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) { if (missingGuaranteesTable(error)) warnUnmigrated("listGuarantees"); return []; }
  return ((data as Record<string, unknown>[] | null) ?? []).map(rowToGuarantee);
}

// The newest run tagged with this guarantee's id (its current run, terminal or in-flight). Null when none, or
// when v_preflight_runs.guarantee_id is not present yet (migration 19 unapplied). Used to derive live status.
export async function latestGuaranteeRun(owner: string, guaranteeId: string): Promise<GuaranteeRunRef | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const { data, error } = await db().from("v_preflight_runs")
      .select(RUN_REF_COLUMNS).eq("user_id", norm(owner)).eq("guarantee_id", guaranteeId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) {
      if (/guarantee_id/i.test(error.message ?? "")) warnUnmigrated("latestGuaranteeRun");
      return null;
    }
    return data ? rowToRunRef(data as Record<string, unknown>) : null;
  } catch { return null; }
}

// The runs tagged with this guarantee, newest first (its verification history / lineage). Empty when none or
// unmigrated. Powers the guarantee detail page and the last-proven-deployment derivation.
export async function guaranteeRunHistory(owner: string, guaranteeId: string, limit = 20): Promise<GuaranteeRunRef[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const { data, error } = await db().from("v_preflight_runs")
      .select(RUN_REF_COLUMNS).eq("user_id", norm(owner)).eq("guarantee_id", guaranteeId)
      .order("created_at", { ascending: false }).limit(limit);
    if (error) {
      if (/guarantee_id/i.test(error.message ?? "")) warnUnmigrated("guaranteeRunHistory");
      return [];
    }
    return ((data as Record<string, unknown>[] | null) ?? []).map(rowToRunRef);
  } catch { return []; }
}
