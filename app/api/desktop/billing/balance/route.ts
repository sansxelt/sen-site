import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { CREDITS_PER_DOLLAR, getCreditBalance } from "../../../../../lib/credits";

// v0.1.9 — credit balance lookup.
// Returns { balance, balance_dollars } where balance is the raw credit
// count (1 USD = 100 credits). Used by the desktop billing panel to
// show "$X.XX worth of credits remaining".

export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const balance = await getCreditBalance(email);
  const balance_dollars = balance / CREDITS_PER_DOLLAR;
  return NextResponse.json({ balance, balance_dollars });
}
