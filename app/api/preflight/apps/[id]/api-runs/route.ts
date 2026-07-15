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
import { randomUUID } from "node:crypto";
import { apiBetaOwner } from "@/lib/preflight/api-beta-gate";
import { runsDisabled } from "@/lib/v-preflight-flags";
import { isRunsGovernorPaused } from "@/lib/preflight/cost-governor";
import { getApplication } from "@/lib/v-applications";
import { getApiTarget, getLatestApiBuild, listApiFlows, findRunBySubmission } from "@/lib/preflight/runtime/targets-db";
import { listConnections, openApiCredential } from "@/lib/preflight/connections-db";
import { computeReadiness } from "@/lib/preflight/runtime/api-readiness";
import { priceApiLaunch, takeApiHold } from "@/lib/preflight/runtime/api-beta-billing";
import { executeApiRun, type ApiCustomerFlow, type SecretResolver } from "@/lib/preflight/runtime/api-executor";
import { makeApiRunStore } from "@/lib/preflight/runtime/api-run-store";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordProviderCost } from "@/lib/preflight/cost-governor";
import { safeFetch, isBlockedFetchError } from "@/lib/safe-fetch";
import type { ApiFetch } from "@/lib/preflight/runtime/api-adapter";
import type { ApiFlowStep } from "@/lib/preflight/runtime/api-steps";

export const runtime = "nodejs";
export const maxDuration = 120;
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await apiBetaOwner();
  if (!owner) return notFound();
  if (runsDisabled()) return NextResponse.json({ error: "runs_paused", message: "New runs are temporarily paused. Existing reports remain available." }, { status: 503 });
  if (await isRunsGovernorPaused()) return NextResponse.json({ error: "runs_paused", message: "New runs are temporarily paused. Existing reports remain available." }, { status: 503 });

  const { id } = await params;
  if (!(await getApplication(owner, id))) return notFound();

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

  // Idempotency: a stable submission id per (idempotencyKey|flow set). A replay returns the existing run,
  // never a second execution or a second hold (double-click protection).
  const idem = (body.idempotencyKey || "").trim() || `${rerun ? "rerun" : "run"}:${[...selectedFlowIds].sort().join(",")}`;
  const submissionId = `api:${target!.id}:${idem}`;
  const existing = await findRunBySubmission(owner, submissionId);
  if (existing) return NextResponse.json({ runId: existing, replayed: true }, { status: 200 });

  // PRICE (authoritative — same call the preview uses) then HOLD.
  const price = await priceApiLaunch(owner, readiness.selectedCount, { rerun });
  const held = await takeApiHold(owner, price);
  if (!held.ok) return NextResponse.json({ error: held.error, message: held.message }, { status: held.status });

  // Secret resolver: opens the vault credential by LABEL, server-side, at execution time. The value goes
  // ONLY into the adapter's in-memory map. Cache openings per label so a repeated sign_in doesn't re-open.
  const opened = new Map<string, { secretRef: string; scheme: "bearer" | "api_key" | "basic"; headerName?: string; value: string } | null>();
  const resolveSecret: SecretResolver = (label) => {
    // Synchronous resolver over a pre-opened map (filled just below before execution).
    return opened.get(label.trim().toLowerCase()) ?? null;
  };
  // Pre-open every credential a selected flow references (executor's resolver is sync).
  const selected = flows.filter((f) => selectedFlowIds.includes(f.id) && f.enabled);
  const referenced = new Set<string>();
  for (const f of selected) for (const s of f.steps as ApiFlowStep[]) if (s.action === "sign_in" && s.credentialLabel) referenced.add(s.credentialLabel);
  for (const label of referenced) {
    const conn = credConns.find((c) => String((c.meta as { label?: string })?.label ?? "").trim().toLowerCase() === label.trim().toLowerCase());
    if (!conn) { opened.set(label.trim().toLowerCase(), null); continue; }
    const cred = await openApiCredential(owner, id, conn.id);
    opened.set(label.trim().toLowerCase(), cred ? { secretRef: conn.id, scheme: cred.scheme, headerName: cred.headerName, value: cred.secret } : null);
  }

  // SSRF-safe fetcher (identical wrapper to the founder canary route).
  const fetcher: ApiFetch = async (url, init) => {
    try {
      const res = await safeFetch(url, { method: init.method, headers: init.headers, body: init.body, redirect: "manual" });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return { status: res.status, headers, text: await res.text() };
    } catch (e) {
      (e as { transportKind?: string }).transportKind = isBlockedFetchError(e) ? "blocked" : "unreachable";
      throw e;
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
      fetcher, resolveSecret, store: makeApiRunStore(getSupabaseAdminClient(), recordProviderCost), clock: () => Date.now(),
    });
    // SETTLE exactly once: productive work keeps the hold (charge); otherwise refund.
    await held.hold.settle(result.chargedFullHold);
    return NextResponse.json({ runId: result.runId, decision: result.decision, state: result.state });
  } catch (e) {
    // Any execution/persist error: release the hold (never strand escrow) and fail sanitized.
    await held.hold.release();
    return NextResponse.json({ error: "run_failed", message: "Could not complete the run. Please try again." }, { status: 500 });
  }
}
