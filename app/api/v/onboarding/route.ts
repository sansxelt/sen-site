// The Overview's one-time "Set up Vraelis" questions (lib/onboarding.ts). Session-gated on the caller's own
// identity. POST { surface, builder, audience } saves the answers; any of them may be null, and a skip is a
// POST with all three null. Nothing here creates a system or spends anything.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseOnboarding, saveOnboarding } from "@/lib/onboarding";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  await saveOnboarding(email, parseOnboarding(body));
  return NextResponse.json({ ok: true });
}
