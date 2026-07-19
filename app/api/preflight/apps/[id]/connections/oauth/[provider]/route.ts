// Connection-OAuth INITIATE. GET /api/preflight/apps/[id]/connections/[provider]/oauth
//
// Editor+ gate -> mint signed state (binds appId + owner + provider + nonce, HMAC under AUTH_SECRET,
// 10-min TTL) + a matching httpOnly nonce cookie -> 302 to the provider's authorize screen. The appId
// travels in signed state, NOT in the callback URL, so one fixed redirect URI serves every application.
//
// Fails CLOSED: no vault -> 503; provider unknown -> 404; provider's OAuth app credentials missing from the
// environment -> 302 back to the connections page with reason=server_misconfigured (never a half-built
// redirect to the provider).
import { NextResponse } from "next/server";
import { gatePreflightApp, gateReasonResponse } from "@/lib/preflight/team-access";
import { vaultConfigured } from "@/lib/preflight/secret-vault";
import { resolveOAuthProvider, providerAvailable, callbackPath, buildAuthorizeUrl } from "@/lib/preflight/oauth/providers";
import { signOAuthState, newNonce } from "@/lib/preflight/oauth/state";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  // Honor the forwarded host so the registered redirect URI (vraelis.com) is produced in production; the
  // provider must have this exact callback URL registered.
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function backToConnections(req: Request, appId: string, params: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/applications/${appId}/settings/connections?${params}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; provider: string }> }) {
  const { id: appId, provider } = await ctx.params;

  const g = await gatePreflightApp(appId, "editor");
  if (!g.ok) return gateReasonResponse(g.reason);
  const owner = g.owner;

  const p = resolveOAuthProvider(provider);
  if (!p) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  if (!vaultConfigured()) return NextResponse.json({ error: "vault_unconfigured" }, { status: 503 });
  if (!providerAvailable(p)) return backToConnections(req, appId, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  const nonce = newNonce();
  const state = signOAuthState({ appId, owner, provider, nonce });
  const redirectUri = `${baseUrl(req)}${callbackPath(provider)}`;
  const authUrl = buildAuthorizeUrl(p, { state, redirectUri });
  if (!authUrl) return backToConnections(req, appId, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  const res = NextResponse.redirect(authUrl, 302);
  // Nonce cookie: a belt-and-suspenders match the callback re-checks against the signed state's nonce.
  res.cookies.set(`vr_oauth_${provider}`, nonce, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  // Popup mode: the callback closes the popup and messages the opener instead of redirecting.
  if (new URL(req.url).searchParams.get("popup") === "1") {
    res.cookies.set("vr_oauth_popup", "1", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  }
  return res;
}
