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
import { apiTargetIdsForOwner, webRuntimeFilter } from "./preflight/runtime/targets-db";
import { memberWorkspaceIds } from "./preflight/team-access";
import type { FlowStep } from "./preflight/flow-steps";
import { requirementReviewIdentity } from "./preflight/contract-merge";

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
  // Migration 19 (additive; absent until applied). Records that this contract's approval was manufactured by
  // the pre-correction lane rather than performed by a person. SEPARATE from `status`, which records only
  // that an approval happened, and separate from any run decision, which is never rewritten.
  legacy_approval_class?: string | null;
};
export type ContractRequirement = {
  id: string; contract_id: string; category: string; requirement: string; severity: Severity; enabled: boolean;
  source: string | null; confidence: number | null; role: string | null; area: string | null; approved: boolean; order_index: number;
  // Phase-2 additive columns (sql/vraelis-preflight-2-discovery.sql); absent until that migration runs.
  // "inference" marks a requirement Vraelis proposed from a presence signal rather than observed evidence.
  origin?: string | null;
  // review_state: "suggested" (from discovery, awaiting the user's decision) | "approved" | "rejected".
  // Manual/pre-discovery rows default to "approved". `stale` marks a suggestion no longer observed on re-run
  // (kept, never deleted). These drive the suggestion-review UI; listRequirements select("*") already returns them.
  review_state?: string | null; stale?: boolean | null; reasoning_summary?: string | null;
  discovery_version_last_suggested?: number | null;
  // Migration 19 (additive; absent until applied). AUTHORSHIP AND REVIEW ARE SEPARATE FACTS:
  //   source/origin  = who or what authored the text
  //   review_state   = the review decision
  //   review_basis   = HOW that approval happened ("human_direct" | "reviewed_plan"), null when unapproved
  //   approved_by    = the person who reviewed it        (null unless review_state is "approved")
  //   approved_at    = when that person reviewed it      (null unless review_state is "approved")
  // legacy_review_class marks a row the migration-21 backfill corrected, so a row that was WRITTEN honestly
  // is always distinguishable from one that was CORRECTED into honesty.
  review_basis?: string | null; approved_by?: string | null; approved_at?: string | null;
  legacy_review_class?: string | null;
  // The canonical content the reviewer agreed to, captured at approval. A draft revision carries the
  // approval forward only when the copy still produces this exact value; anything else, including a missing
  // value, means the review cannot be proven to apply and is cleared.
  review_identity?: string | null;
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
  /** Migration 24. Set when the verdict came from a verifier defect: preserved, but no longer counted. */
  invalidated_at?: string | null;
};

export type NewApplication = { name: string; appUrl: string; builder?: string; repo?: string; sourcePrompt?: string; ownershipConfirmed: boolean; workspaceId?: string | null };

// ── Applications ──
// The machine-marker app_url of the internal founder API-canary app (lib/preflight/runtime/canary.ts
// CANARY_APP_URL). It is a real v_applications row created on the founder's account when the canary runs, but
// it is INTERNAL scaffolding and must never appear in the customer applications list, cards, or counts. We
// exclude it by its exact marker URL (no human app carries it). Kept as a local literal to avoid importing
// the founder-only canary module into the core web data layer.
const INTERNAL_CANARY_APP_URL = "https://internal.vraelis.local/__api-canary__";

export async function listApplications(userId: string): Promise<Application[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_applications").select("*").eq("user_id", norm(userId)).neq("app_url", INTERNAL_CANARY_APP_URL).order("created_at", { ascending: false });
  if (error) return []; // table not migrated yet, or transient — the shell renders an empty state
  return (data as Application[]) ?? [];
}

