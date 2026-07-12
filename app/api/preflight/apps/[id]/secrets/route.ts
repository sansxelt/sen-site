// Test-account credentials for an application — the ONLY route that touches the secret vault.
//
//   POST   { label, username, password, scope }  -> seal (AES-256-GCM) + store; returns id + username MASK
//   GET                                          -> masked list only (label, username_mask, scope, created)
//   DELETE ?id=<connectionId>                    -> revoke (row + ciphertext deleted)
//
// Invariants, all enforced below or in lib/preflight/{secret-vault,connections-db}.ts:
//   - plaintext is NEVER returned, logged, or echoed back (not even on the POST that received it)
//   - no vault key (VRAELIS_SECRET_KEY) -> 503 vault_unconfigured, nothing stored anywhere (fail closed)
//   - owner-scoped end to end: the app must belong to the signed-in email or everything 404s
//   - the worker reads credentials via openTestAccount (worker-side), never through any web route
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication } from "@/lib/v-applications";
import { addTestAccount, listConnections, removeConnection } from "@/lib/preflight/connections-db";

export const runtime = "nodejs";

async function gate(req: Request, params: Promise<{ id: string }>): Promise<{ owner: string; appId: string } | NextResponse> {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!(await preflightDbReady())) return NextResponse.json({ error: "setup_required" }, { status: 503 });
  const { id } = await params;
  const app = await getApplication(email.toLowerCase(), id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return { owner: email.toLowerCase(), appId: id };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ctx.params);
  if (g instanceof NextResponse) return g;
  const body = await req.json().catch(() => ({}));
  const result = await addTestAccount(g.owner, g.appId, {
    label: typeof body?.label === "string" ? body.label : "Standard user",
    username: typeof body?.username === "string" ? body.username : "",
    password: typeof body?.password === "string" ? body.password : "",
    scope: typeof body?.scope === "string" ? body.scope : undefined,
  });
  if ("error" in result) {
    if (result.error === "vault_unconfigured") {
      return NextResponse.json({ error: "vault_unconfigured", message: "Secure credential storage is not configured on the server yet. Nothing was stored." }, { status: 503 });
    }
    if (result.error === "credentials_required") {
      return NextResponse.json({ error: "credentials_required", message: "A username and password are both required." }, { status: 400 });
    }
    return NextResponse.json({ error: result.error }, { status: result.error === "not_found" ? 404 : 503 });
  }
  return NextResponse.json({ id: result.id, username_mask: result.usernameMask });
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ctx.params);
  if (g instanceof NextResponse) return g;
  const all = await listConnections(g.owner, g.appId);
  // Masked view only; listConnections never selects the ciphertext to begin with.
  const accounts = all.filter((c) => c.provider === "test_account").map((c) => ({
    id: c.id, label: String(c.meta.label ?? ""), username_mask: String(c.meta.username_mask ?? "••••"),
    scope: String(c.meta.scope ?? ""), created_at: c.created_at,
  }));
  return NextResponse.json({ accounts });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await gate(req, ctx.params);
  if (g instanceof NextResponse) return g;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  // A revoke must never claim success it didn't deliver: zero rows removed (stale id, wrong app) is a 404,
  // because the credential still exists and the owner must know that.
  const ok = await removeConnection(g.owner, g.appId, id);
  if (!ok) return NextResponse.json({ error: "not_found", message: "No such credential on this application. Nothing was revoked." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
