// POST /api/v1/verifications — the public primitive.
//
//   { "deployment_url": "https://example.com",
//     "claim": "A customer can upgrade to Pro, receive access, and retain it after signing in again." }
//
//   -> { "verification_id": "vrf_...", "state": "running", "status_url": "/v1/verifications/vrf_..." }
//
// The caller never learns what an application, a contract, a flow, or a pass is. Those all still exist and
// verification-lane.ts absorbs the mismatch.
//
// THIS ROUTE DOES NOT LAUNCH ANYTHING. It prepares the contract, then DELEGATES to the unchanged
// POST /api/preflight/apps/[id]/runs handler by calling it directly with the caller's own key.
//
// That delegation is the point, not a shortcut. The runs route holds every spend and safety gate inline:
// the kill switch, the cost governor, the global in-flight brake, the per-account velocity cap, team
// access, the role gate, entitlements, per-owner concurrency and daily caps, the per-key daily ceiling,
// idempotency with payload binding, and the credit hold. Re-implementing that list here would mean two
// copies that drift, and the first divergence is a key doing something the browser cannot. Calling the
// handler makes "one launch path" structural instead of a convention someone has to remember.
//
// A verification IS a run. verification_id is vrf_<runId>, so there is no second table to keep in sync with
// run state and no way for the two to disagree.
import { POST as launchRun } from "@/app/api/preflight/apps/[id]/runs/route";
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES, type Principal } from "@/lib/preflight/api-principal";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { laneApplication, synthesizeClaim, prepareVerification, laneRoles } from "@/lib/preflight/verification-lane";
import { repairPrompt } from "@/lib/preflight/coverage";
import { resolveCoverage, resolutionGaps, type CoverageResolution } from "@/lib/preflight/coverage-resolve";
import { runIdentity } from "@/lib/preflight/runs-db";
import { listRequirements } from "@/lib/v-applications";
// markLaunched is gone with the direct lane's launch: this path no longer starts a run, so there is no
// launched run to record against a reservation.
import { reserve, markFailed, verificationFingerprint } from "@/lib/preflight/verification-idempotency";
import { evaluateForExecution } from "@/lib/preflight/reviewed-plan";
import { mintReviewedPlan, getReviewedPlan, consumeReviewedPlan, markReviewedPlanRun, releaseReviewedPlan } from "@/lib/preflight/reviewed-plan-db";
import { createHash } from "crypto";
import { apiError, requestId } from "../_lib";
import { toVerificationId } from "./_shared";

export const runtime = "nodejs";
export const maxDuration = 300; // crawl + synthesis + at most two bounded corrections; inside the worker budget

const MAX_CLAIM = 2000;
// How long a minted reviewed plan stays approvable and runnable. Long enough to review and deploy, short
// enough that an approval cannot be run against a build that has since moved on.
const REVIEWED_PLAN_TTL_MS = 60 * 60 * 1000; // 60 minutes

