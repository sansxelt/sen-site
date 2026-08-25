import { NextResponse } from "next/server";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { auth } from "@/auth";
import { ensureProfile, getPlan } from "@/lib/v-db";
import { apiAccessAllowed } from "@/lib/v-entitlements";
import { listApiKeys, generateApiKey } from "@/lib/v-api-keys";

export const runtime = "nodejs";

// Env-overridable so it can be raised without a deploy.
const MAX_API_KEYS_PER_USER = Number(process.env.MAX_API_KEYS_PER_USER || 25) || 25;

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
  const v1 = await getPlanV1State(email.toLowerCase()).catch(() => null);
  if (!apiAccessAllowed(await getPlan(email), email, v1?.plan)) {
    return NextResponse.json({ error: "plan_required", need: "scale" }, { status: 403 });
  }
  // RESOURCE CAP. There was no limit on how many keys one account could mint. Each is a live
  // credential against the public API, so an unbounded set is both an audit problem (nobody can say
  // which keys are legitimate) and a spend problem. The ceiling is generous — it exists to stop a loop,
  // not to ration normal use — and counts only keys that are still active.
  const existing = await listApiKeys(email);
  const activeKeys = existing.filter((k) => !(k as { revoked_at?: string | null }).revoked_at).length;
  if (activeKeys >= MAX_API_KEYS_PER_USER) {
    return NextResponse.json(
      { error: "key_limit_reached", limit: MAX_API_KEYS_PER_USER },
      { status: 409 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body?.name || "").trim().slice(0, 40);
  // Scopes are chosen at creation and never widened afterwards; to change what a key can do you revoke it
  // and mint a new one. sanitizeScopes drops anything not on the grantable list, so an unrecognized scope
  // silently narrows the key rather than granting something undefined.
  // A daily ceiling is optional and only ever narrows what the key can spend. generateApiKey REFUSES to
  // mint a key when a ceiling was asked for but the column is missing, rather than quietly creating an
  // unbounded one.
  const k = await generateApiKey(email, name, body?.scopes, body?.daily_ceiling_cents);
  if (!k) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(k); // { key, prefix } — the raw key is shown to the user once
}
