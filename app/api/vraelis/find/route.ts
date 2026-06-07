// Search local businesses to prospect (owner-only).
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { findBusinesses } from "@/lib/vraelis-find";
import { limitOr429 } from "@/lib/vraelis-ratelimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });
  }
  // Rate limit: 15 searches / 5 min per IP (OSM courtesy + cost).
  const limited = await limitOr429(req, "find", 15, 300);
  if (limited) return limited;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query : "";
  const result = await findBusinesses(query);
  if (!result.ok) {
    const status = result.error === "not_configured" ? 503 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
