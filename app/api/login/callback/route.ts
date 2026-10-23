import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE, auth0Config, cookieBase, exchangeCode, loginOpen, openTransaction, safeDestination, transactionKey, verifyIdToken } from "@/lib/auth0-login";

// Auth0 returns here. Checks, in order: sign-in is open; the sealed transaction cookie decrypts and authenticates
// under LOGIN_COOKIE_SECRET and is under ten minutes old by its own issued-at (Codex LOGIN-01); its state equals the
// returned state; the code exchange with its PKCE verifier succeeds; the id_token verifies (signature, issuer,
// audience/azp, sub, exp, iat, nonce; Codex LOGIN-02). Only then is a session cookie set, and the visitor is sent to a
// destination re-validated here and required to resolve to this origin. Every failure lands on /login with a generic
// reason; no token or provider error text is shown or logged.
//
// Consumption semantics (stated, not overstated): the transaction cookie is deleted on every outcome, but there is no
// server-side record of used transactions. Presenting a copy of a sealed transaction again within its ten minutes can
// succeed only if Auth0 issues a NEW authorization code whose id_token carries that transaction's nonce; Auth0 codes are
// single-use, so the same code cannot be redeemed twice. A server-side used-transaction store is not implemented.
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (why: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${why}`, origin), 303);
    res.cookies.set(STATE_COOKIE, "", { ...cookieBase, maxAge: 0 });
    res.headers.set("cache-control", "no-store");
    return res;
  };
  const cfg = auth0Config(), key = transactionKey();
  if (!loginOpen() || !cfg || !key) return fail("closed");
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return fail("denied");
  const saved = await openTransaction(req.cookies.get(STATE_COOKIE)?.value, key);
  const code = q.get("code"), state = q.get("state");
  if (!saved || !code || !state || state !== saved.state) return fail("state");
  try {
    const idToken = await exchangeCode(cfg, code, saved.verifier, `${origin}/api/login/callback`);
    await verifyIdToken(cfg, idToken, saved.nonce);
    const res = NextResponse.redirect(safeDestination(saved.returnTo, origin), 303);
    res.cookies.set(STATE_COOKIE, "", { ...cookieBase, maxAge: 0 });
    res.cookies.set(SESSION_COOKIE, idToken, { ...cookieBase, maxAge: SESSION_MAX_AGE });
    res.headers.set("cache-control", "no-store");
    return res;
  } catch {
    return fail("verify");
  }
}
