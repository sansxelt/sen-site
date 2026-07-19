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
import { resolveOAuthProvider, providerAvailable, callbackPath } from "@/lib/preflight/oauth/providers";
import { signOAuthState, newNonce } from "@/lib/preflight/oauth/state";

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
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.redirect(`${baseUrl(req)}/signin?callbackUrl=${encodeURIComponent("/connections")}`, 302);
  if (!(await preflightDbReady())) return backToConnections(req, `oauth=error&provider=${provider}&reason=server_misconfigured`);
  const owner = email.trim().toLowerCase();

  const p = resolveOAuthProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (!vaultConfigured()) return NextResponse.json({ error: "vault_unconfigured" }, { status: 503 });
  if (!providerAvailable(p)) return backToConnections(req, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  const nonce = newNonce();
  const state = signOAuthState({ owner, provider, nonce }); // no appId => account-level state
  // Same registered callback URL as the per-app flow; the unified callback branches on state.appId. Providers
  // like GitHub allow only one callback URL, so both flows must share it.
  const redirectUri = `${baseUrl(req)}${callbackPath(provider)}`;

  const authUrl = new URL(p.authorizeUrl);
  authUrl.searchParams.set("client_id", process.env[p.clientIdEnv] as string);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", p.scopes);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(authUrl.toString(), 302);
  res.cookies.set(`vr_oauth_acct_${provider}`, nonce, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
