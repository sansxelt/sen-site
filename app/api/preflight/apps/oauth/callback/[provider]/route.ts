// Connection-OAuth CALLBACK (unified). GET /api/preflight/apps/oauth/callback/[provider]
//
// One registered redirect URI serves BOTH flows — the signed state says which. Providers (e.g. GitHub)
// allow only one callback URL, so account-level and per-app share this path and branch on state.appId:
//   - state HAS appId  -> per-app: re-gate the caller as editor+ of that app, seal into v_app_connections
//   - state has NO appId -> account: require caller == state owner, seal into v_account_connections
// Both re-establish trust from the signed state alone (the callback runs mid-redirect): verify the HMAC +
// expiry, match the nonce cookie, exchange the code via safeFetch (SSRF-pinned), seal in the vault, and
// never echo the token. Every failure 302s to the right connections surface with an ?oauth=error&reason.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { safeFetch } from "@/lib/safe-fetch";
import { gatePreflightApp } from "@/lib/preflight/team-access";
import { vaultConfigured } from "@/lib/preflight/secret-vault";
import { resolveOAuthProvider, providerAvailable, callbackPath } from "@/lib/preflight/oauth/providers";
import { verifyOAuthState } from "@/lib/preflight/oauth/state";
import { addOAuthConnection } from "@/lib/preflight/connections-db";
import { addAccountOAuthConnection } from "@/lib/preflight/account-connections-db";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
// Redirect back to the surface the flow came from: an app's Connections tab (per-app) or the account
// Connections page (account).
function backTo(req: Request, appId: string | undefined, params: string): NextResponse {
  const path = appId ? `/applications/${appId}/settings/connections` : `/connections`;
  return NextResponse.redirect(`${baseUrl(req)}${path}?${params}`, 302);
}
function backGeneric(req: Request, provider: string, reason: string): NextResponse {
  return NextResponse.redirect(`${baseUrl(req)}/connections?oauth=error&provider=${provider}&reason=${reason}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  const p = resolveOAuthProvider(provider);
  if (!p) return backGeneric(req, provider, "unknown_provider");

  // verify + decode state; appId presence selects the flow.
  const state = stateRaw ? verifyOAuthState(stateRaw, { expectedProvider: provider }) : null;
  if (!state) return backGeneric(req, provider, "bad_state");
  const appId = state.appId; // undefined => account-level
  const cookieName = appId ? `vr_oauth_${provider}` : `vr_oauth_acct_${provider}`;

  const err = (reason: string) => backTo(req, appId, `oauth=error&provider=${provider}&reason=${reason}`);

  if (providerError) return err("denied");
  if (!code) return err("no_code");

  // nonce cookie double-check
  const cookieNonce = (await cookies()).get(cookieName)?.value;
  if (!cookieNonce || cookieNonce !== state.nonce) return err("state_mismatch");

  // Flow-specific authorization, re-established from the live session against the signed state.
  let sealOwner: string;
  if (appId) {
    // PER-APP: the current caller must STILL be an editor+ of the app in state, and the owner must match.
    const g = await gatePreflightApp(appId, "editor");
    if (!g.ok) return err("forbidden");
    if (g.owner !== state.owner) return err("owner_mismatch");
    sealOwner = g.owner;
  } else {
    // ACCOUNT: the current caller must BE the state owner.
    const email = (await auth())?.user?.email;
    const caller = email ? email.trim().toLowerCase() : null;
    if (!caller || caller !== state.owner) return err("owner_mismatch");
    sealOwner = caller;
  }
  if (!vaultConfigured()) return err("vault_unconfigured");
  if (!providerAvailable(p)) return err("server_misconfigured");

  // exchange code -> token
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
    if (!res.ok) return err("exchange_failed");
    token = (await res.json().catch(() => null)) as TokenResponse | null;
  } catch {
    return err("exchange_failed");
  }
  if (!token || !token.access_token) return err("exchange_failed");
  const tok: TokenResponse = token;

  // optional identity label
  let account: string | undefined;
  if (p.identity) {
    try {
      const idRes = await safeFetch(p.identity.url, { headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json", "user-agent": "vraelis" } });
      if (idRes.ok) {
        const j = (await idRes.json().catch(() => ({}))) as Record<string, unknown>;
        // identity.field may be a dot-path (Vercel returns { user: { username } }).
        const v = p.identity.field.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), j);
        if (typeof v === "string") account = v;
      }
    } catch { /* label is optional */ }
  }

  // Provider-specific callback/token params to persist (Vercel teamId/configurationId; Stripe
  // stripe_user_id). Read from BOTH the callback URL and the token response; used as the account label when
  // there is no identity endpoint (e.g. Stripe's connected-account id becomes the label).
  const tokenObj = tok as unknown as Record<string, unknown>;
  const persisted: Record<string, string> = {};
  for (const key of p.persistCallbackParams ?? []) {
    const v = url.searchParams.get(key) ?? (typeof tokenObj[key] === "string" ? (tokenObj[key] as string) : undefined);
    if (v) persisted[key] = v;
  }
  if (!account) account = persisted.stripe_user_id ?? persisted.teamId ?? undefined;

  // seal: account token or per-app connection, depending on the flow.
  const input = {
    accessToken: tok.access_token as string,
    refreshToken: tok.refresh_token,
    scope: tok.scope ?? p.scopes,
    expiresIn: tok.expires_in,
    account,
  };
  const saved = appId
    ? await addOAuthConnection(sealOwner, appId, provider, input)
    : await addAccountOAuthConnection(sealOwner, provider, input);
  if ("error" in saved) return err(saved.error);

  const res = backTo(req, appId, `oauth=connected&provider=${provider}`);
  res.cookies.delete(cookieName);
  return res;
}
