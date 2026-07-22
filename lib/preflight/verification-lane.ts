// The verification lane: turn a claimed outcome into runnable, approved flows without a human.
//
// EXTERNALLY this is the whole product. A caller sends a deployment URL and a sentence about what should be
// true, and gets back an evidence-backed decision. Applications, contracts, requirements, flows and passes
// are implementation details they never learn.
//
// INTERNALLY none of those went away, and this file is where the mismatch is absorbed. The Preflight
// pipeline was built around a person approving each step: discovery writes every flow as
// `enabled: false, review_state: "suggested"` and `flowApprovedEnabled` demands both be true, so nothing
// discovery produces can ever run on its own. An unattended verification has to approve what synthesis
// proposed, deliberately and visibly.
//
// TWO RULES HOLD THIS TOGETHER.
//
//   1. This lane never launches anything. It prepares an application, a contract and approved flows, then
//      hands off to the unchanged runs route, which owns every spend and safety gate. There is exactly one
//      launch path and this is not it.
//
//   2. Auto-approval is recorded, never hidden. The contract carries the claim as its source prompt and the
//      caller always gets back the requirements Vraelis derived. A misread claim producing a confident
//      wrong verdict is the main failure mode of this endpoint, and echoing the requirements is what makes
//      that visible instead of silent.
//
// ORDERING IS NOT NEGOTIABLE. Approving a contract FREEZES it: addFlow, updateFlow and deleteFlow all
// return `contract_approved` afterwards. The only valid sequence is create app -> synthesize -> write
// requirements -> write flows -> approve contract. Backwards produces an application that can never run and
// cannot be repaired in place.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import {
  listApplications, createApplication, addRequirement, addFlow, approveContract,
  type Application, type Severity,
} from "../v-applications";
import { crawl } from "./discover-crawl";
import { makeSafeFetcher } from "./crawl-fetch";
import { synthesize, synthesisConfigured, type Synthesis } from "./discover-synthesis";
import type { PageSnapshot } from "./discover-extract";
import { validateSteps, type FlowStep } from "./flow-steps";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// The lane's application is marked by its builder field so it can be found again without a schema change,
// and so the dashboard can tell it apart from an application the owner connected by hand.
export const LANE_BUILDER = "vraelis_api";
const LANE_NAME = "API verifications";

export type LaneFailure = { error: string; message: string; status: number };

/**
 * The single application every verification for this owner hangs off.
 *
 * ONE application, reused, deliberately. An application per verification would be a cleaner mapping but it
 * creates unbounded rows from an API key and collides with the free tier's single-application cap. One
 * lane application sidesteps both: the cap is never approached, and there is nothing for a runaway agent to
 * inflate.
 *
 * Its own URL is nominal. What a run actually tests is the deployment_url passed per launch, so one lane
 * application serves every deployment the owner ever verifies.
 */
export async function laneApplication(owner: string, deploymentUrl: string): Promise<Application | LaneFailure> {
  if (!isDatabaseConfigured()) return { error: "unavailable", message: "Verification storage is unavailable.", status: 503 };
  const existing = (await listApplications(owner)).find((a) => a.builder === LANE_BUILDER);
  if (existing) return existing;

  const created = await createApplication(owner, {
    name: LANE_NAME,
    appUrl: deploymentUrl,
    builder: LANE_BUILDER,
    // The caller authenticated with their own key and named their own deployment. That IS the attestation;
    // there is no second party here to confirm it to.
    ownershipConfirmed: true,
  });
  if (!created.ok) return { error: created.error, message: "Could not prepare the verification workspace.", status: 400 };
  return created.application;
}

/**
 * Read the deployment and work out what the claim means in terms of it.
 *
 * The claim is passed as the build prompt, which is the same input a human's original build prompt occupies
 * during discovery, so the synthesis model is being used exactly as it already is rather than in a new mode.
 */
// The pages are returned alongside the synthesis because the coverage correction loop needs the SAME
// discovery synthesis saw: flow correction repairs an execution plan against the reachable pages and
// controls, and re-crawling from scratch would both cost time and risk seeing a different app.
export type SynthesisResult = { synth: Synthesis; pages: PageSnapshot[] };

export async function synthesizeClaim(deploymentUrl: string, claim: string): Promise<SynthesisResult | LaneFailure> {
  if (!synthesisConfigured()) {
    return { error: "synthesis_unavailable", message: "Claim analysis is not configured on this deployment.", status: 503 };
  }
  const snapshot = await crawl(deploymentUrl, makeSafeFetcher(), { maxPages: 12, maxDepth: 2 });
  if (!snapshot.pages.length) {
    return {
      error: "deployment_unreachable",
      message: `Nothing could be loaded from ${deploymentUrl}. Check the URL is public and serving pages.`,
      status: 400,
    };
  }
  const synth = await synthesize(snapshot.pages, claim, { sources: [], connections: [] });
  if (!synth) {
    return { error: "synthesis_failed", message: "The claim could not be analyzed against this deployment. Try again.", status: 503 };
  }
  if (!synth.flows.length) {
    return {
      error: "claim_not_testable",
      message: "No browser flow could be derived from that claim against this deployment. Try naming the outcome more concretely, for example what a user does and what should be true afterwards.",
      status: 422,
    };
  }
  return { synth, pages: snapshot.pages };
}

export type PreparedVerification = {
  applicationId: string;
  contractId: string;
  contractVersion: number;
  flowIds: string[];
  /** The requirements Vraelis derived from the claim. ALWAYS returned to the caller. */
  requirements: string[];
};

// A requirement exactly as it would be written: the checkable text plus the metadata the contract stores.
export type PlanRequirement = { text: string; category: string; severity: Severity };

