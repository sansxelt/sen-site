import { NextResponse } from "next/server";
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
// Public — no auth required (called when a visitor signs up via ref link).
export async function POST(request: Request) {
  let body: { action?: string; code?: string; email?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (body.action === "record_signup") {
    const { code, email: newEmail } = body;
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
