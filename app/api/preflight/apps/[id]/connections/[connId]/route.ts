// Connection management — the single-row half.
//
//   PATCH  { meta, expected_updated_at? }  edit metadata (sanitized; provider + encrypted_ref untouchable)
//   DELETE                                 disconnect / revoke (row deleted; any sealed credential with it)
//
// Invariants:
//   - owner identity comes ONLY from the server session; ownership of the APPLICATION is verified first
//     (getApplication), and the connection row is always filtered by user_id + application_id + id
//     together (a connection id alone is never enough)
//   - test_account metadata is sealed-path-only: PATCH refuses it (replace the credential instead)
//   - stale edits are refused (expected_updated_at echo mismatch -> 409), zero-row updates and deletes
//     are 404 (a removed connection is never silently recreated, and a repeat DELETE resolves as 404)
//   - audit events carry application_id + provider ONLY, never metadata values
import { NextResponse } from "next/server";
import { getConnection, updateConnectionMeta, removeConnection } from "@/lib/preflight/connections-db";
import { snapshotIfChanged } from "@/lib/preflight/context-snapshots";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

type Params = Promise<{ id: string; connId: string }>;

// Editing/removing a connection is EDITOR+. `owner` = the app owner (data-plane key).
async function gate(params: Params): Promise<{ owner: string; appId: string; connId: string } | NextResponse> {
  const { id, connId } = await params;
  const g = await gatePreflightApp(id, "editor");
  if (!g.ok) return gateReasonResponse(g.reason);
  return { owner: g.owner, appId: id, connId };
}

export async function PATCH(req: Request, ctx: { params: Params }) {
  const g = await gate(ctx.params);
  if (g instanceof NextResponse) return g;
  const conn = await getConnection(g.owner, g.appId, g.connId);
  if (!conn) return NextResponse.json({ error: "not_found", message: "No such connection on this application." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const meta = (body?.meta && typeof body.meta === "object" && !Array.isArray(body.meta) ? body.meta : null) as Record<string, unknown> | null;
  if (!meta) return NextResponse.json({ error: "meta_required", message: "Send the metadata to store." }, { status: 400 });
  const expected = typeof body?.expected_updated_at === "string" ? body.expected_updated_at : (body?.expected_updated_at === null ? null : undefined);
  const r = await updateConnectionMeta(g.owner, g.appId, g.connId, meta, expected);
  if ("error" in r) {
    if (r.error === "not_editable") return NextResponse.json({ error: "not_editable", message: "Test account details are sealed. Replace the credential instead of editing metadata." }, { status: 400 });
    if (r.error === "stale") return NextResponse.json({ error: "stale_edit", message: "This connection changed since you loaded it. Reload the page and re-apply your edit." }, { status: 409 });
    if (r.error === "not_found") return NextResponse.json({ error: "not_found", message: "No such connection on this application. Nothing was changed." }, { status: 404 });
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  await logEvent({ userId: g.owner, eventType: "connection_updated", actorType: "owner", source: "preflight", route: "/api/preflight/apps/[id]/connections/[connId]", metadata: { application_id: g.appId, provider: conn.provider } });
  // Context version bump (S3, best-effort per the migration rule): the edit already succeeded.
  try { await snapshotIfChanged(g.owner, g.appId, "owner"); } catch { /* the edit stands, unversioned */ }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Params }) {
  const g = await gate(ctx.params);
  if (g instanceof NextResponse) return g;
  // Provider is read first (for the audit event); the delete itself still counts rows, so a repeat
  // DELETE or a stale id honestly 404s instead of claiming a disconnect it did not perform.
  const conn = await getConnection(g.owner, g.appId, g.connId);
  if (!conn) return NextResponse.json({ error: "not_found", message: "No such connection on this application. Nothing was disconnected." }, { status: 404 });
  const ok = await removeConnection(g.owner, g.appId, g.connId);
  if (!ok) return NextResponse.json({ error: "not_found", message: "No such connection on this application. Nothing was disconnected." }, { status: 404 });
  await logEvent({ userId: g.owner, eventType: "connection_removed", actorType: "owner", source: "preflight", route: "/api/preflight/apps/[id]/connections/[connId]", metadata: { application_id: g.appId, provider: conn.provider } });
  // Context version bump (S3, best-effort per the migration rule): the disconnect already succeeded.
  try { await snapshotIfChanged(g.owner, g.appId, "owner"); } catch { /* the disconnect stands, unversioned */ }
  return NextResponse.json({ ok: true });
}
