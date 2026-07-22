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
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { laneApplication, synthesizeClaim, prepareVerification, laneRoles } from "@/lib/preflight/verification-lane";
import { repairPrompt } from "@/lib/preflight/coverage";
import { resolveCoverage, resolutionGaps, type CoverageResolution } from "@/lib/preflight/coverage-resolve";
import { runIdentity } from "@/lib/preflight/runs-db";
import { getContractById, listRequirements } from "@/lib/v-applications";
import { reserve, markLaunched, markFailed, verificationFingerprint } from "@/lib/preflight/verification-idempotency";
import { apiError, requestId } from "../_lib";
import { toVerificationId, canonicalClaim } from "./_shared";

export const runtime = "nodejs";
export const maxDuration = 300; // crawl + synthesis + at most two bounded corrections; inside the worker budget

const MAX_CLAIM = 2000;

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
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications (dry_run)", status: 200 });
    return Response.json({
      dry_run: true,
      claim,
      ...coverageTelemetry(claim, resolution, diagnostic),
      human_reviewed: false,
    }, { status: 200, headers: { "X-Request-Id": rid } });
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

  // Both gates pass. Write and launch the RESOLVED plan (the corrected one when correction ran), so the run
  // executes exactly what the gate judged sufficient.
  const prepared = await prepareVerification(p.principal.email, app, claim, resolution.plan);
  if ("error" in prepared) {
    await releaseOnFailure();
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: prepared.status, applicationId: app.id });
    return Response.json(
      { error: { code: prepared.error, message: prepared.message, request_id: rid } },
      { status: prepared.status, headers: { "X-Request-Id": rid } },
    );
  }

  // DELEGATE. The forwarded request carries the caller's own key, so the runs route resolves the SAME
  // principal, enforces the SAME scope, and applies the SAME per-key ceiling. Nothing is elevated in
  // transit: this route cannot grant a permission the caller did not already have.
  //
  // The idempotency key is forwarded when the caller sent one, so retrying a verification is a retry of the
  // underlying run rather than a second charge. When they did not, the claim itself keys it, which makes
  // "verify this same claim against this same build twice" idempotent for free.
  const idem = req.headers.get("idempotency-key") || `vrf:${prepared.contractId}`;
  const forwarded = new Request(new URL(`/api/preflight/apps/${prepared.applicationId}/runs`, req.url), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": req.headers.get("x-api-key") ?? "",
      "idempotency-key": idem,
    },
    body: JSON.stringify({ deployment_url: deploymentUrl, flow_ids: prepared.flowIds }),
  });
  const launched = await launchRun(forwarded, { params: Promise.resolve({ id: prepared.applicationId }) });
  const result = await launched.json().catch(() => null) as { runId?: string; error?: string; message?: string } | null;

  // IDEMPOTENCY RECONCILIATION. /v1 must respect the launch VERDICT, not merely whether a runId came back.
  //
  // The runs route dedupes on an idempotency key bound to the payload, and a 409 conflict still carries the
  // conflicting runId. An earlier version checked only `result.runId` and so treated that 409 as success:
  // a caller who reused a key with a CHANGED claim got a 202 with the FIRST verification's id and believed
  // their new claim was running. That is precisely the confident-wrong-answer this product exists to catch,
  // reintroduced at the seam. Found by the first real production run.
  //
  // The runs route cannot tell an identical retry from a changed request on this path, because the
  // verification lane mints fresh flow ids per call, so the payload fingerprint never repeats and EVERY
  // reuse looks like a changed payload. /v1 can tell, because it holds the caller's inputs: compare the
  // claim (and URL) the conflicting run actually tested.
  if (launched.status === 409 && result?.runId) {
    const idn = await runIdentity(p.principal.email, result.runId);
    const priorClaim = idn?.contractId ? (await getContractById(p.principal.email, idn.contractId))?.source_prompt : null;
    const sameRequest = !!idn
      && canonicalClaim(priorClaim) === canonicalClaim(claim)
      && idn.deploymentUrl === deploymentUrl;
    if (sameRequest) {
      // A genuine retry: same key, same claim, same deployment. Return the ORIGINAL verification rather than
      // starting or charging a second one. This is the double-click / lost-response case working correctly.
      await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 200, applicationId: prepared.applicationId, runId: result.runId });
      return Response.json({
        verification_id: toVerificationId(result.runId),
        state: "running",
        status_url: `/v1/verifications/${toVerificationId(result.runId)}`,
        claim,
        requirements: prepared.requirements,
        human_reviewed: false,
      }, { status: 200, headers: { "X-Request-Id": rid } });
    }
    // Same key, DIFFERENT request. Refuse loudly rather than answering with the earlier run.
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: 409, applicationId: prepared.applicationId });
    return Response.json(
      { error: { code: "idempotency_key_reused", message: "That idempotency key was already used for a different verification. Use a new key, or resend the original request exactly.", request_id: rid } },
      { status: 409, headers: { "X-Request-Id": rid } },
    );
  }

  // Every other refusal (paused, over a cap, over the key ceiling, out of balance) is passed through with
  // its own status and message rather than flattened. An agent branching on key_daily_ceiling must still
  // see key_daily_ceiling.
  if (!launched.ok || !result?.runId) {
    // The launch was refused after we owned the reservation. Release it so the key is reclaimable rather than
    // stuck pending: the caller can fix the cause (add balance, wait out a pause) and retry the same key.
    await releaseOnFailure();
    return Response.json(
      { error: { code: result?.error ?? "internal_error", message: result?.message ?? "The verification could not be started.", request_id: rid } },
      { status: launched.status, headers: { "X-Request-Id": rid } },
    );
  }

  // Launched. Record the run on the reservation so an identical retry replays it without doing any work.
  if (ownsReservation && idemKey) await markLaunched(p.principal.email, idemKey, result.runId);

  const verificationId = toVerificationId(result.runId);
  await logKeyUsage(p.principal, {
    endpoint: "POST /v1/verifications", status: 200,
    applicationId: prepared.applicationId, runId: result.runId,
  });

  return Response.json({
    verification_id: verificationId,
    state: "running",
    status_url: `/v1/verifications/${verificationId}`,
    claim,
    // ALWAYS returned. A misread claim producing a confident wrong verdict is this endpoint's main failure
    // mode, and the caller cannot detect it from a decision alone. These are what Vraelis is about to check.
    requirements: prepared.requirements,
    // No human approved this contract. Said plainly, on every response, rather than buried in documentation.
    human_reviewed: false,
  }, { status: 202, headers: { "X-Request-Id": rid } });
}
