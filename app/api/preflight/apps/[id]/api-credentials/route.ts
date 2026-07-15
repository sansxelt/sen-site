// API-beta customer route: manage API credentials in the encrypted vault.
// GET    -> { credentials: [{ id, label, secretMask, scheme }] }   (never the secret)
// POST   -> save a credential { label, secret, scheme, headerName? } -> { id, secretMask }   (secret sealed)
// DELETE ?id=<connId> -> revoke                                     -> { ok }
// Uniform 404 for any non-allowlisted/non-enabled caller.

import { NextResponse } from "next/server";
import { gateApiRuntimeApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { addApiCredential, removeConnection, listConnections } from "@/lib/preflight/connections-db";

export const runtime = "nodejs";
const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "viewer"); // masked list is viewer+ (secret is never returned)
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;
  const all = await listConnections(owner, id);
  const credentials = all
    .filter((c) => c.provider === "api_credential")
    .map((c) => ({ id: c.id, label: String((c.meta as { label?: string })?.label ?? "API credential"), secretMask: String((c.meta as { secret_mask?: string })?.secret_mask ?? "••••"), scheme: String((c.meta as { scheme?: string })?.scheme ?? "bearer") }));
  return NextResponse.json({ credentials });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "editor"); // storing a sealed credential is editor+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  let body: { label?: string; secret?: string; scheme?: string; headerName?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "bad_body" }, { status: 400 }); }
  const scheme = body.scheme;
  if (scheme !== "bearer" && scheme !== "api_key" && scheme !== "basic") return NextResponse.json({ error: "invalid", message: "Choose how the credential is sent (bearer token, API key, or basic)." }, { status: 400 });
  const res = await addApiCredential(owner, id, { label: body.label || "API credential", secret: body.secret || "", scheme, headerName: body.headerName });
  if ("error" in res) {
    const map: Record<string, { status: number; message: string }> = {
      credentials_required: { status: 400, message: "Enter the credential value." },
      vault_unconfigured: { status: 503, message: "Secure storage is not available right now." },
      not_found: { status: 404, message: "not_found" },
    };
    const e = map[res.error] ?? { status: 400, message: "Could not save the credential." };
    return NextResponse.json({ error: res.error, message: e.message }, { status: e.status });
  }
  return NextResponse.json({ id: res.id, secretMask: res.secretMask });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await gateApiRuntimeApp(id, "editor"); // revoking a credential is editor+
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;
  const connId = new URL(req.url).searchParams.get("id") || "";
  if (!connId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const ok = await removeConnection(owner, id, connId);
  return ok ? NextResponse.json({ ok: true }) : notFound();
}