// TEAM: applications VISIBLE to a caller — their OWN apps (user_id = self) PLUS apps SHARED INTO A SPECIFIC
// WORKSPACE the caller is an active member of (workspace_id IN their member workspaces). Scoping shared apps
// by WORKSPACE (not by owner) is the precise, non-leaky boundary: an owner may own several workspaces, and the
// caller must only see apps in the workspace(s) they actually joined — never every app that owner has
// elsewhere. Deduped by app id. For a solo user with no shared memberships this returns EXACTLY
// listApplications(self) (identical set + order). Degrades to the caller's own apps when the workspace tables
// are absent.
export async function listApplicationsForMember(email: string): Promise<Application[]> {
  if (!isDatabaseConfigured()) return [];
  const self = norm(email);
  const own = await listApplications(self); // the caller's own apps (unchanged, always visible)
  const memberWsIds = await memberWorkspaceIds(email); // workspaces the caller actively belongs to
  // A caller's personal workspace is in this set too, but its apps are already in `own` — so filtering to
  // NON-owned apps in these workspaces yields only genuinely-shared apps. No shared memberships -> just own.
  if (memberWsIds.length === 0) return own;
  const { data, error } = await db().from("v_applications").select("*")
    .in("workspace_id", memberWsIds).neq("user_id", self) // shared INTO my workspaces, owned by someone else
    .neq("app_url", INTERNAL_CANARY_APP_URL).order("created_at", { ascending: false });
  if (error) return own; // fall back to own apps on any error
  const shared = (data as Application[]) ?? [];
  const seen = new Set(own.map((a) => a.id));
  const merged = [...own];
  for (const a of shared) if (!seen.has(a.id)) { seen.add(a.id); merged.push(a); }
  return merged;
}

// latestRunByApp across MULTIPLE owners (for the member dashboard): groups the app ids by their owner and
// runs the per-owner webRuntimeFilter query for each, merging the results. Each owner's api-target exclusion
// is computed for THAT owner (never cross-contaminated), which is exactly the metering-leak guard. For a
// single owner this is one query, identical to latestRunByApp.
export async function latestRunByAppForApps(apps: Application[]): Promise<Record<string, RunSummary>> {
  if (!isDatabaseConfigured() || !apps.length) return {};
  const byOwner = new Map<string, string[]>();
  for (const a of apps) {
    const o = norm(a.user_id);
    if (!byOwner.has(o)) byOwner.set(o, []);
    byOwner.get(o)!.push(a.id);
  }
  const out: Record<string, RunSummary> = {};
  for (const [owner, ids] of byOwner) {
    const partial = await latestRunByApp(owner, ids); // per-owner filter -> no cross-member api-target leak
    Object.assign(out, partial);
  }
  return out;
}

