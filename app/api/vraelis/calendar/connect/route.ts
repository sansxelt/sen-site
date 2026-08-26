// Start Google Calendar OAuth (owner-authed) → Google consent screen.
//
// SECURITY: `state` is a single-use random nonce bound to an httpOnly cookie. It used to be the constant
// string "vraelis" and the callback never read it, so an attacker could complete the Google consent flow
// with their OWN account and then get a signed-in owner to open the resulting callback URL: the victim's
// session supplied the identity while the ATTACKER's refresh token was stored on the victim's workspace.
// Every subsequent booking would then be written into the attacker's calendar, and the attacker's
// free/busy would decide which slots the victim's booking page offers.
//
// Mirrors the nonce pattern already used by app/api/preflight/connections/[provider]/oauth/route.ts.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isCalendarConfigured, consentUrl } from "@/lib/vraelis-calendar";

const ORIGIN = "https://vraelis.com";
export const CAL_STATE_COOKIE = "vr_cal_state";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(`${ORIGIN}/signin?callbackUrl=%2Faccount`);
  if (!isCalendarConfigured()) return NextResponse.redirect(`${ORIGIN}/v/account?calendar=unavailable`);

  const state = randomBytes(32).toString("base64url");
  const res = NextResponse.redirect(consentUrl(state));
  res.cookies.set(CAL_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: Google's redirect back is a top-level GET navigation, which Lax allows and Strict
    // would drop — dropping it would make the callback fail closed on every legitimate connection.
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
