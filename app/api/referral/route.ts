import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { limitOr429 } from "@/lib/vraelis-ratelimit";
import { auth } from "../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../lib/desktop-auth";
import {
  getReferralStats,
  recordReferralSignup,
} from "../../../lib/referral";

export const runtime = "nodejs";

// GET /api/referral → { code, totalReferrals, conversions, creditsEarned }
// Requires an authenticated session.
export async function GET(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const stats = await getReferralStats(email);
    return NextResponse.json(stats, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("GET /api/referral failed:", err);
    return NextResponse.json(
      { error: "Could not load referral data." },
      { status: 500 },
    );
  }
}

// POST /api/referral
// Body: { action: "record_signup", code: string }
//
// SECURITY: this MINTS CREDITS, and it used to be unauthenticated and to take the beneficiary's address
// straight from the request body. Anyone could POST a code and any email and have credits issued to it,
// repeatedly, for any address they chose. The idempotency guard was also a check-then-insert with nothing
// serialising it, so concurrent calls could both pass.
//
// The beneficiary is now the SIGNED-IN user, taken from the session and never from the body. That is the
// honest model of what this action means — "the person who just signed up is claiming a referral code" —
// and it removes the ability to name someone else entirely. A per-IP limit bounds code-guessing, and a
// unique index (sql/vraelis-referral-idempotency.sql) makes the award idempotent at the database rather
// than in application logic.
export async function POST(request: NextRequest) {
  const limited = await limitOr429(request, "referral", 10, 600);
  if (limited) return limited;

  const session = await auth();
  const sessionEmail = session?.user?.email;
  if (!sessionEmail) {
    return NextResponse.json({ error: "Sign in to claim a referral." }, { status: 401 });
  }

  let body: { action?: string; code?: string; email?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "record_signup") {
    const { code } = body;
    // The body's `email` is deliberately IGNORED. Credits go to whoever is signed in.
    const newEmail = sessionEmail;
    if (!code || !newEmail) {
      return NextResponse.json(
        { error: "code and email are required." },
        { status: 400 },
      );
    }
    try {
      await recordReferralSignup(code, newEmail);
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch (err) {
      console.error("POST /api/referral record_signup failed:", err);
      return NextResponse.json(
        { error: "Could not record referral signup." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
