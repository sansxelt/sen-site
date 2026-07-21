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
import { laneApplication, synthesizeClaim, prepareVerification } from "@/lib/preflight/verification-lane";
import { runIdentity } from "@/lib/preflight/runs-db";
import { getContractById } from "@/lib/v-applications";
import { apiError, requestId } from "../_lib";
import { toVerificationId, canonicalClaim } from "./_shared";

export const runtime = "nodejs";
export const maxDuration = 300; // crawl + synthesis before the launch; well inside the worker's own budget

const MAX_CLAIM = 2000;

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

  const app = await laneApplication(p.principal.email, deploymentUrl);
  if ("error" in app) return apiError("internal_error", app.message, app.status, rid);

  const synth = await synthesizeClaim(deploymentUrl, claim);
  if ("error" in synth) {
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications", status: synth.status, applicationId: app.id });
    return Response.json(
      { error: { code: synth.error, message: synth.message, request_id: rid } },
      { status: synth.status, headers: { "X-Request-Id": rid } },
    );
  }

  const prepared = await prepareVerification(p.principal.email, app, claim, synth);
  if ("error" in prepared) {
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
    return Response.json(
      { error: { code: result?.error ?? "internal_error", message: result?.message ?? "The verification could not be started.", request_id: rid } },
      { status: launched.status, headers: { "X-Request-Id": rid } },
    );
  }

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
