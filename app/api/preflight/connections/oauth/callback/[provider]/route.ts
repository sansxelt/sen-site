// Account-level connection-OAuth CALLBACK. GET /api/preflight/connections/oauth/callback/[provider]
//
// The account analog of the per-app callback. Re-establishes trust from the signed state alone:
//   1. verify signed state (HMAC + exp) -> { owner, provider } (account state carries NO appId)
//   2. match the nonce cookie
//   3. require the CURRENT caller (live session) to BE the state's owner — the account analog of the
//      per-app owner_mismatch check, so a forged/stolen callback can't seal a token into a victim's account
//   4. exchange the code via safeFetch, optionally label the account
//   5. seal into v_account_connections (one grant per user+provider); never echo the token
// Every failure 302s to /connections?oauth=error&reason=<code>.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { safeFetch } from "@/lib/safe-fetch";
import { vaultConfigured } from "@/lib/preflight/secret-vault";
import { resolveOAuthProvider, providerConfigured, accountCallbackPath } from "@/lib/preflight/oauth/providers";
import { verifyOAuthState } from "@/lib/preflight/oauth/state";
import { addAccountOAuthConnection } from "@/lib/preflight/account-connections-db";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
function back(req: Request, params: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/connections?${params}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  const p = resolveOAuthProvider(provider);
  if (!p) return back(req, `oauth=error&provider=${provider}&reason=unknown_provider`);

  const state = stateRaw ? verifyOAuthState(stateRaw, { expectedProvider: provider }) : null;
  if (!state) return back(req, `oauth=error&provider=${provider}&reason=bad_state`);

  if (providerError) return back(req, `oauth=error&provider=${provider}&reason=denied`);
  if (!code) return back(req, `oauth=error&provider=${provider}&reason=no_code`);

  const cookieNonce = (await cookies()).get(`vr_oauth_acct_${provider}`)?.value;
  if (!cookieNonce || cookieNonce !== state.nonce) return back(req, `oauth=error&provider=${provider}&reason=state_mismatch`);

  // The current caller must be the state's owner (account analog of owner_mismatch).
  const email = (await auth())?.user?.email;
  const caller = email ? email.trim().toLowerCase() : null;
  if (!caller || caller !== state.owner) return back(req, `oauth=error&provider=${provider}&reason=owner_mismatch`);
  if (!vaultConfigured()) return back(req, `oauth=error&provider=${provider}&reason=vault_unconfigured`);
  if (!providerConfigured(p)) return back(req, `oauth=error&provider=${provider}&reason=server_misconfigured`);

  // exchange
  const redirectUri = `${baseUrl(req)}${accountCallbackPath(provider)}`;
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
    if (!res.ok) return back(req, `oauth=error&provider=${provider}&reason=exchange_failed`);
    token = (await res.json().catch(() => null)) as TokenResponse | null;
  } catch {
    return back(req, `oauth=error&provider=${provider}&reason=exchange_failed`);
  }
  if (!token || !token.access_token) return back(req, `oauth=error&provider=${provider}&reason=exchange_failed`);
  const tok: TokenResponse = token;

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

  const saved = await addAccountOAuthConnection(caller, provider, {
    accessToken: tok.access_token as string,
    refreshToken: tok.refresh_token,
    scope: tok.scope ?? p.scopes,
    expiresIn: tok.expires_in,
    account,
  });
  if ("error" in saved) return back(req, `oauth=error&provider=${provider}&reason=${saved.error}`);

  const res = back(req, `oauth=connected&provider=${provider}`);
  res.cookies.delete(`vr_oauth_acct_${provider}`);
  return res;
}
