// POST /api/preflight/apps  — connect an application (create + seed a draft Production Contract).
// DELETE /api/preflight/apps?id=... — remove a connected application (owner-scoped).
// Session-authenticated; gated by the Preflight flag. Phase 1 does NO discovery or browser execution —
// it only records the app + the "I own/authorized this app" attestation. The URL is validated cheaply
// here (https, not a private/loopback host) reusing the existing SSRF string guard; deep validation +
// DNS pinning happen later, before any navigation.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { createApplication, deleteApplication } from "@/lib/v-applications";
import { addConnection, applySetupExtras, normalizeBoundaries, normalizeContextSources, CONNECTION_KINDS } from "@/lib/preflight/connections-db";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";

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

  const r = await createApplication(email, { name, appUrl, builder, sourcePrompt, ownershipConfirmed: true });
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
    await addConnection(email, appId, provider, (c?.meta && typeof c.meta === "object" ? c.meta : {}) as Record<string, unknown>);
  }

  return NextResponse.json({ id: appId });
}

export async function DELETE(req: Request) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  // Honest result: a zero-row delete (not owned / already gone) must not read as "deleted".
  const ok = await deleteApplication(email, id);
  if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