// A flow exactly as it would be written and run: the storage-shaped steps plus the metadata the run needs.
// priority is the synthesis severity label (critical/important/...), tied to the synth type so the two cannot drift.
export type PlanFlow = { name: string; goal: string; role: string | null; steps: FlowStep[]; priority: Synthesis["flows"][number]["priority"] };

// The requirements and flows a verification WOULD write and approve, with nothing launched and nothing
// stored. This is what the coverage gate inspects, so the gate judges precisely what a paid run would
// execute rather than a looser or stricter version of it. projectPlan is PURE (the same synthesis always
// projects the same plan); the correction loop may replace this plan with a stronger one, but whatever plan
// reaches prepareVerification is exactly what runs.
export type PlannedVerification = { requirements: PlanRequirement[]; flows: PlanFlow[] };

export function projectPlan(synth: Synthesis): PlannedVerification {
  const requirements: PlanRequirement[] = [];
  for (const r of synth.requirements.slice(0, 40)) {
    const text = (r.text || "").trim();
    if (text) requirements.push({ text, category: r.category || "correctness", severity: r.severity });
  }
  // Roles a flow may sign into are drawn from the synthesis itself (a flow that declares role "admin" makes
  // "admin" available to sign_in_as). Same derivation prepareVerification uses, so validation matches.
  const roles = Array.from(new Set(synth.flows.map((f) => (f.role || "").trim()).filter(Boolean)));
  const flows: PlanFlow[] = [];
  for (const f of synth.flows.slice(0, 20)) {
    const steps = validateSteps(f.steps, { rolesAvailable: roles });
    if (!steps.ok) continue; // a flow the designer validator rejects would never run; it is not part of the plan
    flows.push({
      name: f.name, goal: f.goal, role: f.auth_required ? (f.role || null) : null,
      steps: steps.steps, priority: f.priority,
    });
  }
  return { requirements, flows };
}

/** The requirement texts of a plan, for the deterministic coverage checks (which read strings). */
export function planRequirementTexts(plan: PlannedVerification): string[] {
  return plan.requirements.map((r) => r.text);
}

/**
 * Write a RESOLVED plan into a fresh contract with approved, enabled flows, then freeze it.
 *
 * The plan passed in is whatever survived the coverage gate: either projectPlan(synth) unchanged, or a
 * stronger plan the correction loop produced. prepareVerification writes exactly that plan and nothing else,
 * so what runs is exactly what the deterministic gate judged sufficient. It does not re-derive or re-validate
 * the plan; the resolver already validated every corrected flow through the same designer validator.
 *
 * A new contract per verification, rather than appending to one: an approved contract is immutable, so a
 * second claim could not add its flows to the first claim's contract even if we wanted it to. A fresh
 * contract also keeps each verification's requirements exactly the ones its own claim produced, which is
 * what the response echoes back.
 */
export async function prepareVerification(
  owner: string, app: Application, claim: string, plan: PlannedVerification,
): Promise<PreparedVerification | LaneFailure> {
  const uid = norm(owner);

  // Next revision for this application. There is no unique index on (application_id, version), so a
  // concurrent verification could pick the same number. That is survivable: version is a label for humans
  // reading history, and every downstream read is keyed by contract ID, which is unique. Racing produces two
  // contracts sharing a label, never two verifications sharing flows.
  const { data: last } = await db().from("v_production_contracts" as never)
    .select("version").eq("user_id", uid).eq("application_id", app.id)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  const version = Number((last as { version?: number } | null)?.version ?? 0) + 1;

  const { data: inserted, error } = await db().from("v_production_contracts" as never)
    .insert({
      application_id: app.id, user_id: uid, version, status: "draft",
      // The claim IS the source prompt. Anyone opening this contract later sees the sentence it came from.
      source_prompt: claim.slice(0, 20000),
    } as never)
    .select("id").single();
  if (error || !inserted) {
    return { error: "unavailable", message: "Could not create the verification contract.", status: 503 };
  }
  const contractId = String((inserted as unknown as { id: string }).id);

  // Write exactly the resolved plan. It is the single source of truth for what this verification carries, so
  // the gate and the run can never disagree about what was checked.

  // Requirements first: approveContract refuses a contract with no enabled requirement, and a flow's
  // requirement_refs are only meaningful once the requirements exist. addRequirement inserts
  // enabled + approved, which is the auto-approval decision made explicit.
  const requirements: string[] = [];
  for (const r of plan.requirements) {
    const added = await addRequirement(uid, contractId, { requirement: r.text, category: r.category, severity: r.severity });
    if (added) requirements.push(r.text);
  }
  if (!requirements.length) {
    return {
      error: "claim_not_testable",
      message: "No checkable requirement could be derived from that claim. Try naming the outcome more concretely.",
      status: 422,
    };
  }

  // Then flows. Every flow here already passed the SAME designer validator the dashboard uses (projectPlan for
  // the original plan, the resolver for any corrected flow), so a model that emitted an unusable step was
  // dropped before we ever reached a browser the caller paid for.
  const flowIds: string[] = [];
  for (const f of plan.flows) {
    const added = await addFlow(uid, contractId, {
      name: f.name, goal: f.goal, role: f.role, steps: f.steps, priority: f.priority,
    });
    if (added && !("error" in added)) flowIds.push(added.id);
  }
  if (!flowIds.length) {
    return {
      error: "claim_not_testable",
      message: "The steps derived from that claim could not be turned into a runnable browser flow. Try naming the outcome more concretely.",
      status: 422,
    };
  }

  // Freeze it. Everything above had to happen first; nothing can be added after this line.
  if (!(await approveContract(uid, contractId))) {
    return { error: "unavailable", message: "Could not finalize the verification contract.", status: 503 };
  }

  return { applicationId: app.id, contractId, contractVersion: version, flowIds, requirements };
}