// The coverage telemetry every /v1 response shares: what the plan was, what the bounded correction did to it,
// and the deterministic verdict at each stage. It carries NO internal pass ids, contract revision ids, or
// settlement fields — those are engine internals a caller must not couple to. Flow steps are shown as a count
// unless diagnostic mode is explicitly requested. `would_launch`/`blocked_reason` come straight from the
// deterministic resolver: the model never sets them.
function coverageTelemetry(claim: string, r: CoverageResolution, diagnostic: boolean) {
  const flowView = (flows: CoverageResolution["plan"]["flows"]) =>
    flows.map((f) => diagnostic
      ? { name: f.name, goal: f.goal, steps: f.steps.length, steps_detail: f.steps }
      : { name: f.name, goal: f.goal, steps: f.steps.length });
  return {
    requirements: r.plan.requirements.map((x) => x.text),
    flows: flowView(r.plan.flows),
    original_requirements: r.originalPlan.requirements.map((x) => x.text),
    corrected_requirements: r.requirementCorrectionAttempted ? r.plan.requirements.map((x) => x.text) : null,
    original_flows: flowView(r.originalPlan.flows),
    corrected_flows: r.flowCorrectionAttempted ? flowView(r.plan.flows) : null,
    coverage: {
      claim_before: r.claimBefore, claim_after: r.claimAfter,
      execution_before: r.executionBefore, execution_after: r.executionAfter,
    },
    requirement_correction_attempted: r.requirementCorrectionAttempted,
    flow_correction_attempted: r.flowCorrectionAttempted,
    recrawl_attempted: r.recrawlAttempted,
    remaining_obligations: r.remainingObligations,
    would_launch: r.readyToLaunch,
    blocked_reason: r.blockedReason,
    gaps: resolutionGaps(r),
    repair_prompt: r.readyToLaunch ? null : repairPrompt(claim, { claim: r.claimAfter, execution: r.executionAfter, readyToLaunch: false }),
    // The exact failure boundary of flow correction. status names where the model attempt landed; the counts
    // quantify it (original flows in, flows the model proposed, flows that passed validation, flows in the
    // final plan) and rejected gives the validator's reason for each drop. Diagnostic-only — an operator asks
    // for it when a block is surprising; the default response stays about the decision, not engine internals.
    ...(diagnostic ? {
      flow_correction: {
        status: r.flowCorrectionStatus,
        original_flow_count: r.originalPlan.flows.length,
        candidate_flow_count: r.flowCorrectionCandidates,
        accepted_flow_count: r.flowCorrectionAccepted,
        final_flow_count: r.plan.flows.length,
        rejected: r.flowCorrectionRejected,
      },
    } : {}),
  };
}

