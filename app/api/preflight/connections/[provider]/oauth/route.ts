// Account-level connection-OAuth INITIATE. GET /api/preflight/connections/[provider]/oauth
//
// Connect a provider ONCE for the whole account — no application scope. Gated on session identity only
// (owner = the caller's own lowercased email), not on any app role. Mints signed state binding
// owner+provider+nonce (NO appId) + a nonce cookie, then 302s to the provider's authorize screen. The
// account callback (a separate fixed redirect URI) seals the token into v_account_connections.
//
// Fails closed: preflight off / not signed in / DB not ready -> back to the connections page; no vault ->
// 503; provider unknown -> 404; provider creds missing -> back with server_misconfigured.
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { vaultConfigured } from "@/lib/preflight/secret-vault";
import { resolveOAuthProvider, providerAvailable, callbackPath, buildAuthorizeUrl } from "@/lib/preflight/oauth/providers";
import { signOAuthState, newNonce } from "@/lib/preflight/oauth/state";
import { createCodeVerifier, codeChallengeS256, pkceCookieName } from "@/lib/preflight/oauth/pkce";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
function backToConnections(req: Request, params: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/connections?${params}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;

  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Resolve BEFORE anything reflects the segment. The db-ready branch below used to echo the raw
  // [provider] path segment into a redirect three lines before this check ran, so an arbitrary
  // percent-decoded value reached a response with no validation of any kind.
  const p = resolveOAuthProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });

  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.redirect(`${baseUrl(req)}/signin?callbackUrl=${encodeURIComponent("/connections")}`, 302);
  if (!(await preflightDbReady())) {
    return backToConnections(req, new URLSearchParams({ oauth: "error", provider: p.kind, reason: "server_misconfigured" }).toString());
  }
  const owner = email.trim().toLowerCase();

  if (!vaultConfigured()) return NextResponse.json({ error: "vault_unconfigured" }, { status: 503 });
  if (!providerAvailable(p)) {
    return backToConnections(req, new URLSearchParams({ oauth: "error", provider: p.kind, reason: "server_misconfigured" }).toString());
  }

  const nonce = newNonce();
  const state = signOAuthState({ owner, provider, nonce }); // no appId => account-level state
  // Same registered callback URL as the per-app flow; the unified callback branches on state.appId.
  const redirectUri = `${baseUrl(req)}${callbackPath(provider)}`;
  // PKCE providers: only the S256 hash goes to the provider. The verifier stays in an httpOnly cookie so an
  // intercepted authorization code cannot be exchanged by anyone but this browser.
  const verifier = p.pkce ? createCodeVerifier() : null;
  const authUrl = buildAuthorizeUrl(p, { state, redirectUri, codeChallenge: verifier ? codeChallengeS256(verifier) : undefined });
  if (!authUrl) return backToConnections(req, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  const res = NextResponse.redirect(authUrl, 302);
  res.cookies.set(`vr_oauth_acct_${provider}`, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  if (verifier) res.cookies.set(pkceCookieName(provider), verifier, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  // Popup mode: the connections page opened this in a window.open. Remember it so the callback closes the
  // popup and messages the opener instead of redirecting a full page the user never sees.
  if (new URL(req.url).searchParams.get("popup") === "1") {
    res.cookies.set("vr_oauth_popup", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  }
  return res;
}
