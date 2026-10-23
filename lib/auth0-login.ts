import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// SIGN-IN THROUGH AUTH0 UNIVERSAL LOGIN (founder, 2026-10-22: "like scale add a login page ... we are partnering with
// Auth0 soon"). The site never handles a password: /login sends the visitor to Auth0's hosted page with the
// authorization-code flow and PKCE, and /api/login/callback verifies the result.
// LOGIN ONLY (founder, 2026-10-22: "there's no sign up, it's only login"): no sign-up screen is ever requested.
// Accounts are created by Vraelis in the Auth0 tenant; turn off public sign-ups on the tenant's database connection.
//
// CLOSED BY DEFAULT. Sign-in opens only when BOTH are true, so a half-configured deployment can never collect anything:
//   - Auth0 is configured: AUTH0_DOMAIN and AUTH0_CLIENT_ID (AUTH0_CLIENT_SECRET when the application is confidential);
//   - VRAELIS_LOGIN_OPEN is exactly "1", an explicit, reviewed switch (product access is closed while the AI-security
//     product is built; see lib/app-availability.ts). Until then /login shows that accounts are not open yet.
// The earlier console's sign-in (/signin, /auth/*) is a different system and stays closed.

export type Auth0Config = { domain: string; clientId: string; clientSecret?: string; audience?: string };

export function auth0Config(env: Record<string, string | undefined> = process.env): Auth0Config | null {
  const domain = (env.AUTH0_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const clientId = (env.AUTH0_CLIENT_ID ?? "").trim();
  if (!domain || !clientId || !/^[a-z0-9.-]+$/i.test(domain)) return null;
  return { domain, clientId, clientSecret: env.AUTH0_CLIENT_SECRET?.trim() || undefined, audience: env.AUTH0_AUDIENCE?.trim() || undefined };
}

/** Whether sign-in is open: Auth0 configured AND the reviewed switch set. */
export function loginOpen(env: Record<string, string | undefined> = process.env): boolean {
  return env.VRAELIS_LOGIN_OPEN === "1" && auth0Config(env) !== null;
}

/** Connections offered on /login. Their names must match the Auth0 tenant's connection names. */
export const CONNECTIONS = { google: "google-oauth2" } as const;

export const STATE_COOKIE = "vr_login_state";
export const SESSION_COOKIE = "vr_session";
export const STATE_MAX_AGE = 600; // ten minutes to finish signing in
export const SESSION_MAX_AGE = 60 * 60 * 8;

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = random(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/** Only allow-listed values travel to Auth0: a well-formed email as login_hint, and a known connection or none. */
export function cleanHint(raw: string | null): string | undefined {
  const v = (raw ?? "").trim();
  return v && v.length <= 254 && EMAIL.test(v) ? v : undefined;
}
export function cleanConnection(raw: string | null): string | undefined {
  return Object.values(CONNECTIONS).find((c) => c === raw);
}
/** Same-site return paths only; anything else returns to /login. */
export function cleanReturnTo(raw: string | null): string {
  const v = raw ?? "";
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(v) && !v.startsWith("/api/") ? v : "/login";
}

export function authorizeUrl(cfg: Auth0Config, o: { redirectUri: string; state: string; nonce: string; challenge: string; loginHint?: string; connection?: string }): string {
  const u = new URL(`https://${cfg.domain}/authorize`);
  const p = u.searchParams;
  p.set("response_type", "code");
  p.set("client_id", cfg.clientId);
  p.set("redirect_uri", o.redirectUri);
  p.set("scope", "openid profile email");
  p.set("state", o.state);
  p.set("nonce", o.nonce);
  p.set("code_challenge", o.challenge);
  p.set("code_challenge_method", "S256");
  if (cfg.audience) p.set("audience", cfg.audience);
  if (o.loginHint) p.set("login_hint", o.loginHint);
  if (o.connection) p.set("connection", o.connection);
  return u.toString();
}

export function newState(): { state: string; nonce: string } {
  return { state: random(24), nonce: random(24) };
}

/** Exchange the authorization code; returns the id_token or throws with a generic message (no token content). */
export async function exchangeCode(cfg: Auth0Config, code: string, verifier: string, redirectUri: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const body: Record<string, string> = { grant_type: "authorization_code", client_id: cfg.clientId, code, code_verifier: verifier, redirect_uri: redirectUri };
  if (cfg.clientSecret) body.client_secret = cfg.clientSecret;
  const res = await fetchImpl(`https://${cfg.domain}/oauth/token`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!res.ok) throw new Error("token exchange failed");
  const json = (await res.json()) as { id_token?: unknown };
  if (typeof json.id_token !== "string") throw new Error("no id_token in response");
  return json.id_token;
}

const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/** Verify an Auth0 id_token: RS256 signature from the tenant's JWKS, issuer, audience, expiry, and (at callback) nonce. */
export async function verifyIdToken(cfg: Auth0Config, token: string, nonce?: string, keys?: Parameters<typeof jwtVerify>[1]): Promise<JWTPayload> {
  const issuer = `https://${cfg.domain}/`;
  let set = keys;
  if (!set) {
    if (!jwks.has(cfg.domain)) jwks.set(cfg.domain, createRemoteJWKSet(new URL(`https://${cfg.domain}/.well-known/jwks.json`)));
    set = jwks.get(cfg.domain)!;
  }
  const { payload } = await jwtVerify(token, set as never, { issuer, audience: cfg.clientId, algorithms: ["RS256"] });
  if (nonce !== undefined && payload.nonce !== nonce) throw new Error("nonce mismatch");
  return payload;
}

export function logoutUrl(cfg: Auth0Config, returnTo: string): string {
  const u = new URL(`https://${cfg.domain}/v2/logout`);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("returnTo", returnTo);
  return u.toString();
}

export const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
