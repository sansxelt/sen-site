import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { listApiKeys, generateApiKey } from "@/lib/v-api-keys";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  return NextResponse.json({ keys: await listApiKeys(email) });
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);
  if (!apiAccessAllowed(await getPlan(email), email)) {
    return NextResponse.json({ error: "plan_required", need: "scale" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 40);
  // Scopes are chosen at creation and never widened afterwards; to change what a key can do you revoke it
  // and mint a new one. sanitizeScopes drops anything not on the grantable list, so an unrecognized scope
  // silently narrows the key rather than granting something undefined.
  const k = await generateApiKey(email, name, body?.scopes);
  if (!k) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(k); // { key, prefix } — the raw key is shown to the user once
}
