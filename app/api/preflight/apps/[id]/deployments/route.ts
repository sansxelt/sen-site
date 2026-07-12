// Deployment identity for an application (v_deployments, V1.1 workstream S4).
//
//   GET   -> { deployments: Deployment[] }   recorded deployments, newest first
//   POST  { url, commit_sha?, branch?, environment? }   record a manual deployment (source 'manual')
//
// Invariants:
//   - owner identity comes ONLY from the server session; the application must belong to that owner
//     (getApplication) before anything is read or written; client-supplied ids are never trusted
//   - POST is idempotent: recordDeployment dedupes onto the newest row when the identity
//     (canonical URL + commit) is unchanged, so a double-click never inflates history
//   - migration 8 unapplied fails CLEARLY: a 503 naming sql/vraelis-preflight-8-deployments.sql,
//     never a fake success
//   - provider_deployment_id is never accepted from this route (webhooks stamp it later)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication } from "@/lib/v-applications";
import { listDeployments, recordDeployment, deploymentStoreReady } from "@/lib/preflight/deployments-db";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

async function gate(params: Promise<{ id: string }>): Promise<{ owner: string; appId: string } | NextResponse> {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!(await preflightDbReady())) return NextResponse.json({ error: "setup_required" }, { status: 503 });
  const { id } = await params;
  const app = await getApplication(email.toLowerCase(), id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { owner: email.toLowerCase(), appId: id };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params);
  if (g instanceof NextResponse) return g;
  const deployments = await listDeployments(g.owner, g.appId);
  return NextResponse.json({ deployments });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));

  const url = typeof body?.url === "string" ? body.url.trim().slice(0, 2000) : "";
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch { parsed = null; }
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    return NextResponse.json({ error: "invalid_url", message: "Enter the full deployment URL, starting with https://." }, { status: 400 });
  }

  const commit = typeof body?.commit_sha === "string" ? body.commit_sha.trim().toLowerCase() : "";
  if (commit && !/^[0-9a-f]{7,40}$/.test(commit)) {
    return NextResponse.json({ error: "invalid_commit", message: "A commit is 7 to 40 hex characters." }, { status: 400 });
  }
  const branch = typeof body?.branch === "string" ? body.branch.trim().slice(0, 120) : "";
  const envRaw = typeof body?.environment === "string" ? body.environment.trim().toLowerCase() : "";
  const environment = envRaw === "preview" || envRaw === "staging" || envRaw === "production" ? envRaw : null;

  const r = await recordDeployment(g.owner, g.appId, {
    url, commit_sha: commit || null, branch: branch || null, environment, source: "manual",
  });
  if (!r) {
    // Distinguish the unapplied migration (actionable, named) from a transient failure. Fail clear.
    if (!(await deploymentStoreReady(g.owner))) {
      return NextResponse.json({
        error: "migration_required",
        message: "Deployment identity is not active yet: apply sql/vraelis-preflight-8-deployments.sql (migration 8).",
      }, { status: 503 });
    }
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!r.existing) {
    // Audit event carries the application id and source only, never the deployment metadata values.
    await logEvent({ userId: g.owner, eventType: "deployment_recorded", actorType: "owner", source: "preflight", route: "/api/preflight/apps/[id]/deployments", metadata: { application_id: g.appId, source: "manual" } });
  }
  return NextResponse.json({ id: r.deployment.id, existing: r.existing === true });
}