// The owner's INTERNAL app ids (today: the founder API-canary app) — customer web reads exclude runs/issues
// belonging to these so internal scaffolding never appears in the customer dashboard/passes/blockers. Empty
// for a normal customer account.
export async function internalAppIdsForOwner(userId: string): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_applications").select("id").eq("user_id", norm(userId)).eq("app_url", INTERNAL_CANARY_APP_URL);
  return ((data as { id: string }[] | null) ?? []).map((r) => r.id);
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
// The newest PRODUCTION contract for an app, draft or approved. Excludes kind='guarantee' for the same
// reason getApprovedContract does: a guarantee is a different object that happens to share this table and
// this app's single version sequence.
//
// WITHOUT THE KIND FILTER THIS RETURNED A GUARANTEE CONTRACT AND BROKE THE VERIFY BUTTON. When kind was
// added (migration 23) the filter went onto getApprovedContract and not onto this function directly above
// it. The two then answered different questions, and the system overview asks THIS one while the run route
// asks the other:
//
//   overview page  getContract()          -> v9 approved kind=guarantee   (5 flow ids, posted to the route)
//   run route      getApprovedContract()  -> v2 approved kind=production  (3 flow ids, the only ones valid)
//
// Disjoint sets, so every launch failed flow eligibility with "One or more selected flows are not enabled
// and approved" — a 400 on the primary action of the main screen, permanent rather than transient, for any
// app whose newest contract is a guarantee. Measured on demo@vraelis.com/Notewell before this changed.
//
// The draft route is the reason this is fixed here rather than at the one call site: it forks a new revision
// from whatever this returns, so an unfiltered read forks the production lineage off a guarantee contract.
// A display bug and a write bug from one missing filter.
export async function getContract(userId: string, applicationId: string): Promise<ProductionContract | null> {
  if (!isDatabaseConfigured()) return null;
  const base = () => db().from("v_production_contracts").select("*").eq("user_id", norm(userId))
    .eq("application_id", applicationId).order("version", { ascending: false }).limit(1);
  // kind is additive with default 'production', so pre-existing rows already answer this. If the column is
  // absent the query errors and we fall back — on that schema no guarantee contract can exist, so the
  // unfiltered read is exactly equivalent. Same pattern as getApprovedContract, deliberately.
  const filtered = await base().eq("kind", "production").maybeSingle();
  if (!filtered.error) return (filtered.data as unknown as ProductionContract) ?? null;
  const { data } = await base().maybeSingle();
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
// The system's PRODUCTION contract: the customer's own curated requirements, and the one a browser launch
// runs. It deliberately excludes kind='guarantee'.
//
// WHY THAT EXCLUSION EXISTS BEFORE THE THING IT EXCLUDES. Approving a guarantee's plan materializes it into
// a frozen contract on the SAME application, and this query returns the highest-version APPROVED contract.
// Without the filter, approving one guarantee would silently replace the customer's Production Contract for
// the contract page, the context page, pass preview, api-flows and every later browser-launched run. The
// guard ships first, so the feature can never land ahead of it.
export async function getApprovedContract(userId: string, applicationId: string): Promise<ProductionContract | null> {
  if (!isDatabaseConfigured()) return null;
  const base = () => db().from("v_production_contracts").select("*").eq("user_id", norm(userId)).eq("application_id", applicationId)
    .eq("status", "approved").order("version", { ascending: false }).limit(1);
  // kind is additive (migration 23) with default 'production', so every pre-existing row already answers
  // this filter correctly. If the column is absent the query errors and we fall back — on that schema no
  // guarantee contract can exist yet, so the unfiltered read is exactly equivalent.
  const filtered = await base().eq("kind", "production").maybeSingle();
  if (!filtered.error) return (filtered.data as unknown as ProductionContract) ?? null;
  const { data } = await base().maybeSingle();
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

// Ordered by order_index, then created_at, then id. The trailing keys are a TOTAL-ORDER GUARANTEE, not an
// ordering claim: where order_index ties (152 legacy rows do, because the old insert hardcoded 9999), this
// at least returns the same sequence on every read instead of whatever Postgres happens to produce. It does
// NOT reconstruct the order those rows were approved in — see requirementsForRun, which reads historical
// order from the immutable reviewed plan and refuses to invent one when there is no plan to read.
export async function listRequirements(userId: string, contractId: string): Promise<ContractRequirement[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_contract_requirements").select("*").eq("user_id", norm(userId)).eq("contract_id", contractId)
    .order("order_index", { ascending: true }).order("created_at", { ascending: true }).order("id", { ascending: true });
  return (data as ContractRequirement[]) ?? [];
}

// Whether this contract's stored requirement order is trustworthy. A contract whose rows share an
// order_index has no recoverable authored order: prepareVerification inserted sequentially, but a UUID is
// not evidence of insertion order and two rows can share a timestamp. Callers report this rather than
// presenting a manufactured sequence as the approved one.
export function requirementOrderIsComplete(reqs: ContractRequirement[]): boolean {
  const seen = new Set<number>();
  for (const r of reqs) {
    const i = typeof r.order_index === "number" ? r.order_index : 0;
    if (seen.has(i)) return false;
    seen.add(i);
  }
  return true;
}

// One requirement row, owner-scoped. Null when it does not exist for this owner.
export async function getRequirementById(userId: string, id: string): Promise<ContractRequirement | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_contract_requirements").select("*").eq("user_id", norm(userId)).eq("id", id).maybeSingle();
  return (data as unknown as ContractRequirement) ?? null;
}

// Verify a contract belongs to this owner (used before any requirement mutation).
async function ownsContract(uid: string, contractId: string): Promise<boolean> {
  const { data } = await db().from("v_production_contracts").select("id").eq("user_id", uid).eq("id", contractId).maybeSingle();
  return !!data;
}

// ── APPROVAL FREEZES MEANING ───────────────────────────────────────────────────────────────────────────
// One policy, used by every helper that writes semantic contract content.
//
// A verification run persists contract_id. If approved requirement or flow content can change in place
// afterwards, that run's contract_id resolves to CURRENT meaning rather than the meaning approved when the
// run began, and a rerun proves something different while still calling itself a rerun. History rewrites
// itself silently.
//
// The flow helpers already enforced this through contractStatusForFlow. contractStatusForRequirement was
// written, exported, and never wired to anything: addRequirement checked ownership but not status, and
// updateRequirement and deleteRequirement checked neither. So an approved contract accepted a new
// requirement, an edited requirement, and a deleted requirement.
//
// SEMANTIC content freezes at approval: requirement text, the requirement set and its order, flow steps and
// assertions, the flow set. LIFECYCLE state does not: approval timestamps, execution linkage, run counters.
//
// A meaningful revision after approval is a NEW contract version, which prepareVerification already creates
// per verification, not an edit to the one historical runs point at.
export async function contractAcceptsSemanticWrite(uid: string, contractId: string): Promise<boolean> {
  const contract = await getContractById(uid, contractId);
  return contract?.status === "draft";
}

async function requirementAcceptsSemanticWrite(uid: string, requirementId: string): Promise<boolean> {
  // null covers "does not exist for this owner", which the callers already treat as a refusal.
  return (await contractStatusForRequirement(uid, requirementId)) === "draft";
}

// ── REQUIREMENT INSERTION: TWO WRITERS, NEITHER OF WHICH MAY GUESS ─────────────────────────────────────
//
// There used to be ONE addRequirement, called both by a person typing in the dashboard and by
// prepareVerification writing what a model synthesized. It hardcoded source "manual" and approved true, and
// passed neither `origin` nor `review_state`, so both columns fell to the migration-2 defaults 'user' and
// 'approved'. Every model-authored requirement therefore claimed, in the database, that a person wrote it
// and a person approved it. 136 production rows carry that claim. The synthesis layer already forbids this
// in writing (discover-synthesis: "manual" is never a valid AI attribution) — the write path simply did not
// obey it.
//
// The fix is not a parameter. It is two functions that cannot be confused for one another:
//
//   addAuthoredRequirement   a PERSON typed this text.        source manual,    origin user
//   addGeneratedRequirement  a MODEL synthesized this text.   source inference, origin prompt
//
// Neither reads a database default for authorship or review; every provenance column is supplied at the
// call site. A generated writer cannot reach the authored one, and the AST ratchet in
// scripts/preflight-provenance-integrity-verify.ts fails the build if it ever can.
export type RequirementInput = { requirement: string; category?: string; severity?: Severity; role?: string; area?: string };

// How a requirement came to be approved. Null is not "unknown", it is "not approved": review_basis is
// non-null exactly when review_state is "approved".
export type ReviewBasis = "human_direct" | "reviewed_plan";

// The review facts a row carries at insertion. "unreviewed" is not a review_state (the lifecycle stays
// suggested | approved | rejected | archived); it is the ABSENCE of a review, which is what `suggested`
// already means for generated content awaiting a decision.
export type RequirementReview =
  | { reviewed: false }
  | { reviewed: true; basis: ReviewBasis; approvedBy: string; approvedAt: string };

function reviewColumns(review: RequirementReview, identity: string) {
  return review.reviewed
    ? {
      review_state: "approved", approved: true, review_basis: review.basis,
      approved_by: norm(review.approvedBy), approved_at: review.approvedAt,
      // What the reviewer was agreeing to, captured at the moment they agreed. A later draft revision may
      // carry this approval forward only if the content still hashes to this exact value.
      review_identity: identity,
    }
    : {
      // Generated-or-authored-but-undecided. No reviewer identity, no timestamp, no basis: a row must never
      // imply a review that did not happen.
      review_state: "suggested", approved: false, review_basis: null,
      approved_by: null, approved_at: null, review_identity: null,
    };
}

// order_index = max+1 for this contract, mirroring addFlow. The old code hardcoded 9999 for every row, which
// is why 152 rows across 21 contracts share an order_index with a sibling and requirement order is whatever
// Postgres happens to return. Callers that own a canonical order (the verification lane, whose plan order is
// what plan_hash binds) pass their index explicitly instead.
async function nextRequirementOrderIndex(uid: string, contractId: string): Promise<number> {
  const existing = await listRequirements(uid, contractId);
  return existing.reduce((m, r) => Math.max(m, typeof r.order_index === "number" ? r.order_index : 0), 0) + 1;
}

async function insertRequirement(
  uid: string, contractId: string, input: RequirementInput,
  provenance: { source: string; origin: string; review: RequirementReview; orderIndex: number },
): Promise<ContractRequirement | null> {
  const requirement = (input.requirement || "").trim().slice(0, 400);
  if (!requirement) return null;
  const category = (input.category || "general").slice(0, 60);
  const severity = input.severity ?? "important";
  const { data, error } = await db().from("v_contract_requirements").insert({
    contract_id: contractId, user_id: uid, requirement, category,
    severity, enabled: true,
    role: input.role ?? null, area: input.area ?? null,
    // EXPLICIT. Nothing below is allowed to come from a column default.
    source: provenance.source, origin: provenance.origin,
    ...reviewColumns(provenance.review, requirementReviewIdentity({ requirement, category, severity, enabled: true })),
    order_index: provenance.orderIndex,
  } as never).select("*").single();
  // THIS ERROR USED TO BE DISCARDED, and it cost more than the bug it hid. A raw NUL byte in the review
  // identity separator made every reviewed insert fail the text encoding, and because only `data` was read
  // the failure became a silent null. The caller turned that into "claim_not_testable" — telling a customer
  // their claim was too vague when the real cause was a control character in our own source. A write that
  // fails must say so, or the layer above it will invent a reason.
  if (error) {
    console.error(`insertRequirement: refused by the database for contract ${contractId}: ${error.message}`);
    return null;
  }
  return (data as unknown as ContractRequirement) ?? null;
}

/**
 * A PERSON typed this requirement. Records human AUTHORSHIP and nothing more.
 *
 * Typing text proves who wrote it. It does not prove they then reviewed it as binding contract content, so
 * the row lands `suggested` and the person approves it through the explicit review action. A generic "Add
 * requirement" button must never silently approve; a future "Add and approve" may, provided the UI says so
 * and it records the same review provenance as the normal approval path.
 */
export async function addAuthoredRequirement(userId: string, contractId: string, input: RequirementInput): Promise<ContractRequirement | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(userId);
  if (!(await ownsContract(uid, contractId))) return null;
  // Approval freezes the requirement SET, not only the text of existing rows.
  if (!(await contractAcceptsSemanticWrite(uid, contractId))) return null;
  return insertRequirement(uid, contractId, input, {
    source: "manual", origin: "user", review: { reviewed: false },
    orderIndex: await nextRequirementOrderIndex(uid, contractId),
  });
}

