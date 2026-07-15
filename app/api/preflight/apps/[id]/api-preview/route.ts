// API-beta customer route: preview a launch BEFORE billing.
// GET ?flowIds=a,b,c[&rerun=1] -> { target, build, environment, selectedFlows, capabilities, readiness, price }
// The price comes from the SAME priceApiLaunch the launch route uses (parity). Readiness lists the exact
// blockers that would refuse the launch (target/base URL/flows/credentials/unsupported action). Uniform 404.

import { NextResponse } from "next/server";
import { gateApiRuntimeApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { getApiTarget, getLatestApiBuild, listApiFlows } from "@/lib/preflight/runtime/targets-db";
import { listConnections } from "@/lib/preflight/connections-db";
import { computeReadiness } from "@/lib/preflight/runtime/api-readiness";
import { priceApiLaunch } from "@/lib/preflight/runtime/api-beta-billing";
import { API_ACTION_LABELS } from "@/lib/preflight/runtime/api-steps";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "viewer"); // previewing (reading price/readiness) is viewer+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  const url = new URL(req.url);
  const selectedFlowIds = (url.searchParams.get("flowIds") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const rerun = url.searchParams.get("rerun") === "1";

  const target = await getApiTarget(owner, id);
  const build = target ? await getLatestApiBuild(owner, target.id) : null;
  const flows = target ? await listApiFlows(owner, id, target.id) : [];
  const credentialLabels = (await listConnections(owner, id)).filter((c) => c.provider === "api_credential").map((c) => String((c.meta as { label?: string })?.label ?? "")).filter(Boolean);

  const readiness = computeReadiness({
    hasTarget: !!target, baseUrl: build?.base_url ?? null, environment: target?.environment ?? null,
    buildVersion: build?.version ?? null,
    flows: flows.map((f) => ({ id: f.id, name: f.name, priority: f.priority, enabled: f.enabled, steps: f.steps })),
    selectedFlowIds, credentialLabels,
  });

  // Price only when there's something to price (a selected, launchable-ish count). Preview always calls the
  // authoritative gate so the shown price === the charge; when nothing is selected, show a zero/neutral price.
  const price = readiness.selectedCount > 0 ? await priceApiLaunch(owner, readiness.selectedCount, { rerun }) : null;

  return NextResponse.json({
    target: target ? { id: target.id, label: target.label, environment: target.environment } : null,
    build: build ? { baseUrl: build.base_url, version: build.version } : null,
    environment: target?.environment ?? null,
    selectedFlows: flows.filter((f) => selectedFlowIds.includes(f.id)).map((f) => ({ id: f.id, name: f.name, priority: f.priority, enabled: f.enabled, stepCount: (f.steps as unknown[]).length })),
    capabilities: Object.values(API_ACTION_LABELS),   // the supported customer actions (plain labels)
    readiness: { launchable: readiness.launchable, blockers: readiness.reasons, selectedCount: readiness.selectedCount },
    price,
  });
}
