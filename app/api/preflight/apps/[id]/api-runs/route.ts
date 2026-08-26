// API-beta customer route: LAUNCH an API verification run (synchronous inline execution).
// POST { flowIds:[...], rerun?:bool, idempotencyKey?:string }
//   -> { runId, decision, state }   (executed inline; terminal-state; never queued)
//
// Order (blockers BEFORE billing, exactly like the web route's discipline):
//   gate(404) -> kill switch(503) -> cost governor(503) -> ownership(404) -> load target/build/flows/creds
//   -> READINESS blockers(400: no target/base URL/flows/credential/unsupported action) -> idempotency replay
//   -> PRICE (authoritative) -> HOLD -> resolve secrets + EXECUTE inline -> SETTLE (charge or refund) -> return.
// A missing/revoked credential or an unsupported action is caught in the readiness check, BEFORE any hold.

import { NextResponse } from "next/server";
import { envInt } from "@/lib/env-num";
import { gateApiRuntimeApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { runsDisabled } from "@/lib/v-preflight-flags";
import { isRunsGovernorPaused } from "@/lib/preflight/cost-governor";
import { getApiTarget, getLatestApiBuild, listApiFlows } from "@/lib/preflight/runtime/targets-db";
import { listConnections, openApiCredential } from "@/lib/preflight/connections-db";
import { computeReadiness } from "@/lib/preflight/runtime/api-readiness";
import { priceApiLaunch, takeApiHold } from "@/lib/preflight/runtime/api-beta-billing";
import { executeApiRun, type ApiCustomerFlow, type SecretResolver } from "@/lib/preflight/runtime/api-executor";
import { makeApiRunStore, claimApiRun, finalizeApiRun } from "@/lib/preflight/runtime/api-run-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordProviderCost } from "@/lib/preflight/cost-governor";
import { safeFetch, isBlockedFetchError } from "@/lib/safe-fetch";
import type { ApiFetch } from "@/lib/preflight/runtime/api-adapter";
import type { ApiFlowStep } from "@/lib/preflight/runtime/api-steps";

export const runtime = "nodejs";
export const maxDuration = 120;

// Bounds for the customer-endpoint fetcher below. The host on the other end is customer-supplied, so it
// decides how long to hold a socket open and how much to send. Env-overridable so a slow-but-legitimate
// integration can be accommodated without a deploy.
const API_FETCH_TIMEOUT_MS = envInt("API_FETCH_TIMEOUT_MS", { min: 1_000, max: 60_000, fallback: 15_000 });
const API_FETCH_MAX_BYTES = envInt("API_FETCH_MAX_BYTES", { min: 64 * 1024, max: 32 * 1024 * 1024, fallback: 2_000_000 });

/** Thrown when a response exceeds the byte cap. A distinct type so callers cannot mistake it for content. */
export class ResponseTooLargeError extends Error {
  readonly transportKind = "response_too_large";
  constructor(max: number) {
    super(`response exceeded ${max} bytes`);
    this.name = "ResponseTooLargeError";
  }
}

// Read a response body up to `max` bytes, cancelling the stream at the limit rather than buffering the
// whole thing first — res.text() would materialise whatever arrives before any cap could apply.
//
// THROWS at the limit; it does NOT return what it managed to read. Returning a truncated body would hand
// the step executor a prefix of a JSON document that it would then parse, assert against, and report on as
// though it were the complete response. A run that silently grades half an answer is worse than a run that
// fails: the failure is visible, the wrong verdict is not.
async function readCapped(res: Response, max: number): Promise<string> {
  const body = res.body;
  if (!body) return "";
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => {});
        throw new ResponseTooLargeError(max);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Launching an API run is EDITOR+. Resolves the app OWNER (billing/data key) + caller role; both caller and
  // owner must have API-runtime access. owner = app owner, so an editor's run charges the OWNER (owner-anchored
  // billing) exactly like the web launch route.
  const g = await gateApiRuntimeApp(id, "editor");
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;
  if (runsDisabled()) return NextResponse.json({ error: "runs_paused", message: "New runs are temporarily paused. Existing reports remain available." }, { status: 503 });
  if (await isRunsGovernorPaused()) return NextResponse.json({ error: "runs_paused", message: "New runs are temporarily paused. Existing reports remain available." }, { status: 503 });

  let body: { flowIds?: unknown; rerun?: boolean; idempotencyKey?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }
  const selectedFlowIds = Array.isArray(body.flowIds) ? body.flowIds.filter((x): x is string => typeof x === "string") : [];
  const rerun = body.rerun === true;

  const target = await getApiTarget(owner, id);
  const build = target ? await getLatestApiBuild(owner, target.id) : null;
  const flows = target ? await listApiFlows(owner, id, target.id) : [];
  const credConns = (await listConnections(owner, id)).filter((c) => c.provider === "api_credential");
  const credentialLabels = credConns.map((c) => String((c.meta as { label?: string })?.label ?? "")).filter(Boolean);

  // READINESS — every hard blocker refuses BEFORE billing.
  const readiness = computeReadiness({
    hasTarget: !!target, baseUrl: build?.base_url ?? null, environment: target?.environment ?? null,
    buildVersion: build?.version ?? null,
    flows: flows.map((f) => ({ id: f.id, name: f.name, priority: f.priority, enabled: f.enabled, steps: f.steps })),
    selectedFlowIds, credentialLabels,
  });
  if (!readiness.launchable) {
    return NextResponse.json({ error: "not_ready", blockers: readiness.reasons }, { status: 400 });
  }

  // ATOMIC double-launch guard: CLAIM the run (insert keyed by submission_id) BEFORE any billing. The unique
  // (user_id, submission_id) constraint makes a concurrent/replayed launch's claim fail, so only ONE proceeds
  // to hold + execute. A losing claim returns the existing run — no second hold, no second execution.
  const idem = (body.idempotencyKey || "").trim() || `${rerun ? "rerun" : "run"}:${[...selectedFlowIds].sort().join(",")}`;
  const submissionId = `api:${target!.id}:${idem}`;
  const sb = getSupabaseAdminClient();
  const price = await priceApiLaunch(owner, readiness.selectedCount, { rerun });
  // We compute the price first (to know the hold amount to record on the claim), but the CLAIM is what
  // serializes concurrent launches — the hold is taken only after we win the claim.
  const claimAmount = price.mode === "payg" ? price.cents : price.mode === "legacy" ? price.credits : 0;
  let claim: { runId: string } | { existingRunId: string };
  try { claim = await claimApiRun(sb, { owner, appId: id, targetId: target!.id, deploymentUrl: build!.base_url!, submissionId, creditsHeld: claimAmount }); }
  catch { return NextResponse.json({ error: "unavailable", message: "Could not start the run. Try again." }, { status: 503 }); }
  if ("existingRunId" in claim) return NextResponse.json({ runId: claim.existingRunId, replayed: true }, { status: 200 });
  const claimedRunId = claim.runId;

  // PRE-OPEN every referenced credential BEFORE billing. A revoked credential still has its LABEL on a flow
  // (readiness only checks the label), but its sealed value can no longer be opened — so we verify each one
  // actually opens here, and refuse (finalize the claim, NO hold taken) if any can't. This is the "revoked
  // credential blocks BEFORE billing" guarantee: no hold is placed for a run that can't authenticate.
  const opened = new Map<string, { secretRef: string; scheme: "bearer" | "api_key" | "basic"; headerName?: string; value: string } | null>();
  const resolveSecret: SecretResolver = (label) => opened.get(label.trim().toLowerCase()) ?? null;
  const selected = flows.filter((f) => selectedFlowIds.includes(f.id) && f.enabled);
  const referenced = new Set<string>();
  for (const f of selected) for (const s of f.steps as ApiFlowStep[]) if (s.action === "sign_in" && s.credentialLabel) referenced.add(s.credentialLabel);
  for (const labelRaw of referenced) {
    const label = labelRaw.trim().toLowerCase();
    const conn = credConns.find((c) => String((c.meta as { label?: string })?.label ?? "").trim().toLowerCase() === label);
    const cred = conn ? await openApiCredential(owner, id, conn.id) : null;
    if (!cred) {
      await finalizeApiRun(sb, claimedRunId, { state: "failed", decision: null, summary: { aborted: "credential_unavailable" } });
      return NextResponse.json({ error: "credential_unavailable", message: "A saved credential this run needs is no longer available. Re-add it and try again." }, { status: 400 });
    }
    opened.set(label, { secretRef: conn!.id, scheme: cred.scheme, headerName: cred.headerName, value: cred.secret });
  }

  // HOLD (claim won, credentials all open). On a hold failure, finalize the claim so a retry works.
  const held = await takeApiHold(owner, price);
  if (!held.ok) {
    await finalizeApiRun(sb, claimedRunId, { state: "failed", decision: null, summary: { aborted: "insufficient_balance" } });
    return NextResponse.json({ error: held.error, message: held.message }, { status: held.status });
  }

  // SSRF-safe fetcher (identical wrapper to the founder canary route).
  const fetcher: ApiFetch = async (url, init) => {
    // BOUNDED. The host on the other end is customer-supplied, so it decides how long to hold the socket
    // open and how much to send. Without a timeout a slow or hostile endpoint pins a serverless invocation
    // until the platform kills it, and without a size cap res.text() materialises whatever arrives — the
    // redirect: "manual" below was the only limit of any kind.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), API_FETCH_TIMEOUT_MS);
    try {
      const res = await safeFetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        redirect: "manual",
        signal: ctl.signal,
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, headers, text: await readCapped(res, API_FETCH_MAX_BYTES) };
    } catch (e) {
      // An over-cap response already carries its own transportKind and must keep it: it is a distinct
      // outcome from "unreachable", and mislabelling it would hide why the run failed.
      if (!(e instanceof ResponseTooLargeError)) {
        (e as { transportKind?: string }).transportKind = isBlockedFetchError(e) ? "blocked" : "unreachable";
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  const customerFlows: ApiCustomerFlow[] = selected.map((f) => ({ id: f.id, name: f.name, critical: f.priority === "critical", steps: f.steps as ApiFlowStep[] }));
  // Full coverage = the selected set is the COMPLETE set of enabled critical flows. A targeted rerun (fewer)
  // -> partial -> can never mint READY (repair_verified instead). Computed, never a client flag.
  const allCriticalIds = new Set(flows.filter((f) => f.enabled && f.priority === "critical").map((f) => f.id));
  const selectedCriticalIds = new Set(customerFlows.filter((f) => f.critical).map((f) => f.id));
  const fullCoverage = !rerun && [...allCriticalIds].every((cid) => selectedCriticalIds.has(cid));

  try {
    const result = await executeApiRun({
      owner, appId: id, targetId: target!.id, buildId: build!.id, baseUrl: build!.base_url!,
      flows: customerFlows, fullCoverage, creditsHeld: held.hold.creditsHeld, submissionId,
      preClaimedRunId: claimedRunId,
      fetcher, resolveSecret, store: makeApiRunStore(sb, recordProviderCost), clock: () => Date.now(),
    });
    // SETTLE exactly once: productive work keeps the hold (charge); otherwise refund.
    await held.hold.settle(result.chargedFullHold);
    return NextResponse.json({ runId: result.runId, decision: result.decision, state: result.state });
  } catch {
    // The error is deliberately not bound: nothing here logs it, and it must never reach the caller —
    // an execution error can carry the target URL and fragments of its response.
    // Any execution/persist error: release the hold (never strand escrow) and fail sanitized.
    await held.hold.release();
    return NextResponse.json({ error: "run_failed", message: "Could not complete the run. Please try again." }, { status: 500 });
  }
}
