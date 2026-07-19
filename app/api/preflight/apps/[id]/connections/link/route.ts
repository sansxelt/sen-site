// Per-app connection LINK management. An app uses an account-level connection + its own selection.
//
//   GET    -> { links: AppConnectionLink[] }              which account connection + selection per provider
//   POST   { provider, accountConnectionId, selection }   link (or re-link) this app to an account connection
//   DELETE ?provider=<p>                                  unlink this app from a provider (token untouched)
//
// Editor+ gate (mutations) / viewer+ (list). owner = app owner (data-plane key). The account token is never
// touched here — only the per-app pointer + selection.
import { NextResponse } from "next/server";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";
import type { Role } from "@/lib/v-workspace";
import { linkAppToAccountConnection, unlinkApp, listAppLinks } from "@/lib/preflight/connection-links-db";

export const runtime = "nodejs";

async function gate(params: Promise<{ id: string }>, minRole: Exclude<Role, "client_viewer">): Promise<{ owner: string; appId: string } | NextResponse> {
  const { id } = await params;
  const g = await gatePreflightApp(id, minRole);
  if (!g.ok) return gateReasonResponse(g.reason);
  return { owner: g.owner, appId: id };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params, "viewer");
  if (g instanceof NextResponse) return g;
  const links = await listAppLinks(g.owner, g.appId);
  return NextResponse.json({ links });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params, "editor");
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  const provider = typeof body?.provider === "string" ? body.provider : "";
  const accountConnectionId = typeof body?.accountConnectionId === "string" ? body.accountConnectionId : "";
  const selection = (body?.selection && typeof body.selection === "object" && !Array.isArray(body.selection)) ? body.selection : {};
  if (!provider || !accountConnectionId) return NextResponse.json({ error: "provider_and_connection_required" }, { status: 400 });

  const res = await linkAppToAccountConnection(g.owner, g.appId, provider, accountConnectionId, selection);
  if ("error" in res) {
    const status = res.error === "not_found" || res.error === "connection_not_found" ? 404 : 400;
    return NextResponse.json({ error: res.error }, { status });
  }
  return NextResponse.json({ ok: true, id: res.id });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(ctx.params, "editor");
  if (g instanceof NextResponse) return g;
  const provider = new URL(req.url).searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "provider_required" }, { status: 400 });
  const removed = await unlinkApp(g.owner, g.appId, provider);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