/**
 * A MODEL synthesized this requirement from the caller's claim.
 *
 * source "inference" is the closed-set provenance tag for text the model inferred; origin "prompt" is where
 * the material came from, the claim being the contract's source_prompt. The claim is INPUT MATERIAL, never
 * the author, which is why neither column says "manual" or "user".
 *
 * `review` is `{reviewed:false}` on the direct synthesis lane (nobody has looked at it) and a reviewed_plan
 * approval only when an approved, hash-verified immutable plan is being executed. orderIndex is the plan's
 * own position, so the stored order reproduces the order plan_hash bound.
 */
export async function addGeneratedRequirement(
  userId: string, contractId: string, input: RequirementInput,
  provenance: { review: RequirementReview; orderIndex: number },
): Promise<ContractRequirement | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(userId);
  if (!(await ownsContract(uid, contractId))) return null;
  if (!(await contractAcceptsSemanticWrite(uid, contractId))) return null;
  return insertRequirement(uid, contractId, input, {
    source: "inference", origin: "prompt", review: provenance.review, orderIndex: provenance.orderIndex,
  });
}

// Owner-scoped patch of a requirement (toggle enabled, change severity, edit text, or accept/reject a
// discovery suggestion). Any content edit marks the row user_modified + review_state 'approved' so a later
// discovery regeneration never silently overwrites a user-touched requirement (the merge planner preserves
// origin==='user'/user_modified/approved rows). A 'reject' sets review_state 'rejected', which the merge
// planner treats as sticky: a future discovery re-run will not resurrect it.
export async function updateRequirement(
  userId: string,
  id: string,
  patch: { enabled?: boolean; severity?: Severity; requirement?: string; reviewState?: "approved" | "rejected" },
  // The PERSON performing this patch. An accept is the one moment a human review is recorded on a row, so
  // the reviewer's identity is required rather than inferred from the app owner (on a team, the owner and
  // the person clicking are routinely different people).
  reviewer: string,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (!(await requirementAcceptsSemanticWrite(norm(userId), id))) return false;
  const fields: Record<string, unknown> = {};
  if (typeof patch.enabled === "boolean") fields.enabled = patch.enabled;
  if (patch.severity) fields.severity = patch.severity;
  if (typeof patch.requirement === "string") { fields.requirement = patch.requirement.trim().slice(0, 400); fields.user_modified = true; }

  // A REVIEW DESCRIBES THE EXACT CONTENT THAT WAS REVIEWED.
  //
  // Changing the text, the severity, or whether the requirement binds at all changes what a reviewer would
  // have been agreeing to. Carrying the old approval across that change would let edited content inherit a
  // review nobody gave it, which is the same defect as a default that assumes one. So any semantic change
  // that is not itself an explicit review decision drops the row back to `suggested` and clears the
  // reviewer, the timestamp and the basis together.
  const semanticChange = typeof patch.requirement === "string" || !!patch.severity || typeof patch.enabled === "boolean";
  if (semanticChange && !patch.reviewState) {
    fields.review_state = "suggested";
    fields.approved = false;
    fields.review_basis = null;
    fields.approved_by = null;
    fields.approved_at = null;
    fields.review_identity = null;
  }

  // Accept a suggestion -> approved + enabled; reject -> rejected + disabled (so a rejected suggestion can
  // never count toward an approvable contract). Absent reviewState leaves the column untouched (legacy edit).
  //
  // An accept is a HUMAN REVIEW and is recorded as one: who, when, and on what basis. It is the only path
  // besides a hash-verified reviewed plan that may write review_state "approved".
  if (patch.reviewState === "approved") {
    // Capture WHAT is being approved, not just that something was. The row as it will exist after this
    // patch: the incoming values where present, the stored ones otherwise. An approval whose identity was
    // computed from stale content would be a review of text the reviewer never saw.
    const current = await getRequirementById(norm(userId), id);
    if (!current) return false;
    const enabled = typeof fields.enabled === "boolean" ? fields.enabled : true;
    fields.review_state = "approved";
    fields.approved = true;
    fields.review_basis = "human_direct";
    fields.approved_by = norm(reviewer);
    fields.approved_at = new Date().toISOString();
    fields.review_identity = requirementReviewIdentity({
      requirement: String(fields.requirement ?? current.requirement),
      category: String(fields.category ?? current.category),
      severity: String(fields.severity ?? current.severity),
      enabled,
      source_refs: (current as { source_refs?: unknown }).source_refs as never,
    });
    if (typeof patch.enabled !== "boolean") fields.enabled = true;
  } else if (patch.reviewState === "rejected") {
    fields.review_state = "rejected";
    fields.approved = false;
    fields.review_basis = null;
    fields.approved_by = null;
    fields.approved_at = null;
    fields.review_identity = null;
    fields.enabled = false;
  }
  if (!Object.keys(fields).length) return true;
  const { error } = await db().from("v_contract_requirements").update(fields as never).eq("user_id", norm(userId)).eq("id", id);
  return !error;
}