export async function POST(req: Request) {
  const rid = requestId();
  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);

  // Launching a verification spends money, so it needs the create scope. Same resolver, same scopes, same
  // error codes as every other keyed endpoint.
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const deploymentUrl = String((body as Record<string, unknown>)?.deployment_url ?? "").trim();
  const claim = String((body as Record<string, unknown>)?.claim ?? "").trim().slice(0, MAX_CLAIM);

  if (!deploymentUrl || !claim) {
    return apiError("validation_error", "Send both deployment_url and claim.", 400, rid);
  }
  const unsafe = unsafeHttpsUrlReason(deploymentUrl);
  if (unsafe) return apiError("validation_error", `deployment_url is not usable: ${unsafe}`, 400, rid);
  // A claim short enough to be a single word cannot describe an outcome, and the model would invent one.
  if (claim.length < 12) {
    return apiError("validation_error", "claim needs to describe an outcome, for example what a user does and what should be true afterwards.", 400, rid);
  }

  const dryRun = (body as Record<string, unknown>)?.dry_run === true;
  const diagnostic = (body as Record<string, unknown>)?.diagnostic === true;

  // DRY RUN. Synthesis + the bounded correction loop + the coverage gate, and nothing else: no browser, no
  // contract, no hold, no charge. This is how a caller or a CI step asks "is this claim provable against this
  // build, even after Vraelis tries to repair the plan?" before spending. would_launch here is the same
  // deterministic verdict the pre-run gate would reach on a paid request.
  if (dryRun) {
    // Dry-run idempotency: a changed claim under the same key must be refused BEFORE any model or crawl work.
    // The reservation is the same payload-bound one the launch path uses, so it enforces that guarantee here
    // too. A dry run never launches, so we release the key afterward (mark it failed = reclaimable), leaving
    // it usable for the real verification later.
    const idemKey = req.headers.get("idempotency-key");
    let ownsDry = false;
    if (idemKey) {
      const r = await reserve(p.principal.email, idemKey, verificationFingerprint(deploymentUrl, claim));
      if (r.outcome === "conflict") {
        await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications (dry_run)", status: 409 });
        return Response.json({ error: { code: "idempotency_key_reused", message: "That idempotency key was already used for a different verification. Use a new key, or resend the original request exactly.", request_id: rid } }, { status: 409, headers: { "X-Request-Id": rid } });
      }
      if (r.outcome === "pending") {
        return Response.json({ error: { code: "verification_in_progress", message: "An identical request is already being prepared. Retry in a moment.", request_id: rid } }, { status: 409, headers: { "X-Request-Id": rid, "Retry-After": "3" } });
      }
      ownsDry = r.outcome === "owned";
    }

    const s = await synthesizeClaim(deploymentUrl, claim);
    if ("error" in s) {
      if (ownsDry && idemKey) await markFailed(p.principal.email, idemKey);
      await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications (dry_run)", status: s.status });
      return Response.json({ error: { code: s.error, message: s.message, request_id: rid } }, { status: s.status, headers: { "X-Request-Id": rid } });
    }
    const resolution = await resolveCoverage(deploymentUrl, claim, s.synth, s.pages, { rolesAvailable: await laneRoles(p.principal.email) });
    if (ownsDry && idemKey) await markFailed(p.principal.email, idemKey); // dry run launched nothing; release the key

    // Mint an immutable REVIEWED PLAN when (and only when) the plan actually passes the gate. This is the exact
    // artifact a human/agent then approves and a paid run consumes verbatim — no re-synthesis. Additive: it is
    // returned alongside the usual telemetry, and if the table is not migrated yet mintReviewedPlan returns
    // null and the response simply carries no handle.
    let reviewed: { id: string; expiresAt: string } | null = null;
    if (resolution.readyToLaunch) {
      const discoveryHash = createHash("sha256").update(JSON.stringify(s.pages ?? [])).digest("hex").slice(0, 32);
      reviewed = await mintReviewedPlan({
      // A /v1 verification is a plain one: it runs on the API lane application, not against a standing
      // guarantee. Stated rather than omitted, so nobody later reads the absence as an oversight.
      guaranteeId: null,
        owner: p.principal.email, deploymentUrl, claim, plan: resolution.plan, discoveryHash,
        coverage: { claim_after: resolution.claimAfter, execution_after: resolution.executionAfter, ready: resolution.readyToLaunch },
        ttlMs: REVIEWED_PLAN_TTL_MS, nowMs: Date.now(),
      });
    }
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications (dry_run)", status: 200 });
    return Response.json({
      dry_run: true,
      claim,
      ...coverageTelemetry(claim, resolution, diagnostic),
      human_reviewed: false,
      // The reviewed-plan handle to approve, then submit to a paid run. Present only when the plan is launchable.
      ...(reviewed ? { reviewed_plan_id: reviewed.id, reviewed_plan_expires_at: reviewed.expiresAt, approval_required: true } : {}),
    }, { status: 200, headers: { "X-Request-Id": rid } });
  }

  // REVIEWED-PLAN EXECUTION. When the caller submits a reviewed_plan_id, run that EXACT approved plan: no
  // synthesis, no correction, no recrawl, no different contract revision. Approval is a required, separate
  // event — possessing the id is not approval — and consumption is atomic and once-only. This is the whole
  // point of the reviewed-plan contract: production executes precisely what was reviewed.
  const reviewedPlanId = String((body as Record<string, unknown>)?.reviewed_plan_id ?? "").trim();
  if (reviewedPlanId) {
    return executeReviewedPlan(req, rid, p.principal, deploymentUrl, claim, reviewedPlanId);
  }

  // IDEMPOTENCY, DECIDED BEFORE ANY WORK. Synthesis is a model call and a contract write; a retry must not
  // pay for either. The reservation is atomic (a unique row per owner+key), so two simultaneous identical
  // requests cannot both begin synthesis: one owns execution, the rest resolve to its result.
  //
  // Only an "owned" reservation proceeds. Everything else returns here, before laneApplication, synthesis,
  // contract creation, the run, the hold, or the charge. "unavailable" means migration 17 is not applied
  // yet; the code falls through to the post-hoc reconciliation still in place below, which is correct for
  // charges just wasteful on retries.
  const idemKey = req.headers.get("idempotency-key");
  let ownsReservation = false;
  if (idemKey) {
    const fp = verificationFingerprint(deploymentUrl, claim);
    const r = await reserve(p.principal.email, idemKey, fp);
    if (r.outcome === "replay") {
      // An identical request already launched. Return the ORIGINAL verification with no synthesis, contract,
      // run, hold, or charge. Requirements are read from the existing contract so the response shape matches.
      const idn = await runIdentity(p.principal.email, r.runId);
      const reqs = idn?.contractId
        ? (await listRequirements(p.principal.email, idn.contractId)).filter((x) => x.enabled).map((x) => x.requirement)
        : [];
      await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 200, runId: r.runId });
      const vid = toVerificationId(r.runId);
      return Response.json({ verification_id: vid, state: "running", status_url: `/v1/verifications/${vid}`, claim, requirements: reqs, human_reviewed: false }, { status: 200, headers: { "X-Request-Id": rid } });
    }
    if (r.outcome === "conflict") {
      await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 409 });
      return Response.json({ error: { code: "idempotency_key_reused", message: "That idempotency key was already used for a different verification. Use a new key, or resend the original request exactly.", request_id: rid } }, { status: 409, headers: { "X-Request-Id": rid } });
    }
    if (r.outcome === "pending") {
      // A concurrent identical request is already synthesizing. Do NOT start a second one; tell the caller to
      // retry, and the retry will resolve to the same verification once it launches.
      return Response.json({ error: { code: "verification_in_progress", message: "An identical verification is already being prepared. Retry in a moment.", request_id: rid } }, { status: 409, headers: { "X-Request-Id": rid, "Retry-After": "3" } });
    }
    ownsReservation = r.outcome === "owned";
  }

  // From here we may do work. If we own the reservation, any early failure must release it (mark it failed so
  // a later retry can resume) rather than leaving the key stuck pending forever.
  const releaseOnFailure = async () => { if (ownsReservation && idemKey) await markFailed(p.principal.email, idemKey); };

  const app = await laneApplication(p.principal.email, deploymentUrl);
  if ("error" in app) { await releaseOnFailure(); return apiError("internal_error", app.message, app.status, rid); }

  const s = await synthesizeClaim(deploymentUrl, claim);
  if ("error" in s) {
    await releaseOnFailure();
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: s.status, applicationId: app.id });
    return Response.json(
      { error: { code: s.error, message: s.message, request_id: rid } },
      { status: s.status, headers: { "X-Request-Id": rid } },
    );
  }

  // THE PRE-RUN GATE, with the bounded correction loop. Two deterministic checks must both pass before a
  // browser is launched or a pass is held: did the requirements PRESERVE the claim, and does a runnable flow
  // actually PROVE it. When either fails, the loop tries at most one requirement correction and at most one
  // flow correction to close the gap — the model PROPOSES a stronger plan, the deterministic validators DECIDE
  // whether it is now sufficient. Whatever plan comes back either passes both gates or is Blocked.
  //
  // The first real production run passed the first check, failed the second, spent a pass, and returned a
  // verdict from a journey that never exercised the guarantee. This is where that cannot happen again.
  //
  // A block here is NOT a run that came back blocked; no run happened. It is Vraelis declining to spend on a
  // test that could not prove the claim, and it costs the caller nothing. The reservation is released so a
  // corrected retry can reuse the key, and the telemetry (what correction did, what is still missing, a repair
  // prompt) is returned so the caller — or the agent that built the app — knows exactly what to change.
  const resolution = await resolveCoverage(deploymentUrl, claim, s.synth, s.pages, { rolesAvailable: await laneRoles(p.principal.email) });
  if (!resolution.readyToLaunch) {
    await releaseOnFailure();
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 422, applicationId: app.id });
    return Response.json({
      error: {
        code: "claim_not_provable",
        message: "Vraelis understood this claim but could not build a test that would prove it, even after trying to repair the plan, so no run was started and nothing was charged. See remaining_obligations and repair_prompt.",
        request_id: rid,
      },
      ...coverageTelemetry(claim, resolution, diagnostic),
    }, { status: 422, headers: { "X-Request-Id": rid } });
  }

  // ── BOTH GATES PASS, AND THAT IS STILL NOT A HUMAN REVIEW ───────────────────────────────────────────
  //
  // This is where the direct synthesis lane used to write a contract, approve it on the caller's behalf, and
  // launch. The approval was real in the database and imaginary in fact: a model read the claim, a model
  // wrote the requirements, and the row defaults recorded that a person had authored and approved them. 136
  // production rows still carry that claim. Preserving the old behaviour would mean manufacturing human
  // review, which is the one thing this product cannot do and still mean anything.
  //
  // So the plan is written as a REVIEWABLE DRAFT (model-authored, suggested, no reviewer, contract not
  // approved) and minted as an immutable reviewed plan for approval. Nothing launches, nothing is charged,
  // and the caller gets back the exact requirements plus the handle to approve. Once approved, resubmitting
  // with reviewed_plan_id runs precisely that hash-bound plan.
  //
  // The reviewed-plan lane may proceed without stopping here because exact review is already proven there.
  // This lane must wait for it.
  const prepared = await prepareVerification(p.principal.email, app, claim, resolution.plan, { reviewed: false });
  if ("error" in prepared) {
    await releaseOnFailure();
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: prepared.status, applicationId: app.id });
    return Response.json(
      { error: { code: prepared.error, message: prepared.message, request_id: rid } },
      { status: prepared.status, headers: { "X-Request-Id": rid } },
    );
  }

  // Nothing launched, so the idempotency key must not stay pending: the caller will resubmit with a
  // reviewed_plan_id, and that is a different request.
  await releaseOnFailure();

  const discoveryHash = createHash("sha256").update(JSON.stringify(s.pages ?? [])).digest("hex").slice(0, 32);
  const minted = await mintReviewedPlan({
      // A /v1 verification is a plain one: it runs on the API lane application, not against a standing
      // guarantee. Stated rather than omitted, so nobody later reads the absence as an oversight.
      guaranteeId: null,
    owner: p.principal.email, deploymentUrl, claim, plan: resolution.plan, discoveryHash,
    coverage: { claim_after: resolution.claimAfter, execution_after: resolution.executionAfter, ready: resolution.readyToLaunch },
    ttlMs: REVIEWED_PLAN_TTL_MS, nowMs: Date.now(),
  });

  await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 202, applicationId: prepared.applicationId });
  return Response.json({
    state: "review_required",
    claim,
    // What a person is being asked to approve, in the order plan_hash binds. Reviewing a decision you were
    // never shown is not reviewing it.
    requirements: prepared.requirements,
    human_reviewed: false,
    review_required: true,
    contract_id: prepared.contractId,
    contract_version: prepared.contractVersion,
    ...(minted ? { reviewed_plan_id: minted.id, reviewed_plan_expires_at: minted.expiresAt } : {}),
    message: minted
      ? "Vraelis built a plan that can prove this claim, and no person has reviewed it yet. Approve the reviewed plan, then resubmit with reviewed_plan_id to run exactly what was approved. Nothing was run and nothing was charged."
      : "Vraelis built a plan that can prove this claim, and no person has reviewed it yet. Approve the requirements on this contract before running it. Nothing was run and nothing was charged.",
  }, { status: 202, headers: { "X-Request-Id": rid } });
}


