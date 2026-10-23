import { EncryptJWT, base64url, createRemoteJWKSet, jwtDecrypt, jwtVerify, type JWTPayload } from "jose";

// SIGN-IN WITH VRAELIS-ISSUED CREDENTIALS THROUGH AUTH0 (founder, 2026-10-22: "like scale add a login page ... we are
// partnering with Auth0 soon"; 2026-10-23: "WE give them credentials (with their team, country, org, individual
// whatever) no login with google or git ... say secured with auth0").
// The credentials form is on /login, but the password never reaches this site: the browser sends it straight to Auth0
// (cross-origin authentication, POST https://<AUTH0_DOMAIN>/co/authenticate) and receives a single-use login ticket.
// Only that ticket comes to /api/login/start, which then runs the normal authorization-code flow with PKCE, state and
// nonce, and /api/login/callback verifies the id_token. No social or third-party sign-in is offered.
// Tenant requirements: a custom domain (e.g. auth.vraelis.com) so the cross-origin cookie is first-party, cross-origin
// authentication enabled on the application, https://vraelis.com in Allowed Web Origins and Allowed Origins (CORS),
// public sign-ups disabled on the database connection, and only the database connection enabled for the application.
// LOGIN ONLY (founder, 2026-10-22: "there's no sign up, it's only login"): no sign-up screen is ever requested.
// Accounts are created by Vraelis in the Auth0 tenant; turn off public sign-ups on the tenant's database connection.
//
// CLOSED BY DEFAULT. Sign-in opens only when BOTH are true, so a half-configured deployment can never collect anything:
//   - Auth0 is configured: AUTH0_DOMAIN and AUTH0_CLIENT_ID (AUTH0_CLIENT_SECRET when the application is confidential);
//   - VRAELIS_LOGIN_OPEN is exactly "1", an explicit, reviewed switch (product access is closed while the AI-security
//     product is built; see lib/app-availability.ts). Until then /login shows that accounts are not open yet.
// The earlier console's sign-in (/signin, /auth/*) is a different system and stays closed.

export type Auth0Config = { domain: string; clientId: string; clientSecret?: string; audience?: string; realm: string };

export function auth0Config(env: Record<string, string | undefined> = process.env): Auth0Config | null {
  const domain = (env.AUTH0_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const clientId = (env.AUTH0_CLIENT_ID ?? "").trim();
  if (!domain || !clientId || !/^[a-z0-9.-]+$/i.test(domain)) return null;
  const realm = (env.AUTH0_DB_CONNECTION ?? "").trim() || "Username-Password-Authentication";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(realm)) return null;
  return { domain, clientId, clientSecret: env.AUTH0_CLIENT_SECRET?.trim() || undefined, audience: env.AUTH0_AUDIENCE?.trim() || undefined, realm };
}

/** The key that encrypts and authenticates the login-transaction cookie (Codex LOGIN-01, 2026-10-23): LOGIN_COOKIE_SECRET,
 *  32 random bytes, base64url. Sign-in cannot open without it. Generate with: openssl rand -base64 32 | tr '+/' '-_' | tr -d '=' */
export function transactionKey(env: Record<string, string | undefined> = process.env): Uint8Array | null {
  try {
    const k = base64url.decode((env.LOGIN_COOKIE_SECRET ?? "").trim());
    return k.length === 32 ? k : null;
  } catch {
    return null;
  }
}

/** Whether sign-in is open: Auth0 configured, the transaction key set, AND the reviewed switch set. */
export function loginOpen(env: Record<string, string | undefined> = process.env): boolean {
  return env.VRAELIS_LOGIN_OPEN === "1" && auth0Config(env) !== null && transactionKey(env) !== null;
}


// Host-only, Secure, Path=/ in production (the __Host- prefix makes the browser enforce all three, so a sibling subdomain
// cannot plant or overwrite them). Plain names only on http://localhost, where the prefix is not allowed.
const SECURE = process.env.NODE_ENV === "production";
export const STATE_COOKIE = SECURE ? "__Host-vr_login_state" : "vr_login_state";
export const SESSION_COOKIE = SECURE ? "__Host-vr_session" : "vr_session";
export const STATE_MAX_AGE = 600; // ten minutes to finish signing in
export const SESSION_MAX_AGE = 60 * 60 * 8;

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = random(32);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(new Uint8Array(digest)) };
}

