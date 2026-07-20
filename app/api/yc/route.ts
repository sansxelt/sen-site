// GET /yc?k=<code>  (also reachable at /api/yc?k=<code>)
//
// The reviewer entrance. Someone reading a hundred applications is not going to discover a hidden key
// gesture, and asking them to would trade a working demo for a party trick. This opens the real site in
// one click.
//
// A Route Handler on purpose: handlers do not render layouts, so this is not intercepted by the stealth
// gate in the root layout the way a page would be.
//
// Same honesty as the rest of stealth: this is a CURTAIN, not access control. The code keeps the entrance
// off the open web, and it is revocable by changing one environment variable, but anything that would
// actually harm you if seen must be behind the session and tenancy checks instead. It sets exactly the same
// signed cookie the gesture does, with the same expiry, so a reviewer gets no more access than you do.
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { stealthConfigured, signStealthCookie, stealthCookieOptions, STEALTH_COOKIE } from "@/lib/stealth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function codeMatches(given: string): boolean {
  const expected = (process.env.STEALTH_REVIEWER_CODE ?? "").trim();
  if (!expected) return false; // unset means the entrance is closed, never open-to-all
  const a = Buffer.from(given.trim());
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host}`;
  const home = NextResponse.redirect(origin, 302);

  // Wrong or missing code, or stealth is off: just go to the front page. A bad code and a closed entrance
  // are indistinguishable, so this never confirms that a valid code exists.
  if (!stealthConfigured() || !codeMatches(url.searchParams.get("k") ?? "")) return home;

  // Scoped to .vraelis.com so one click opens the marketing site AND the product subdomain.
  home.cookies.set(STEALTH_COOKIE, signStealthCookie(), stealthCookieOptions(req.headers.get("x-forwarded-host") || req.headers.get("host")));
  return home;
}