export async function deleteRequirement(userId: string, id: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  // A deleted row leaves no timestamp, so this is the one mutation no later audit could detect.
  if (!(await requirementAcceptsSemanticWrite(norm(userId), id))) return false;
  const { error } = await db().from("v_contract_requirements").delete().eq("user_id", norm(userId)).eq("id", id);
  return !error;
}

// How an approval is being performed. There is no machine actor, and that absence is the point: a contract
// can be approved by a person deciding row by row, or by a person approving one exact immutable plan. There
// is no third way, so no code path can approve a contract without a human decision behind it.
export type ApprovalActor =
  | { kind: "human_direct"; email: string }
  // A hash-verified approved reviewed plan. planHash is re-checked against the rows this contract actually
  // carries before the approval is written, so an approval can never cover more than the reviewer saw.
  | { kind: "reviewed_plan"; planId: string; approvedBy: string; approvedAt: string };

// Why a contract may or may not be approved. PURE and total, so the rule can be tested with real inputs
// instead of asserted against the source text of the function that used to hold it. The previous suite
// checked for an exact statement string here, went red when that statement was reworded while staying
// correct, and taught everyone to edit the checker.
export type ApprovalReadiness =
  | { ok: true }
  | { ok: false; reason: "no_enabled_requirement" | "unreviewed_requirement" | "unattributed_approval" | "approval_actor_mismatch" };

