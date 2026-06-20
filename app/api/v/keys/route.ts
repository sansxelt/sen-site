import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { listApiKeys, generateApiKey } from "@/lib/v-api-keys";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  return NextResponse.json({ keys: await listApiKeys(email) });
}

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  await ensureProfile(email, session.user?.name ?? undefined);
  const k = await generateApiKey(email);
  if (!k) return NextResponse.json({ error: "create_failed" }, { status: 500 });
  return NextResponse.json(k); // { key, prefix } — the raw key is shown to the user once
}
