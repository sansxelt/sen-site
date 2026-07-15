// Connection management for an application (v_app_connections) — the collection half.
//
//   GET   -> { connections: SafeConnection[] }   safe metadata + masks only; encrypted_ref never selected
//   POST  { provider, meta }                     add a manual connection (metadata only, sanitized)
//
// Invariants:
//   - owner identity comes ONLY from the server session; the application must belong to that owner
//     (getApplication) before anything is read or written — client-supplied ids are never trusted
//   - test_account is refused here: sealed credentials go through the dedicated secrets route only
//   - POST is idempotent against double-click/retry (identical provider+metadata within 10 minutes
//     returns the existing row, and no duplicate audit event is written)
//   - audit events carry application_id + provider ONLY, never metadata values
import { NextResponse } from "next/server";
import { listConnections, addConnection } from "@/lib/preflight/connections-db";
import { snapshotIfChanged } from "@/lib/preflight/context-snapshots";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";
import type { Role } from "@/lib/v-workspace";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

// Listing connections is viewer+; adding one is editor+. `owner` = app owner (data-plane key).
async function gate(params: Promise<{ id: string }>, minRole: Exclude<Role, "client_viewer">): Promise<{ owner: string; appId: string } | NextResponse> {
  const { id } = await params;
  const g = await gatePreflightApp(id, minRole);
  if (!g.ok) return gateReasonResponse(g.reason);
  return { owner: g.owner, appId: id };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params, "viewer");
  if (g instanceof NextResponse) return g;
  const connections = await listConnections(g.owner, g.appId);
  return NextResponse.json({ connections });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params, "editor");
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  const provider = typeof body?.provider === "string" ? body.provider : "";
  if (provider === "test_account") {
    return NextResponse.json({ error: "sealed_route_required", message: "Test accounts are stored through the sealed credentials route, never as plain metadata." }, { status: 400 });
  }
  const meta = (body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : {}) as Record<string, unknown>;
  const r = await addConnection(g.owner, g.appId, provider, meta);
  if ("error" in r) {
    if (r.error === "unknown_provider") return NextResponse.json({ error: "unknown_provider", message: "That connection kind is not supported." }, { status: 400 });
    if (r.error === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (!r.existing) {
    await logEvent({ userId: g.owner, eventType: "connection_added", actorType: "owner", source: "preflight", route: "/api/preflight/apps/[id]/connections", metadata: { application_id: g.appId, provider } });
    // Context version bump (S3, best-effort per the migration rule): the add already succeeded and is
    // returned below whatever happens here; a deduped re-add changes no context and records nothing.
    try { await snapshotIfChanged(g.owner, g.appId, "owner"); } catch { /* the add stands, unversioned */ }
  }
  return NextResponse.json({ id: r.id, existing: r.existing === true });
}
