// PATCH /api/preflight/apps/[id] — edit an application's owner-editable settings (name, deployment
// target URL, environment, description). Session-authenticated and gated by the Preflight flag.
//
// Invariants:
//   - owner identity comes ONLY from the server session; the application must belong to that owner
//     (getApplication) before anything is read or written; client-supplied owner/app ids are never trusted
//   - app_url is validated with the SSRF string guard (https only, no private/loopback/malformed host)
//     inside updateApplication, so an unsafe target can never be stored
//   - a genuinely different deployment target (canonical compare) records a NEW deployment identity
//     (recordDeployment, source 'manual') and logs an "application_target_updated" event carrying the
//     application id and the safe old/new HOST only, never a full URL or any secret
//   - historical runs' deployment_url is NEVER rewritten: each run pinned its own deployment_id (S4), and
//     recordDeployment only ever INSERTs a new row (deduped when unchanged), so past evidence stands
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, updateApplication } from "@/lib/v-applications";
import { recordDeployment } from "@/lib/preflight/deployments-db";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

// Safe host for the audit event: never the full URL (may carry a token in the query), never a throw.
function safeHost(url: string): string {
  try { return new URL(url).host.slice(0, 120); } catch { return ""; }
}

// Editing application settings is an EDITOR+ action. Resolve the caller to the app OWNER (the data-plane key)
// + role via the workspace resolver: the owner or an active member passes the 404 gate; a view-only member is
// forbidden (they already know the app exists); a non-member 404s. `owner` is the app owner from here, so the
// update writes into the owner's data plane regardless of which teammate made the edit.
async function gate(params: Promise<{ id: string }>): Promise<{ owner: string; appId: string } | NextResponse> {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!(await preflightDbReady())) return NextResponse.json({ error: "setup_required" }, { status: 503 });
  const { id } = await params;
  const access = await applicationAccess(email, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application." }, { status: 403 });
  return { owner: access.owner, appId: id };
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));

  const patch: { name?: string; app_url?: string; environment?: string | null; description?: string } = {};
  if (typeof body?.name === "string") patch.name = body.name;
  if (typeof body?.app_url === "string") patch.app_url = body.app_url;
  else if (typeof body?.appUrl === "string") patch.app_url = body.appUrl;
  if (typeof body?.environment === "string" || body?.environment === null) patch.environment = body.environment;
  if (typeof body?.description === "string") patch.description = body.description;

  const r = await updateApplication(g.owner, g.appId, patch);
  if (!r.ok) {
    const status = r.error === "unavailable" ? 503 : r.error === "not_found" ? 404 : 400;
    const messages: Record<string, string> = {
      invalid_url: "Enter a public https URL for the deployed app.",
      name_required: "Enter an application name.",
      url_required: "Enter the deployment target URL.",
      invalid_environment: "Environment must be preview, staging, or production.",
    };
    return NextResponse.json({ error: r.error, message: messages[r.error] }, { status });
  }

  // Deployment identity on a genuine target change (migration 8): record a NEW deployment so the newest
  // identity differs from the health run's tested one, which makes the overview's "New deployment
  // unverified" banner (S4 unverifiedNewerDeployment) fire on its own. Best-effort per the migration rule:
  // recordDeployment never throws, so a failed record never fails the settings save. Unchanged URL never
  // records (updateApplication reports targetChanged:false), and recordDeployment itself dedupes anyway.
  const appEnvironment = (r.application as unknown as { environment?: string | null }).environment ?? null;
  let targetChanged = false;
  if (r.updated && r.targetChanged) {
    targetChanged = true;
    await recordDeployment(g.owner, g.appId, {
      url: r.newUrl,
      environment: appEnvironment,
      source: "manual",
    });
    // Audit event: application id + safe old/new HOST only. logEvent additionally strips any risky key.
    await logEvent({
      userId: g.owner, eventType: "application_target_updated", actorType: "owner", source: "preflight",
      route: "/api/preflight/apps/[id]",
      metadata: { application_id: g.appId, old_host: safeHost(r.oldUrl), new_host: safeHost(r.newUrl) },
    });
  }

  // Return only the safe, updated fields the client renders.
  return NextResponse.json({
    ok: true,
    updated: r.updated,
    targetChanged,
    application: {
      id: r.application.id,
      name: r.application.name,
      app_url: r.application.app_url,
      environment: appEnvironment,
    },
  });
}
