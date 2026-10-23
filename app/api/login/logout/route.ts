import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, auth0Config, cookieBase, logoutUrl } from "@/lib/auth0-login";

// Clears the session cookie and, when Auth0 is configured, ends the Auth0 session too. POST only, so a link or image
// on another site cannot sign anyone out.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const cfg = auth0Config();
  const res = NextResponse.redirect(cfg ? logoutUrl(cfg, `${origin}/login`) : new URL("/login", origin), 303);
  res.cookies.set(SESSION_COOKIE, "", { ...cookieBase, maxAge: 0 });
  res.headers.set("cache-control", "no-store");
  return res;
}