export function contractApprovalReadiness(reqs: ContractRequirement[], actor: ApprovalActor): ApprovalReadiness {
  // AN ENABLED REQUIREMENT IS PART OF THE OFFICIAL MEANING, SO IT MUST HAVE BEEN REVIEWED.
  //
  // This once required only that ONE enabled requirement existed, and never that any had been approved, so
  // an enabled row still in review_state 'suggested' froze into the contract and became binding. It was also
  // satisfied for free: the migration-2 default made every row 'approved' before anyone looked at it. Now
  // that no writer reads a default, the check does what it says.
  const enabled = reqs.filter((r) => r.enabled);
  if (!enabled.length) return { ok: false, reason: "no_enabled_requirement" };
  if (enabled.some((r) => (r as { review_state?: string }).review_state !== "approved")) {
    return { ok: false, reason: "unreviewed_requirement" };
  }

  // AND EVERY ONE OF THOSE APPROVALS MUST NAME THE PERSON WHO GAVE IT. "approved" with no reviewer and no
  // timestamp is exactly the shape of the defect being corrected: a state that reads like a human decision
  // and records none.
  //
  // Rows written before migration 19 have no such columns to carry, and are grandfathered ONLY when the
  // columns are absent entirely (undefined), never when they are present and null, which would mean a
  // post-migration writer skipped them.
  const unattributed = enabled.filter((r) => !r.review_basis || !r.approved_by || !r.approved_at);
  const preMigration = unattributed.some((r) => r.review_basis === undefined);
  if (unattributed.length && !preMigration) return { ok: false, reason: "unattributed_approval" };

  // A reviewed-plan approval must still be covering THIS contract's rows. evaluateForExecution verified the
  // stored plan against its own hash before execution began; this is the second half of that guarantee, at
  // the moment approval is written. An approval may only ever cover the exact set the reviewer saw.
  if (actor.kind === "reviewed_plan") {
    const approver = norm(actor.approvedBy);
    const mismatched = enabled.some((r) => {
      if (r.review_basis === undefined) return false; // pre-migration-19 row, grandfathered as above
      return r.review_basis !== "reviewed_plan" || norm(r.approved_by || "") !== approver;
    });
    if (mismatched) return { ok: false, reason: "approval_actor_mismatch" };
  }

  return { ok: true };
}

