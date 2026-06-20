// POST /api/flip/connect — enroll the signed-in user for a marketplace
// integration. Body: { platform }. eBay/Shopify are the API-capable ones we're
// building toward; this records early-access intent until OAuth/credentials are
// live, at which point the same row flips to status 'connected'.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { upsertConnection } from "@/lib/flip-db";

export const runtime = "nodejs";

const ENROLLABLE = new Set(["ebay", "shopify"]); // have real APIs

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const platform = String(body?.platform || "").toLowerCase();
  if (!ENROLLABLE.has(platform)) {
    return NextResponse.json({ error: "not_enrollable", platform }, { status: 400 });
  }

  await upsertConnection(email, platform, "early_access");
  return NextResponse.json({ ok: true, platform, status: "early_access" });
}
