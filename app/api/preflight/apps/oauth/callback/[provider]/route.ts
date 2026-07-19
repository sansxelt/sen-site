// Connection-OAuth CALLBACK. GET /api/preflight/apps/oauth/callback/[provider]
//
// The provider redirects here after the user approves. This route runs mid-redirect with only the URL
// params (code + state) to go on, so it re-establishes trust from scratch:
//   1. verify the signed state (HMAC + exp) and extract { appId, owner, provider } — never trust a
//      client-supplied appId; it lives only inside the signed state
//   2. match the nonce cookie against the state's nonce (belt-and-suspenders)
//   3. re-gate: the CURRENT caller must STILL be an editor+ of the app in state (gatePreflightApp uses the
//      live session), and the resolved owner must equal the state's owner — so a forged/stolen callback
//      cannot attach a token to a victim's app, and a login-CSRF cannot attach a victim's provider account
//      to the attacker's app
//   4. exchange the code for a token via safeFetch (SSRF-pinned), optionally fetch an account label
//   5. seal the token in the vault (addOAuthConnection); never echo it to the client
// Every failure 302s back to the connections page with an ?oauth=error&reason=<code> the UI explains.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { safeFetch } from "@/lib/safe-fetch";
import { gatePreflightApp } from "@/lib/preflight/team-access";
import { vaultConfigured } from "@/lib/preflight/secret-vault";
import { resolveOAuthProvider, providerConfigured, callbackPath } from "@/lib/preflight/oauth/providers";
import { verifyOAuthState } from "@/lib/preflight/oauth/state";
import { addOAuthConnection } from "@/lib/preflight/connections-db";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
function back(req: Request, appId: string, params: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/applications/${appId}/settings/connections?${params}`, 302);
}
// When we cannot trust an appId (bad/missing state), bounce to the applications list rather than guess.
function backGeneric(req: Request, provider: string, reason: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/applications?oauth=error&provider=${provider}&reason=${reason}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const providerError = url.searchParams.get("error"); // provider denied / user cancelled

  const p = resolveOAuthProvider(provider);
  if (!p) return backGeneric(req, provider, "unknown_provider");

  // 1. verify + decode state
  const state = stateRaw ? verifyOAuthState(stateRaw, { expectedProvider: provider }) : null;
  if (!state) return backGeneric(req, provider, "bad_state");
  const { appId, owner: stateOwner } = state;

  if (providerError) return back(req, appId, `oauth=error&provider=${provider}&reason=denied`);
  if (!code) return back(req, appId, `oauth=error&provider=${provider}&reason=no_code`);

  // 2. nonce cookie double-check
  const cookieNonce = (await cookies()).get(`vr_oauth_${provider}`)?.value;
  if (!cookieNonce || cookieNonce !== state.nonce) return back(req, appId, `oauth=error&provider=${provider}&reason=state_mismatch`);

  // 3. re-gate the CURRENT caller as editor+ of the app in state, and confirm the owner matches
  const g = await gatePreflightApp(appId, "editor");
  if (!g.ok) return back(req, appId, `oauth=error&provider=${provider}&reason=forbidden`);
  if (g.owner !== stateOwner) return back(req, appId, `oauth=error&provider=${provider}&reason=owner_mismatch`);
  if (!vaultConfigured()) return back(req, appId, `oauth=error&provider=${provider}&reason=vault_unconfigured`);
  if (!providerConfigured(p)) return back(req, appId, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  // 4. exchange code -> token
  const redirectUri = `${baseUrl(req)}${callbackPath(provider)}`;
  type TokenResponse = { access_token?: string; refresh_token?: string; scope?: string; expires_in?: number };
  let token: TokenResponse | null = null;
  try {
    const body = new URLSearchParams({
      client_id: process.env[p.clientIdEnv] as string,
      client_secret: process.env[p.clientSecretEnv] as string,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const res = await safeFetch(p.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: p.tokenExchangeAccept },
      body: body.toString(),
    });
    if (!res.ok) return back(req, appId, `oauth=error&provider=${provider}&reason=exchange_failed`);
    token = (await res.json().catch(() => null)) as TokenResponse | null;
  } catch {
    return back(req, appId, `oauth=error&provider=${provider}&reason=exchange_failed`);
  }
  if (!token || !token.access_token) return back(req, appId, `oauth=error&provider=${provider}&reason=exchange_failed`);
  const tok: TokenResponse = token;

  // Optional identity label (best-effort; never blocks the connection).
  let account: string | undefined;
  if (p.identity) {
    try {
      const idRes = await safeFetch(p.identity.url, { headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json", "user-agent": "vraelis" } });
      if (idRes.ok) {
        const j = (await idRes.json().catch(() => ({}))) as Record<string, unknown>;
        const v = j[p.identity.field];
        if (typeof v === "string") account = v;
      }
    } catch { /* label is optional */ }
  }

  // 5. seal
  const saved = await addOAuthConnection(g.owner, appId, provider, {
    accessToken: tok.access_token as string,
    refreshToken: tok.refresh_token,
    scope: tok.scope ?? p.scopes,
    expiresIn: tok.expires_in,
    account,
  });
  if ("error" in saved) return back(req, appId, `oauth=error&provider=${provider}&reason=${saved.error}`);

  const res = back(req, appId, `oauth=connected&provider=${provider}`);
  res.cookies.delete(`vr_oauth_${provider}`);
  return res;
}