/** An Auth0 Organization, by id (org_...) or name. Accounts can belong to an organization or team, or to one person. */
export function cleanOrganization(raw: string | null): string | undefined {
  const v = (raw ?? "").trim().toLowerCase();
  return /^(org_[a-z0-9]{8,32}|[a-z0-9][a-z0-9_-]{1,49})$/.test(v) ? v : undefined;
}
/** The single-use ticket from /co/authenticate: opaque, URL-safe, bounded. */
export function cleanLoginTicket(raw: string | null): string | undefined {
  const v = raw ?? "";
  return /^[A-Za-z0-9_.~-]{16,512}$/.test(v) ? v : undefined;
}
/** Same-site return paths only; anything else returns to /login. */
export function cleanReturnTo(raw: string | null): string {
  const v = raw ?? "";
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(v) && !v.startsWith("/api/") ? v : "/login";
}

export function authorizeUrl(cfg: Auth0Config, o: { redirectUri: string; state: string; nonce: string; challenge: string; loginTicket: string; organization?: string }): string {
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
  p.set("login_ticket", o.loginTicket);
  p.set("realm", cfg.realm);
  if (o.organization) p.set("organization", o.organization);
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

export type Transaction = { state: string; nonce: string; verifier: string; returnTo: string };

/** Seal the login transaction (Codex LOGIN-01): AES-256-GCM (JWE dir), so it is both secret and tamper-evident, with its
 *  own issued-at and a ten-minute expiry that the server checks. The browser's Max-Age is no longer the only limit. */
export async function sealTransaction(tx: Transaction, key: Uint8Array, now = Math.floor(Date.now() / 1000)): Promise<string> {
  return new EncryptJWT({ ...tx }).setProtectedHeader({ alg: "dir", enc: "A256GCM" }).setIssuedAt(now).setExpirationTime(now + STATE_MAX_AGE)
    .setAudience("vraelis-login-transaction").encrypt(key);
}

/** Open a sealed transaction; null if it was altered, made with another key, expired, or malformed. */
export async function openTransaction(sealed: string | undefined, key: Uint8Array): Promise<Transaction | null> {
  if (!sealed) return null;
  try {
    const { payload } = await jwtDecrypt(sealed, key, { audience: "vraelis-login-transaction", requiredClaims: ["iat", "exp"], maxTokenAge: STATE_MAX_AGE });
    const { state, nonce, verifier, returnTo } = payload as Record<string, unknown>;
    if ([state, nonce, verifier, returnTo].some((v) => typeof v !== "string" || !v)) return null;
    return { state, nonce, verifier, returnTo } as Transaction;
  } catch {
    return null;
  }
}

/** Where to send the visitor after logging in: re-validated at the callback, and it must resolve to this origin. */
export function safeDestination(returnTo: string, origin: string): URL {
  const clean = cleanReturnTo(returnTo);
  const u = new URL(clean, origin);
  return u.origin === origin ? u : new URL("/login", origin);
}

/** Verify an Auth0 id_token: RS256 signature from the tenant's JWKS, issuer, audience, expiry, and (at callback) nonce.
 *  Codex LOGIN-02 (2026-10-23): sub, exp and iat are REQUIRED (OpenID Connect Core 2) and type-checked; a token issued
 *  to several audiences must name this client as its authorized party (azp). */
export async function verifyIdToken(cfg: Auth0Config, token: string, nonce?: string, keys?: Parameters<typeof jwtVerify>[1]): Promise<JWTPayload> {
  const issuer = `https://${cfg.domain}/`;
  let set = keys;
  if (!set) {
    if (!jwks.has(cfg.domain)) jwks.set(cfg.domain, createRemoteJWKSet(new URL(`https://${cfg.domain}/.well-known/jwks.json`)));
    set = jwks.get(cfg.domain)!;
  }
  const { payload } = await jwtVerify(token, set as never, { issuer, audience: cfg.clientId, algorithms: ["RS256"], requiredClaims: ["sub", "exp", "iat"] });
  if (typeof payload.sub !== "string" || !payload.sub.trim()) throw new Error("sub missing");
  if (typeof payload.exp !== "number" || typeof payload.iat !== "number" || !Number.isFinite(payload.iat)) throw new Error("exp/iat not numeric");
  if (payload.iat > Math.floor(Date.now() / 1000) + 60) throw new Error("iat in the future");
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== cfg.clientId) throw new Error("azp mismatch");
  if (payload.azp !== undefined && payload.azp !== cfg.clientId) throw new Error("azp mismatch");
  if (nonce !== undefined && payload.nonce !== nonce) throw new Error("nonce mismatch");
  return payload;
}

export function logoutUrl(cfg: Auth0Config, returnTo: string): string {
  const u = new URL(`https://${cfg.domain}/v2/logout`);
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("returnTo", returnTo);
  return u.toString();
}

export const cookieBase = { httpOnly: true, secure: SECURE, sameSite: "lax" as const, path: "/" };
