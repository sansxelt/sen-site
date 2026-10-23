import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE, auth0Config, cookieBase, exchangeCode, loginOpen, verifyIdToken } from "@/lib/auth0-login";

// Auth0 returns here. Checks, in order: sign-in is open; the state matches the one this browser started with (it is
// single-use and expires in ten minutes); the code exchange with the PKCE verifier succeeds; the id_token's signature,
// issuer, audience, expiry and nonce verify. Only then is a session cookie set. Every failure lands on /login with a
// generic reason; no token or provider error text is shown or logged.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (why: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${why}`, origin), 303);
    res.cookies.delete(STATE_COOKIE);
    res.headers.set("cache-control", "no-store");
    return res;
  };
  const cfg = auth0Config();
  if (!loginOpen() || !cfg) return fail("closed");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return fail("denied");
  let saved: { state?: string; nonce?: string; verifier?: string; returnTo?: string };
  try { saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}"); } catch { return fail("state"); }
  const code = q.get("code"), state = q.get("state");
  if (!code || !state || !saved.state || state !== saved.state || !saved.verifier || !saved.nonce) return fail("state");
  try {
    const idToken = await exchangeCode(cfg, code, saved.verifier, `${origin}/api/login/callback`);
    await verifyIdToken(cfg, idToken, saved.nonce);
    const res = NextResponse.redirect(new URL(saved.returnTo && saved.returnTo.startsWith("/") ? saved.returnTo : "/login", origin), 303);
    res.cookies.delete(STATE_COOKIE);
    res.cookies.set(SESSION_COOKIE, idToken, { ...cookieBase, maxAge: SESSION_MAX_AGE });
    res.headers.set("cache-control", "no-store");
    return res;
  } catch {
    return fail("verify");
  }
}
