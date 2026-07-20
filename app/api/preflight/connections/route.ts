// Account-level connections REST (v_account_connections). Session-gated on the caller's own identity — no
// application scope, no team role. Mirrors the /api "API & Webhooks" precedent (user_id-keyed).
//
//   GET    -> { connections: AccountConnection[] }   safe metadata + masks only; encrypted_ref never selected
//   DELETE ?id=<id>                                   revoke one grant (deletes the row + ciphertext; its
//                                                     per-app links cascade away)
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { listAccountConnections, removeAccountConnection } from "@/lib/preflight/account-connections-db";
import { OAUTH_PROVIDER_KINDS, resolveOAuthProvider, providerAvailable } from "@/lib/preflight/oauth/providers";

export const runtime = "nodejs";

async function owner(): Promise<string | null> {
  if (!preflightEnabled()) return null;
  const email = (await auth())?.user?.email;
  return email ? email.trim().toLowerCase() : null;
}

export async function GET() {
  const o = await owner();
  if (!o) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const connections = await listAccountConnections(o);
  // Which providers can be offered right now (configured + not gated). Availability is server-side (env),
  // so the client can't compute it — we hand it the list.
  const available = OAUTH_PROVIDER_KINDS.filter((k) => {
    const p = resolveOAuthProvider(k);
    return p && providerAvailable(p);
  });
  // Providers whose authorization needs the full window rather than a popup (Vercel's multi-step install).
  const redirectOnly = available.filter((k) => resolveOAuthProvider(k)?.authorizeWindow === "redirect");
  return NextResponse.json({ connections, available, redirectOnly });
}

export async function DELETE(req: Request) {
  const o = await owner();
  if (!o) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const removed = await removeAccountConnection(o, id);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