// Approve a contract (requires at least one enabled requirement). Approval is the gate before a paid run.
export async function approveContract(userId: string, contractId: string, actor: ApprovalActor): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const uid = norm(userId);
  const reqs = await listRequirements(uid, contractId);
  // The whole rule lives in contractApprovalReadiness, which is pure and directly tested. Keeping it here
  // as inline statements is what let a checker assert on its exact wording and go red when the wording moved.
  if (!contractApprovalReadiness(reqs, actor).ok) return false;

  const { error } = await db().from("v_production_contracts").update({ status: "approved", approved_at: new Date().toISOString() } as never).eq("user_id", uid).eq("id", contractId);
  if (!error) {
    await logEvent({
      userId: uid, eventType: "preflight_contract_approved", actorType: "owner", source: "app",
      // Who approved, and how. A contract approval that cannot say which of the two paths produced it is not
      // auditable after the fact.
      metadata: {
        contract_id: contractId, requirements: reqs.length, review_basis: actor.kind,
        approved_by: actor.kind === "human_direct" ? norm(actor.email) : norm(actor.approvedBy),
        ...(actor.kind === "reviewed_plan" ? { reviewed_plan_id: actor.planId } : {}),
      },
    });
  }
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
  // Accept/reject a discovery-suggested flow. "approved" folds it into the contract (enabled); "rejected"
  // disables it and is sticky across re-runs. Absent leaves review_state untouched (legacy edit).
  reviewState?: "approved" | "rejected";
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
  // Accept a suggested flow -> approved + enabled; reject -> rejected + disabled (never counts toward coverage,
  // and the merge planner keeps it rejected on a future discovery re-run). A content edit marks user_modified.
  if (patch.reviewState === "approved") { fields.review_state = "approved"; if (typeof patch.enabled !== "boolean") fields.enabled = true; }
  else if (patch.reviewState === "rejected") { fields.review_state = "rejected"; fields.enabled = false; }
  if (patch.name !== undefined || patch.goal !== undefined || patch.steps !== undefined) fields.user_modified = true;
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

