// Tests for lib/auth0-login.ts and the /api/login routes: login with Vraelis-issued credentials through Auth0
// (founder, 2026-10-22/23), with Codex's LOGIN-01 (sealed, expiring transaction; re-validated destination) and LOGIN-02
// (required sub/exp/iat; azp). Run: npm run login:test. No network: Auth0's token and JWKS endpoints are mocked, and
// id_tokens are signed with locally generated keys.
import { SignJWT, base64url, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { auth0Config, authorizeUrl, cleanLoginTicket, cleanOrganization, cleanReturnTo, exchangeCode, loginOpen, logoutUrl, openTransaction,
  pkcePair, safeDestination, sealTransaction, transactionKey, verifyIdToken } from "../lib/auth0-login";

let pass = 0, fail = 0;
const t = async (name: string, fn: () => unknown | Promise<unknown>) => {
  try { await fn(); pass++; console.log(`PASS  ${name}`); } catch (e) { fail++; console.log(`FAIL  ${name}: ${(e as Error).message}`); }
};
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const rejects = async (p: Promise<unknown>, m: string) => { try { await p; } catch { return; } throw new Error(`${m}: was accepted`); };

const KEY = base64url.encode(crypto.getRandomValues(new Uint8Array(32)));
const ENV = { AUTH0_DOMAIN: "vraelis-test.us.auth0.com", AUTH0_CLIENT_ID: "client123", VRAELIS_LOGIN_OPEN: "1", LOGIN_COOKIE_SECRET: KEY };
const cfg = auth0Config(ENV)!;
const key = transactionKey(ENV)!;
const TX = { state: "st1", nonce: "n1", verifier: "ver1", returnTo: "/login" };

async function main() {
  // ---- gating ----
  await t("closed by default: no env", () => eq(loginOpen({}), false));
  await t("closed without the reviewed switch", () => eq(loginOpen({ ...ENV, VRAELIS_LOGIN_OPEN: undefined }), false));
  await t("closed without a transaction key (LOGIN-01)", () => eq(loginOpen({ ...ENV, LOGIN_COOKIE_SECRET: undefined }), false));
  await t("closed with a short transaction key", () => eq(loginOpen({ ...ENV, LOGIN_COOKIE_SECRET: base64url.encode(new Uint8Array(16)) }), false));
  await t("closed with switch but no Auth0", () => eq(loginOpen({ VRAELIS_LOGIN_OPEN: "1", LOGIN_COOKIE_SECRET: KEY }), false));
  await t("closed when switch is not exactly 1", () => eq(loginOpen({ ...ENV, VRAELIS_LOGIN_OPEN: "true" }), false));
  await t("open with all three", () => eq(loginOpen(ENV), true));
  await t("domain normalised; bad domain and bad realm refused", () => {
    eq(auth0Config({ ...ENV, AUTH0_DOMAIN: "https://vraelis-test.us.auth0.com/" })!.domain, "vraelis-test.us.auth0.com");
    eq(auth0Config({ ...ENV, AUTH0_DOMAIN: "evil.com/x?y" }), null);
    eq(auth0Config({ ...ENV, AUTH0_DB_CONNECTION: "a b" }), null);
    eq(cfg.realm, "Username-Password-Authentication");
  });

  // ---- authorize request ----
  await t("PKCE: S256 challenge of the verifier, URL-safe", async () => {
    const { verifier, challenge } = await pkcePair();
    eq(challenge, Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url"));
  });
  await t("authorize URL: code + PKCE + ticket + realm + organization; no sign-up, no social connection", () => {
    const u = new URL(authorizeUrl(cfg, { redirectUri: "https://vraelis.com/api/login/callback", state: "s", nonce: "n", challenge: "c", loginTicket: "TICKET_abcdefghijkl", organization: "org_abc12345" }));
    const p = Object.fromEntries(u.searchParams);
    eq([u.pathname, p.response_type, p.code_challenge_method, p.login_ticket, p.realm, p.organization], ["/authorize", "code", "S256", "TICKET_abcdefghijkl", "Username-Password-Authentication", "org_abc12345"]);
    for (const k of ["screen_hint", "connection", "client_secret", "password"]) if (k in p) throw new Error(`unexpected ${k}`);
  });
  await t("inputs are allow-listed", () => {
    eq(cleanLoginTicket("abc_DEF-123.456~7890"), "abc_DEF-123.456~7890"); eq(cleanLoginTicket("short"), undefined); eq(cleanLoginTicket("a b".repeat(10)), undefined);
    eq(cleanOrganization("Acme-Robotics"), "acme-robotics"); eq(cleanOrganization("org_abc12345"), "org_abc12345"); eq(cleanOrganization("x&y=z"), undefined);
    eq(cleanReturnTo("/contour"), "/contour"); eq(cleanReturnTo("//evil.com"), "/login"); eq(cleanReturnTo("https://evil.com"), "/login"); eq(cleanReturnTo("/api/x"), "/login");
  });

  // ---- LOGIN-01: sealed transaction and destination ----
  await t("transaction: round trip", async () => eq(await openTransaction(await sealTransaction(TX, key), key), TX));
  await t("transaction: one altered character is rejected", async () => {
    const s = await sealTransaction(TX, key); const i = s.length - 5;
    eq(await openTransaction(s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1), key), null);
  });
  await t("transaction: sealed under another key is rejected", async () => {
    eq(await openTransaction(await sealTransaction(TX, crypto.getRandomValues(new Uint8Array(32))), key), null);
  });
  await t("transaction: plain JSON (the old format) is rejected", async () => eq(await openTransaction(JSON.stringify(TX), key), null));
  await t("transaction: expired (issued 11 minutes ago) is rejected", async () => {
    eq(await openTransaction(await sealTransaction(TX, key, Math.floor(Date.now() / 1000) - 660), key), null);
  });
  await t("transaction: missing field is rejected", async () => {
    eq(await openTransaction(await sealTransaction({ ...TX, verifier: "" }, key), key), null);
  });
  await t("destination: same-origin paths only, re-validated", () => {
    const o = "https://vraelis.com";
    eq(safeDestination("/contour", o).href, "https://vraelis.com/contour");
    for (const bad of ["//outside.example.test/after-login", "https://outside.example.test/", "/\\outside.example.test", "javascript:alert(1)", "/api/login/start"])
      eq(safeDestination(bad, o).href, "https://vraelis.com/login", bad);
  });

  // ---- LOGIN-02: id_token claims ----
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const now = Math.floor(Date.now() / 1000);
  type O = { iss?: string; aud?: string | string[]; exp?: number | null; iat?: number | null; sub?: string | null; key?: CryptoKey };
  const sign = (claims: Record<string, unknown>, o: O = {}) => {
    const body: Record<string, unknown> = { ...claims };
    if (o.sub !== null) body.sub = o.sub ?? "auth0|abc123";
    if (o.iat !== null) body.iat = o.iat ?? now;
    if (o.exp !== null) body.exp = o.exp ?? now + 300;
    return new SignJWT(body).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(o.iss ?? "https://vraelis-test.us.auth0.com/").setAudience(o.aud ?? "client123").sign(o.key ?? privateKey);
  };
  const v = async (tok: string, nonce?: string) => verifyIdToken(cfg, tok, nonce, keys as never);
  await t("id_token: valid token verifies", async () => eq((await v(await sign({ email: "x@y.co", nonce: "n1" }), "n1")).email, "x@y.co"));
  await t("id_token: missing sub rejected (LOGIN-02)", async () => rejects(v(await sign({}, { sub: null })), "no sub"));
  await t("id_token: empty sub rejected", async () => rejects(v(await sign({}, { sub: "  " })), "empty sub"));
  await t("id_token: missing exp rejected (LOGIN-02)", async () => rejects(v(await sign({}, { exp: null })), "no exp"));
  await t("id_token: missing iat rejected (LOGIN-02)", async () => rejects(v(await sign({}, { iat: null })), "no iat"));
  await t("id_token: none of sub/exp/iat rejected (Codex probe)", async () => rejects(v(await sign({ nonce: "n1" }, { sub: null, exp: null, iat: null }), "n1"), "bare"));
  await t("id_token: iat in the future rejected", async () => rejects(v(await sign({}, { iat: now + 3600 })), "future iat"));
  await t("id_token: several audiences without azp rejected", async () => rejects(v(await sign({}, { aud: ["client123", "other"] })), "multi aud"));
  await t("id_token: several audiences with azp = client accepted", async () => { await v(await sign({ azp: "client123" }, { aud: ["client123", "other"] })); });
  await t("id_token: azp naming another client rejected", async () => rejects(v(await sign({ azp: "other" })), "azp"));
  await t("id_token: wrong nonce rejected", async () => rejects(v(await sign({ nonce: "n1" }), "n2"), "nonce"));
  await t("id_token: wrong issuer rejected", async () => rejects(v(await sign({}, { iss: "https://evil.auth0.com/" })), "iss"));
  await t("id_token: wrong audience rejected", async () => rejects(v(await sign({}, { aud: "other" })), "aud"));
  await t("id_token: expired rejected", async () => rejects(v(await sign({}, { exp: now - 60, iat: now - 600 })), "exp"));
  await t("id_token: signed by another key rejected", async () => rejects(v(await sign({}, { key: other.privateKey })), "sig"));
  await t("id_token: alg none rejected", async () => {
    const h = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"), b = Buffer.from(JSON.stringify({ iss: "https://vraelis-test.us.auth0.com/", aud: "client123", sub: "x", iat: now, exp: now + 300 })).toString("base64url");
    await rejects(v(`${h}.${b}.`), "none");
  });
  await t("code exchange: sends verifier, no secret for a public client; failure is generic", async () => {
    let sent: Record<string, string> = {};
    const ok = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ id_token: "tok" }), { status: 200 }); }) as unknown as typeof fetch;
    eq(await exchangeCode(cfg, "code1", "ver1", "https://vraelis.com/api/login/callback", ok), "tok");
    eq([sent.grant_type, sent.code_verifier, "client_secret" in sent], ["authorization_code", "ver1", false]);
    const bad = (async () => new Response('{"error":"invalid_grant","error_description":"secret detail"}', { status: 403 })) as unknown as typeof fetch;
    try { await exchangeCode(cfg, "c", "v", "r", bad); throw new Error("no throw"); } catch (e) { eq((e as Error).message, "token exchange failed"); }
  });
  await t("logout URL returns to /login", () => {
    const u = new URL(logoutUrl(cfg, "https://vraelis.com/login")); eq([u.pathname, u.searchParams.get("returnTo")], ["/v2/logout", "https://vraelis.com/login"]);
  });

  // ---- routes (mocked Auth0: /oauth/token and /.well-known/jwks.json) ----
  const { NextRequest } = await import("next/server");
  const { STATE_COOKIE, SESSION_COOKIE } = await import("../lib/auth0-login");
  const start = await import("../app/api/login/start/route");
  const callback = (await import("../app/api/login/callback/route")).GET;
  const setEnv = (e: Record<string, string | undefined>) => { for (const k of ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "VRAELIS_LOGIN_OPEN", "LOGIN_COOKIE_SECRET"]) { if (e[k] === undefined) delete process.env[k]; else process.env[k] = e[k]; } };
  let tokenToReturn = "";
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://vraelis-test.us.auth0.com/.well-known/jwks.json") return new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "https://vraelis-test.us.auth0.com/oauth/token") return new Response(JSON.stringify({ id_token: tokenToReturn }), { status: 200 });
    return realFetch(input as never, init);
  }) as typeof fetch;
  const form = (fields: Record<string, string>, headers: Record<string, string> = {}) =>
    new NextRequest("https://vraelis.com/api/login/start", { method: "POST", body: new URLSearchParams(fields), headers: { "content-type": "application/x-www-form-urlencoded", ...headers } });
  const cookieHeader = (sealed: string) => ({ cookie: `${STATE_COOKIE}=${sealed}` });
  const cb = (qs: string, sealed?: string) => callback(new NextRequest(`https://vraelis.com/api/login/callback?${qs}`, { headers: sealed ? cookieHeader(sealed) : {} }));

  await t("route: closed start (POST) redirects to /login?closed=1, sets no cookie", async () => {
    setEnv({}); const r = await start.POST(form({ login_ticket: "abcdefghijklmnopqrst" }));
    eq([r.status, r.headers.get("location"), r.headers.get("set-cookie")], [303, "https://vraelis.com/login?closed=1", null]);
  });
  await t("route: GET start starts nothing", async () => { setEnv(ENV); const r = await start.GET(new NextRequest("https://vraelis.com/api/login/start")); eq(r.headers.get("location"), "https://vraelis.com/login"); });
  await t("route: open start with a ticket goes to Auth0 with a sealed (non-JSON) state cookie", async () => {
    setEnv(ENV); const r = await start.POST(form({ login_ticket: "abcdefghijklmnopqrst", organization: "Acme" }, { origin: "https://vraelis.com" }));
    const loc = new URL(r.headers.get("location")!), ck = r.headers.get("set-cookie") ?? "";
    eq([r.status, loc.host, loc.searchParams.get("login_ticket"), loc.searchParams.get("organization")], [303, "vraelis-test.us.auth0.com", "abcdefghijklmnopqrst", "acme"]);
    const val = decodeURIComponent(ck.split(";")[0].split("=").slice(1).join("="));
    if (val.startsWith("{") || val.split(".").length !== 5) throw new Error("state cookie is not a sealed JWE");
    if (!/HttpOnly/i.test(ck) || !/SameSite=lax/i.test(ck)) throw new Error(`cookie flags: ${ck}`);
  });
  await t("route: start without a valid ticket is refused", async () => { setEnv(ENV); eq((await start.POST(form({ login_ticket: "x" }))).headers.get("location"), "https://vraelis.com/login?error=state"); });
  await t("route: start from another origin is refused", async () => {
    setEnv(ENV); eq((await start.POST(form({ login_ticket: "abcdefghijklmnopqrst" }, { origin: "https://evil.example" }))).headers.get("location"), "https://vraelis.com/login?error=state");
  });
  await t("route: callback success sets a session and goes to the saved same-origin path", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1", email: "x@y.co" });
    const r = await cb("code=c1&state=st1", await sealTransaction({ ...TX, returnTo: "/contour" }, key));
    eq([r.status, r.headers.get("location")], [303, "https://vraelis.com/contour"]);
    if (!new RegExp(`${SESSION_COOKIE}=[^;]`).test(r.headers.get("set-cookie") ?? "")) throw new Error("no session");
  });
  await t("route: callback never redirects off-site, even if a transaction carried //outside (LOGIN-01)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" });
    const r = await cb("code=c1&state=st1", await sealTransaction({ ...TX, returnTo: "//outside.example.test/after-login" }, key));
    eq(r.headers.get("location"), "https://vraelis.com/login");
  });
  await t("route: callback with an altered transaction cookie is refused, no session (LOGIN-01)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" });
    const s = await sealTransaction(TX, key); const i = s.length - 5;
    const r = await cb("code=c1&state=st1", s.slice(0, i) + (s[i] === "A" ? "B" : "A") + s.slice(i + 1));
    eq(r.headers.get("location"), "https://vraelis.com/login?error=state");
    if (new RegExp(`${SESSION_COOKIE}=[^;]`).test(r.headers.get("set-cookie") ?? "")) throw new Error("session set");
  });
  await t("route: callback with the old plain-JSON cookie format is refused (Codex probe)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" });
    const r = await callback(new NextRequest("https://vraelis.com/api/login/callback?code=c1&state=st1", { headers: { cookie: `${STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ ...TX, returnTo: "//outside.example.test/" }))}` } }));
    eq(r.headers.get("location"), "https://vraelis.com/login?error=state");
  });
  await t("route: callback with an expired transaction is refused (LOGIN-01)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" });
    eq((await cb("code=c1&state=st1", await sealTransaction(TX, key, now - 700))).headers.get("location"), "https://vraelis.com/login?error=state");
  });
  await t("route: callback with mismatched state is refused", async () => {
    setEnv(ENV); eq((await cb("code=c1&state=WRONG", await sealTransaction(TX, key))).headers.get("location"), "https://vraelis.com/login?error=state");
  });
  await t("route: callback whose id_token lacks sub/exp/iat sets no session (LOGIN-02)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" }, { sub: null, exp: null, iat: null });
    const r = await cb("code=c1&state=st1", await sealTransaction(TX, key));
    eq(r.headers.get("location"), "https://vraelis.com/login?error=verify");
  });
  await t("route: the transaction cookie is cleared on success and on failure (stated consumption semantics)", async () => {
    setEnv(ENV); tokenToReturn = await sign({ nonce: "n1" });
    for (const qs of ["code=c1&state=st1", "code=c1&state=WRONG"]) {
      const ck = (await cb(qs, await sealTransaction(TX, key))).headers.get("set-cookie") ?? "";
      if (!new RegExp(`${STATE_COOKIE}=;[^,]*Max-Age=0`, "i").test(ck)) throw new Error(`not cleared for ${qs}: ${ck}`);
    }
  });
  await t("route: callback while closed is refused", async () => { setEnv({}); eq((await cb("code=c&state=s")).headers.get("location"), "https://vraelis.com/login?error=closed"); });
  globalThis.fetch = realFetch;
  setEnv({});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