// Execute an APPROVED reviewed plan verbatim. The invariant this function protects: between here and the run,
// nothing is synthesized, corrected, recrawled, or substituted — production runs exactly the requirements and
// flows that were reviewed and approved. Every refusal returns before laneApplication, the contract write, the
// run, the hold, or the charge.
async function executeReviewedPlan(req: Request, rid: string, principal: Principal, deploymentUrl: string, claim: string, reviewedPlanId: string): Promise<Response> {
  const err = (code: string, status: number, message: string) =>
    Response.json({ error: { code, message, request_id: rid } }, { status, headers: { "X-Request-Id": rid } });

  const stored = await getReviewedPlan(principal.email, reviewedPlanId);
  if (!stored) {
    await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: 404 });
    return err("reviewed_plan_not_found", 404, "No reviewed plan with that id.");
  }

  // The full business gate (tenant, integrity, approval, expiry, consumption, deployment/claim drift,
  // credentials, coverage) as one pure, tested decision.
  const verdict = evaluateForExecution(stored, {
    owner: principal.email, deploymentUrl, claim, availableRoles: await laneRoles(principal.email), nowMs: Date.now(),
  });
  if (!verdict.ok) {
    await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: verdict.status });
    return err(verdict.code, verdict.status, verdict.message);
  }

  // Atomic reserve: exactly one execution flips an approved plan to consuming. A loser here raced with another
  // execution of the same handle.
  const claimed = await consumeReviewedPlan(principal.email, reviewedPlanId, Date.now());
  if (!claimed.ok) {
    await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: claimed.status });
    return err(claimed.code, claimed.status, claimed.message);
  }
  // Any failure from here must release the reservation so the SAME approved plan can be retried once the cause
  // is fixed (e.g. balance added), rather than being burned by a refusal that never launched.
  const release = () => releaseReviewedPlan(principal.email, reviewedPlanId, Date.now());

  const app = await laneApplication(principal.email, deploymentUrl);
  if ("error" in app) { await release(); return apiError("internal_error", app.message, app.status, rid); }

  // Write and launch the EXACT stored plan. prepareVerification takes a given plan and never synthesizes.
  //
  // The approval travels WITH the plan onto every requirement row: review_state approved, review_basis
  // reviewed_plan, and the reviewer's own identity and timestamp copied from the approval event. Authorship
  // is untouched by this — the rows stay source "inference", origin "prompt", because a person approving a
  // model's text does not make them its author. approveContract then refuses to freeze the contract unless
  // every enabled row carries exactly that basis and that approver, so an approval can never end up covering
  // rows the reviewer did not see.
  //
  // evaluateForExecution has already refused any plan whose content no longer hashes to its stored
  // plan_hash, so what is being written here is provably the artifact that was approved.
  const approval = stored.approved_by && stored.approved_at
    ? { reviewed: true as const, planId: stored.id, approvedBy: stored.approved_by, approvedAt: stored.approved_at }
    : null;
  if (!approval) {
    await release();
    await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: 409 });
    return err("reviewed_plan_approval_incomplete", 409, "That reviewed plan is marked approved but records no approver. It cannot be executed. Create and approve a new one.");
  }
  const prepared = await prepareVerification(principal.email, app, claim, stored.plan, approval);
  if ("error" in prepared) {
    await release();
    await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: prepared.status, applicationId: app.id });
    return err(prepared.error, prepared.status, prepared.message);
  }

  const forwarded = new Request(new URL(`/api/preflight/apps/${prepared.applicationId}/runs`, req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": req.headers.get("x-api-key") ?? "", "idempotency-key": `rvp:${reviewedPlanId}` },
    body: JSON.stringify({ deployment_url: deploymentUrl, flow_ids: prepared.flowIds }),
  });
  const launched = await launchRun(forwarded, { params: Promise.resolve({ id: prepared.applicationId }) });
  const result = await launched.json().catch(() => null) as { runId?: string; error?: string; message?: string } | null;

  if (!launched.ok || !result?.runId) {
    await release();
    return Response.json(
      { error: { code: result?.error ?? "internal_error", message: result?.message ?? "The verification could not be started.", request_id: rid } },
      { status: launched.status, headers: { "X-Request-Id": rid } },
    );
  }

  // Launched. Finalize consumption (once), so the plan can never run again.
  await markReviewedPlanRun(principal.email, reviewedPlanId, result.runId, Date.now());
  const verificationId = toVerificationId(result.runId);
  await logKeyUsage(principal, { endpoint: "POST /v1/verifications (reviewed)", status: 200, applicationId: prepared.applicationId, runId: result.runId });

  return Response.json({
    verification_id: verificationId,
    state: "running",
    status_url: `/v1/verifications/${verificationId}`,
    claim,
    requirements: prepared.requirements,
    reviewed_plan_id: reviewedPlanId,
    // This run executed a plan that was explicitly reviewed and approved.
    human_reviewed: true,
  }, { status: 202, headers: { "X-Request-Id": rid } });
}
