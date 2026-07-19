// EXECUTOR-ONLY token refresh for account OAuth connections. Some providers issue short-lived access tokens
// with a refresh token (Sentry ~8h, Supabase ~1d); before a consumer uses such a token it calls
// freshAccountToken() which refreshes-and-reseals when the stored token is expired or within a safety
// window. Providers whose tokens don't refresh (GitHub, Vercel, Stripe) return their stored token unchanged.
//
// Never call from a web render path — the refresh POST carries client_secret + refresh_token. It goes
// through safeFetch (SSRF-pinned) and the result is re-sealed via updateAccountOAuthTokens; the plaintext
// never leaves this module.
import { safeFetch } from "../../safe-fetch";
import { openAccountToken, updateAccountOAuthTokens } from "../account-connections-db";
import { resolveOAuthProvider } from "./providers";

// Refresh if the token expires within this window (or is already past it), so a consumer never starts work
// with a token about to die mid-request.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

function expiredOrSoon(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false; // no expiry known => treat as long-lived
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t - Date.now() <= REFRESH_SKEW_MS;
}

// Return a usable access token for the owner's account connection to `provider`, refreshing first if needed.
// null when there is no connection, no refresh is possible, or the refresh failed.
export async function freshAccountToken(owner: string, provider: string): Promise<string | null> {
  const current = await openAccountToken(owner, { provider });
  if (!current) return null;

  const p = resolveOAuthProvider(provider);
  // Not refreshable, or nothing to refresh with, or still valid => use the stored token as-is.
  if (!p?.refreshable || !current.refreshToken || !expiredOrSoon(current.expiresAt)) return current.accessToken;

  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) return current.accessToken; // can't refresh; fall back to the (maybe stale) token

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await safeFetch(p.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    });
    if (!res.ok) return null;
    const tok = (await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string } | null;
    if (!tok?.access_token) return null;
    // A provider may rotate the refresh token; persist whatever it returned (else keep the old one).
    await updateAccountOAuthTokens(owner, provider, {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token ?? current.refreshToken,
      expiresIn: tok.expires_in,
      scope: tok.scope,
    });
    return tok.access_token;
  } catch {
    return null;
  }
}