// WEB runs only — EXCLUDE the owner's api-kind runtime targets. (A web run has a NULL or web-target
// runtime_target_id; the migration-12 optional correlation UPDATE may have set historical web runs to their
// non-null web target, so we must exclude api targets rather than require NULL.) This keeps an API run's
// decision from ever becoming the app's web verdict.
export async function listRuns(userId: string, applicationId: string, limit = 20): Promise<RunSummary[]> {
  if (!isDatabaseConfigured()) return [];
  const filter = webRuntimeFilter(await apiTargetIdsForOwner(userId));
  let q = db().from("v_preflight_runs").select("id,application_id,state,decision,summary,deployment_url,commit_sha,created_at,completed_at").eq("user_id", norm(userId)).eq("application_id", applicationId);
  if (filter) q = q.or(filter);
  const { data } = await q.order("created_at", { ascending: false }).limit(limit);
  return (data as RunSummary[]) ?? [];
}

// Latest run per application, for dashboard status chips. One query, grouped in memory. WEB runs only.
export async function latestRunByApp(userId: string, appIds: string[]): Promise<Record<string, RunSummary>> {
  if (!isDatabaseConfigured() || !appIds.length) return {};
  const filter = webRuntimeFilter(await apiTargetIdsForOwner(userId));
  // invalidated_at is additive (migration 24) and a missing column fails the WHOLE select, which would take
  // the dashboard's health with it. Ask for it, and fall back to the pre-migration columns on a column
  // error: without it every run simply reads as valid, which is exactly the old behaviour.
  const BASE = "id,application_id,state,decision,summary,deployment_url,commit_sha,created_at,completed_at";
  const build = (cols: string) => {
    let q = db().from("v_preflight_runs").select(cols).eq("user_id", norm(userId)).in("application_id", appIds);
    if (filter) q = q.or(filter);
    return q.order("created_at", { ascending: false });
  };
  let { data, error } = await build(`${BASE},invalidated_at`);
  if (error && /invalidated_at/i.test(error.message ?? "")) {
    console.warn("latestRunByApp: v_preflight_runs.invalidated_at is missing. Apply sql/vraelis-preflight-24-run-invalidation.sql (migration 24). Verifier-defect runs will still count toward health.");
    ({ data } = await build(BASE));
  }
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
