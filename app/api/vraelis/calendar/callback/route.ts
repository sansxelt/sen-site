// Google Calendar OAuth callback. Identity comes from the signed-in session; the state nonce proves this
// callback belongs to a flow THIS browser started.
//
// SECURITY: the old header claimed "state is CSRF-only", but no state was ever read — the parameter was
// the constant "vraelis" and this route ignored it entirely. Anyone could run the Google consent flow with
// their own account and hand a signed-in owner the resulting callback URL, planting the ATTACKER's refresh
// token on the victim's workspace. The nonce below is minted in the connect route, stored httpOnly, and
// compared in constant time before the code is exchanged.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { exchangeCode } from "@/lib/vraelis-calendar";
import { setWorkspaceCalendar } from "@/lib/vraelis-db";
import { CAL_STATE_COOKIE } from "../connect/route";

const ORIGIN = "https://vraelis.com";

// Length-checked first: timingSafeEqual throws on a length mismatch.
function nonceMatches(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a), y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);

  // Fail closed on a missing, stale or mismatched nonce, BEFORE the code is exchanged. The cookie is
  // cleared on this path too, so a half-finished flow cannot be resumed later.
  const expected = req.cookies.get(CAL_STATE_COOKIE)?.value;
  const got = req.nextUrl.searchParams.get("state") ?? undefined;
  if (!nonceMatches(expected, got)) {
    const bad = NextResponse.redirect(`${ORIGIN}/v/account?calendar=error`);
    bad.cookies.delete(CAL_STATE_COOKIE);
    return bad;
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${ORIGIN}/v/account?calendar=error`);

  const refreshToken = await exchangeCode(code);
  if (!refreshToken) {
    // Google omits refresh_token if already granted without prompt=consent.
    return NextResponse.redirect(`${ORIGIN}/v/account?calendar=error`);
  }
  await setWorkspaceCalendar(email, { refreshToken, connected: true, calendarId: "primary" });
  const done = NextResponse.redirect(`${ORIGIN}/v/account?calendar=done`);
  done.cookies.delete(CAL_STATE_COOKIE); // single use
  return done;
}
