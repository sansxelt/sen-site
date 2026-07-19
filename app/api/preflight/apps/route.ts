// POST /api/preflight/apps  — connect an application (create + seed a draft Production Contract).
// DELETE /api/preflight/apps?id=... — remove a connected application (owner-scoped).
// Session-authenticated; gated by the Preflight flag. Phase 1 does NO discovery or browser execution —
// it only records the app + the "I own/authorized this app" attestation. The URL is validated cheaply
// here (https, not a private/loopback host) reusing the existing SSRF string guard; deep validation +
// DNS pinning happen later, before any navigation.

import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { createApplication, deleteApplication } from "@/lib/v-applications";
import { createDiscovery, getActiveDiscovery } from "@/lib/preflight/discovery-db";
import { runDiscovery } from "@/lib/preflight/discover-run";
import { addConnection, applySetupExtras, normalizeBoundaries, normalizeContextSources, CONNECTION_KINDS } from "@/lib/preflight/connections-db";
import { snapshotIfChanged } from "@/lib/preflight/context-snapshots";
import { passPricingEnabled } from "@/lib/preflight/pass-pricing";
import { applicationCapReached, getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { applicationAccess } from "@/lib/preflight/team-access";
import { getOrCreatePersonalWorkspace, hasAtLeastRole } from "@/lib/v-workspace";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";
  const appUrl = typeof body?.app_url === "string" ? body.app_url : (typeof body?.appUrl === "string" ? body.appUrl : "");
  const builder = typeof body?.builder === "string" ? body.builder : undefined;
  const sourcePrompt = typeof body?.source_prompt === "string" ? body.source_prompt : (typeof body?.sourcePrompt === "string" ? body.sourcePrompt : undefined);
  const ownershipConfirmed = body?.ownership_confirmed === true || body?.ownershipConfirmed === true;

  if (!ownershipConfirmed) return NextResponse.json({ error: "ownership_required", message: "Confirm you own or are authorized to test this app." }, { status: 400 });
  // Cheap pre-store URL guard (https, no private/loopback host). The browser layer re-validates + DNS-pins
  // before any navigation (see the audit's security-boundary plan).
  const reason = unsafeHttpsUrlReason(appUrl.trim());
  if (reason) return NextResponse.json({ error: "invalid_url", message: "Enter a public https URL for the deployed app." }, { status: 400 });

  if (passPricingEnabled()) {
    // Application cap (docs/pricing-verdict-final.md): free tier 1 app; builder_v1 2; pro_v1 10;
    // scale_v1 uncapped. Enforced ONLY under VRAELIS_PASS_PRICING — with the flag off, creation is
    // uncapped exactly as today.
    const owner = email.toLowerCase();
    const plan = await getPlanV1State(owner);
    if (await applicationCapReached(owner, plan?.plan ?? null)) {
      return NextResponse.json({ error: "application_limit", message: "Your plan's connected-application limit is reached. Remove an application or upgrade to connect more." }, { status: 403 });
    }
  }

  // Attach the new app to the creator's personal workspace so team sharing works immediately (migration 14
  // only backfills EXISTING apps). Best-effort: getOrCreatePersonalWorkspace returns null pre-migration or on
  // a transient blip, in which case workspace_id stays null and the app is owner-only (today's behavior) until
  // the founder runs migration 14, which backfills it. The creator is always the owner regardless.
  const personalWs = await getOrCreatePersonalWorkspace(email);
  const r = await createApplication(email, { name, appUrl, builder, sourcePrompt, ownershipConfirmed: true, workspaceId: personalWs?.id ?? null });
  if (!r.ok) {
    const status = r.error === "unavailable" ? 503 : 400;
    return NextResponse.json({ error: r.error }, { status });
  }

  // Production-context extras from the onboarding workspace, ALL non-secret and all best-effort: the
  // application above is already created and usable with URL-only context, so a failed extra never fails
  // the connect. Secrets (test accounts) NEVER ride this payload — they go to the dedicated sealed route.
  const appId = r.application.id;
  await applySetupExtras(email, appId, {
    environment: typeof body?.environment === "string" ? body.environment : null,
    context: normalizeContextSources(body?.context_sources),
    boundaries: normalizeBoundaries(body?.test_boundaries),
  });
  const rawConnections: unknown = Array.isArray(body?.connections) ? body.connections : [];
  for (const c of (rawConnections as Record<string, unknown>[]).slice(0, 20)) {
    const provider = typeof c?.provider === "string" ? c.provider : "";
    if (!(CONNECTION_KINDS as readonly string[]).includes(provider) || provider === "test_account") continue;
    const added = await addConnection(email, appId, provider, (c?.meta && typeof c.meta === "object" ? c.meta : {}) as Record<string, unknown>);
    // Audit parity with the connections routes: onboarding-created connections appear in the
    // Connections tab's audit rail like every other add. application_id + provider ONLY, never
    // metadata values; a deduped re-add ({existing: true}) logs nothing (idempotent retry logs once).
    if ("id" in added && !added.existing) {
      await logEvent({ userId: email.toLowerCase(), eventType: "connection_added", actorType: "owner", source: "preflight", route: "/api/preflight/apps", metadata: { application_id: appId, provider } });
    }
  }

  // Record context version 1 (S3). Best-effort by the migration rule: snapshotIfChanged warns and
  // returns null while migration 7 is unapplied, and the try/catch guarantees a connect NEVER fails
  // because context versioning could not run. The application above is already created and usable.
  try { await snapshotIfChanged(email, appId, "owner"); } catch { /* connect stands; context stays unversioned */ }

  // Auto-run discovery on connect: crawl the app + synthesize suggested requirements/flows into the draft
  // contract, so the user lands on a contract that fills itself in instead of a blank page. Fire-and-forget
  // via after() (returns immediately). Fail-soft: no LLM key -> deterministic connection-signal suggestions
  // only; a crawl/synthesis error fails THIS discovery run and never touches the app or the connect response.
  // getActiveDiscovery guards the (rare) retry race; createDiscovery's DB unique index is the real backstop.
  after(async () => {
    try {
      if (await getActiveDiscovery(email, appId)) return;
      const created = await createDiscovery(email, appId);
      if (created) await runDiscovery(email, appId, created);
    } catch (e) {
      console.error(`[preflight] auto-discovery on connect failed for ${appId}:`, (e as Error)?.message);
    }
  });

  return NextResponse.json({ id: appId });
}

export async function DELETE(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  // Deleting a shared application is an OWNER/ADMIN action (it removes it for the whole workspace). A
  // non-member gets a uniform 404; an editor/viewer is forbidden. Delete runs on the app OWNER's data plane.
  const access = await applicationAccess(email, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "admin")) return NextResponse.json({ error: "forbidden", message: "Only the application owner or a workspace admin can remove it." }, { status: 403 });
  // Honest result: a zero-row delete (already gone) must not read as "deleted".
  const ok = await deleteApplication(access.owner, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
