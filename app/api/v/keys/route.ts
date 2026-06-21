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
  const name = String((await req.json().catch(() => ({})))?.name || "").trim().slice(0, 40);
  const k = await generateApiKey(email, name);
  if (!k) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(k); // { key, prefix } — the raw key is shown to the user once
}
