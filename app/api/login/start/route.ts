import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE, STATE_MAX_AGE, auth0Config, authorizeUrl, cleanLoginTicket, cleanOrganization, cleanReturnTo, cookieBase, loginOpen, newState, pkcePair, sealTransaction, transactionKey } from "@/lib/auth0-login";

// Second step of logging in with Vraelis-issued credentials (see lib/auth0-login.ts). The browser has already sent the
// email and password to Auth0 and received a single-use login ticket; only that ticket (and an optional organization)
// is POSTed here, never the password. This sets the state/nonce/PKCE cookie and continues to Auth0's /authorize.
// LOGIN ONLY: no sign-up, no social or third-party connection. Closed unless loginOpen().
const back = (origin: string, q: string) => {
  const res = NextResponse.redirect(new URL(`/login${q}`, origin), 303);
  res.headers.set("cache-control", "no-store");
  return res;
};

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const cfg = auth0Config(), key = transactionKey();
  if (!loginOpen() || !cfg || !key) return back(origin, "?closed=1");
  // Same-origin form posts only: a page on another site cannot start a login here.
  const from = req.headers.get("origin");
  if (from !== null && from !== origin) return back(origin, "?error=state");
  let form: FormData;
  try { form = await req.formData(); } catch { return back(origin, "?error=state"); }
  const ticket = cleanLoginTicket(String(form.get("login_ticket") ?? ""));
  if (!ticket) return back(origin, "?error=state");
  const { state, nonce } = newState();
  const { verifier, challenge } = await pkcePair();
  const url = authorizeUrl(cfg, { redirectUri: `${origin}/api/login/callback`, state, nonce, challenge, loginTicket: ticket,
    organization: cleanOrganization(String(form.get("organization") ?? "")) });
  const res = NextResponse.redirect(url, 303);
  const sealed = await sealTransaction({ state, nonce, verifier, returnTo: cleanReturnTo(String(form.get("returnTo") ?? "")) }, key);
  res.cookies.set(STATE_COOKIE, sealed, { ...cookieBase, maxAge: STATE_MAX_AGE });
  res.headers.set("cache-control", "no-store");
  return res;
}

/** A bare visit starts nothing; it returns to the form. */
export async function GET(req: NextRequest) {
  return back(req.nextUrl.origin, loginOpen() ? "" : "?closed=1");
}
