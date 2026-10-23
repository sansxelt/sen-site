import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, STATE_MAX_AGE, auth0Config, authorizeUrl, cleanConnection, cleanHint, cleanReturnTo, cookieBase, loginOpen, newState, pkcePair } from "@/lib/auth0-login";

// Starts Auth0 Universal Login (see lib/auth0-login.ts). LOGIN ONLY (founder, 2026-10-22): no sign-up mode is offered. Closed unless loginOpen(): then it only sends the visitor back
// to /login, which explains that accounts are not open yet. Nothing a visitor typed is stored.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const cfg = auth0Config();
  if (!loginOpen() || !cfg) return NextResponse.redirect(new URL("/login?closed=1", origin), 303);
  const q = req.nextUrl.searchParams;
  const { state, nonce } = newState();
  const { verifier, challenge } = await pkcePair();
  const redirectUri = `${origin}/api/login/callback`;
  const url = authorizeUrl(cfg, { redirectUri, state, nonce, challenge, loginHint: cleanHint(q.get("email")), connection: cleanConnection(q.get("connection")) });
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, nonce, verifier, returnTo: cleanReturnTo(q.get("returnTo")) }), { ...cookieBase, maxAge: STATE_MAX_AGE });
  res.headers.set("cache-control", "no-store");
  return res;
}
