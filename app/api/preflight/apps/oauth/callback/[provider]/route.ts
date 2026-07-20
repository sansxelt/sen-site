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
import { resolveOAuthProvider, providerAvailable, callbackPath, clientId, clientSecret } from "@/lib/preflight/oauth/providers";
import { verifyOAuthState } from "@/lib/preflight/oauth/state";
import { pkceCookieName } from "@/lib/preflight/oauth/pkce";
import { addOAuthConnection } from "@/lib/preflight/connections-db";
import { addAccountOAuthConnection } from "@/lib/preflight/account-connections-db";

export const runtime = "nodejs";

function baseUrl(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
// POPUP MODE: when the flow was opened via window.open (the initiate route set vr_oauth_popup), the user
// never sees this tab — so instead of a 302 into a page they won't look at, return a minimal document that
// hands the outcome back and closes itself.
//
// It reports the result over BOTH channels, because window.opener is NOT reliable here: a provider in the
// navigation chain that sends Cross-Origin-Opener-Policy (Vercel does) permanently severs window.opener, so
// postMessage alone silently fails and the popup would strand itself. BroadcastChannel is same-origin and
// unaffected by COOP, so it gets through either way; localStorage is the last-resort ping for browsers
// without BroadcastChannel. Then it tries to close. If the browser refuses to close a window it no longer
// considers script-opened (another COOP side effect), we show a plain "you can close this" instead of
// silently navigating — the parent has already been told and updated.
function popupClose(req: Request, path: string, params: string): NextResponse {
  const origin = baseUrl(req);
  const target = `${origin}${path}?${params}`;
  const payload = JSON.stringify({ source: "vraelis-oauth", params });
  const html = `<!doctype html><meta charset="utf-8"><title>Finishing…</title>
<body style="font:14px system-ui;padding:32px;color:#4a463f;text-align:center">
<p id="m">Finishing up…</p>
<script>
(function(){
  var msg = ${payload};
  // 1. BroadcastChannel: survives COOP severing window.opener (Vercel's install chain does this).
  try { var bc = new BroadcastChannel("vraelis-oauth"); bc.postMessage(msg); bc.close(); } catch (e) {}
  // 2. opener.postMessage: works when the opener link is intact (GitHub, Stripe).
  try { if (window.opener && !window.opener.closed) window.opener.postMessage(msg, ${JSON.stringify(origin)}); } catch (e) {}
  // 3. localStorage ping: fallback for anything without BroadcastChannel.
  try { localStorage.setItem("vraelis-oauth", JSON.stringify({ params: msg.params, t: Date.now() })); } catch (e) {}

  try { window.close(); } catch (e) {}
  // If we're still here, the browser wouldn't close us. Tell the user plainly rather than navigating.
  setTimeout(function(){
    if (!window.closed) {
      document.getElementById("m").textContent = "All set. You can close this window.";
      var a = document.createElement("a");
      a.href = ${JSON.stringify(target)}; a.textContent = "Back to Connections";
      a.style.cssText = "display:inline-block;margin-top:12px;color:#0A7B54";
      document.body.appendChild(a);
    }
  }, 400);
})();
</script></body>`;
  const res = new NextResponse(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  res.cookies.delete("vr_oauth_popup");
  return res;
}

// Redirect back to the surface the flow came from: an app's Connections tab (per-app) or the account
// Connections page (account). In popup mode this closes the popup and messages the opener instead.
function backTo(req: Request, appId: string | undefined, params: string, popup = false): NextResponse {
  const path = appId ? `/applications/${appId}/settings/connections` : `/connections`;
  if (popup) return popupClose(req, path, params);
  return NextResponse.redirect(`${baseUrl(req)}${path}?${params}`, 302);
}
function backGeneric(req: Request, provider: string, reason: string, popup = false): NextResponse {
  const params = `oauth=error&provider=${provider}&reason=${reason}`;
  if (popup) return popupClose(req, "/connections", params);
  return NextResponse.redirect(`${baseUrl(req)}/connections?${params}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  // Popup mode was recorded by the initiate route; every exit path below closes the popup instead of
  // redirecting a tab the user never sees.
  const popup = (await cookies()).get("vr_oauth_popup")?.value === "1";

  const p = resolveOAuthProvider(provider);
  if (!p) return backGeneric(req, provider, "unknown_provider", popup);

  // A PKCE verifier is single-use. Clear it on EVERY exit from here on, success or failure, so a stale
  // verifier can never be paired with a later intercepted code.
  const exit = (res: NextResponse): NextResponse => {
    if (p.pkce) res.cookies.delete(pkceCookieName(provider));
    return res;
  };

  // verify + decode state; appId presence selects the flow.
  const state = stateRaw ? verifyOAuthState(stateRaw, { expectedProvider: provider }) : null;
  if (!state) return exit(backGeneric(req, provider, "bad_state", popup));
  const appId = state.appId; // undefined => account-level
  const cookieName = appId ? `vr_oauth_${provider}` : `vr_oauth_acct_${provider}`;

  const err = (reason: string) => exit(backTo(req, appId, `oauth=error&provider=${provider}&reason=${reason}`, popup));

  if (providerError) return err("denied");
  if (!code) return err("no_code");

  // nonce cookie double-check
  // Nonce cookie is belt-and-suspenders, NOT the gate: the signed HMAC state (tamper-proof, carries owner +
  // expiry) plus the owner re-check below is what actually authorizes this. If the cookie IS present it must
  // match (catches a swapped state); if it's ABSENT we continue, because a multi-hop provider flow (Vercel's
  // integration install bounces through several redirects) can legitimately drop a SameSite=Lax cookie on the
  // return leg, and hard-failing there rejects a perfectly valid, signed, owner-verified authorization.
  const cookieNonce = (await cookies()).get(cookieName)?.value;
  if (cookieNonce && cookieNonce !== state.nonce) return err("state_mismatch");

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
  // PKCE: the verifier proves this exchange comes from the browser that started the flow. Unlike the nonce
  // cookie above this one IS a hard gate — without it the provider rejects the exchange anyway, and silently
  // proceeding without it would be exactly the downgrade PKCE exists to prevent.
  const codeVerifier = p.pkce ? (await cookies()).get(pkceCookieName(provider))?.value : undefined;
  if (p.pkce && !codeVerifier) return err("pkce_verifier_missing");
  try {
    const body = new URLSearchParams({
      client_id: clientId(p),
      client_secret: clientSecret(p),
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
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

  const res = exit(backTo(req, appId, `oauth=connected&provider=${provider}`, popup));
  res.cookies.delete(cookieName);
  return res;
}
