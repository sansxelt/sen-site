// Tests for lib/auth0-login.ts and the /api/login routes (founder, 2026-10-22: Auth0 login page, login only).
// Run: npx tsx scripts/login-auth0.test.ts. No network: id_tokens are signed with locally generated keys.
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { auth0Config, authorizeUrl, cleanConnection, cleanHint, cleanReturnTo, exchangeCode, loginOpen, logoutUrl, pkcePair, verifyIdToken } from "../lib/auth0-login";

let pass = 0, fail = 0;
const t = async (name: string, fn: () => unknown | Promise<unknown>) => {
  try { await fn(); pass++; console.log(`PASS  ${name}`); } catch (e) { fail++; console.log(`FAIL  ${name}: ${(e as Error).message}`); }
};
const eq = (a: unknown, b: unknown, m = "") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const throws = async (fn: () => Promise<unknown>, m: string) => { try { await fn(); } catch { return; } throw new Error(`${m}: did not throw`); };

const ENV = { AUTH0_DOMAIN: "vraelis-test.us.auth0.com", AUTH0_CLIENT_ID: "client123", VRAELIS_LOGIN_OPEN: "1" };
const cfg = auth0Config(ENV)!;

async function main() {
  await t("closed by default: no env", () => eq(loginOpen({}), false));
  await t("closed without the reviewed switch", () => eq(loginOpen({ ...ENV, VRAELIS_LOGIN_OPEN: undefined }), false));
  await t("closed with switch but no Auth0", () => eq(loginOpen({ VRAELIS_LOGIN_OPEN: "1" }), false));
  await t("closed when switch is not exactly 1", () => eq(loginOpen({ ...ENV, VRAELIS_LOGIN_OPEN: "true" }), false));
  await t("open with both", () => eq(loginOpen(ENV), true));
  await t("domain normalised; bad domain refused", () => {
    eq(auth0Config({ ...ENV, AUTH0_DOMAIN: "https://vraelis-test.us.auth0.com/" })!.domain, "vraelis-test.us.auth0.com");
    eq(auth0Config({ ...ENV, AUTH0_DOMAIN: "evil.com/x?y" }), null);
  });
  await t("PKCE: S256 challenge of the verifier, URL-safe", async () => {
    const { verifier, challenge } = await pkcePair();
    const d = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
    eq(challenge, d); if (/[+/=]/.test(verifier + challenge)) throw new Error("not url-safe");
  });
  await t("authorize URL: code flow, PKCE, state, nonce; never a sign-up screen", () => {
    const u = new URL(authorizeUrl(cfg, { redirectUri: "https://vraelis.com/api/login/callback", state: "s", nonce: "n", challenge: "c", loginHint: "a@b.co", connection: "google-oauth2" }));
    eq(u.origin + u.pathname, "https://vraelis-test.us.auth0.com/authorize");
    const p = Object.fromEntries(u.searchParams);
    eq([p.response_type, p.client_id, p.state, p.nonce, p.code_challenge, p.code_challenge_method, p.login_hint, p.connection, p.scope],
       ["code", "client123", "s", "n", "c", "S256", "a@b.co", "google-oauth2", "openid profile email"]);
    if ("screen_hint" in p || "client_secret" in p) throw new Error("unexpected param");
  });
  await t("inputs are allow-listed", () => {
    eq(cleanHint("a@b.co"), "a@b.co"); eq(cleanHint("not an email"), undefined); eq(cleanHint("a@b.co\nx"), undefined);
    eq(cleanConnection("google-oauth2"), "google-oauth2"); eq(cleanConnection("Username-Password-Authentication"), undefined);
    eq(cleanReturnTo("/contour"), "/contour"); eq(cleanReturnTo("//evil.com"), "/login"); eq(cleanReturnTo("https://evil.com"), "/login");
    eq(cleanReturnTo("/api/login/start"), "/login"); eq(cleanReturnTo(null), "/login");
  });
  await t("logout URL returns to /login", () => {
    const u = new URL(logoutUrl(cfg, "https://vraelis.com/login"));
    eq([u.pathname, u.searchParams.get("client_id"), u.searchParams.get("returnTo")], ["/v2/logout", "client123", "https://vraelis.com/login"]);
  });

  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (claims: Record<string, unknown>, o: { iss?: string; aud?: string; exp?: string; key?: CryptoKey } = {}) =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(o.iss ?? "https://vraelis-test.us.auth0.com/")
      .setAudience(o.aud ?? "client123").setIssuedAt().setExpirationTime(o.exp ?? "5m").sign(o.key ?? privateKey);
  await t("id_token: valid token verifies and returns claims", async () => {
    const p = await verifyIdToken(cfg, await sign({ email: "x@y.co", nonce: "n1" }), "n1", keys as never); eq(p.email, "x@y.co");
  });
  await t("id_token: wrong nonce refused (direct)", async () => { const tok = await sign({ nonce: "n1" }); await throws(() => verifyIdToken(cfg, tok, "n2", keys as never), "nonce"); });
  await t("id_token: wrong issuer refused", async () => { const tok = await sign({}, { iss: "https://evil.auth0.com/" }); await throws(() => verifyIdToken(cfg, tok, undefined, keys as never), "iss"); });
  await t("id_token: wrong audience refused", async () => { const tok = await sign({}, { aud: "other" }); await throws(() => verifyIdToken(cfg, tok, undefined, keys as never), "aud"); });
  await t("id_token: expired refused", async () => { const tok = await sign({}, { exp: "-1m" }); await throws(() => verifyIdToken(cfg, tok, undefined, keys as never), "exp"); });
  await t("id_token: signed by another key refused", async () => { const tok = await sign({}, { key: other.privateKey }); await throws(() => verifyIdToken(cfg, tok, undefined, keys as never), "sig"); });
  await t("id_token: alg none refused", async () => {
    const h = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"), b = Buffer.from(JSON.stringify({ iss: "https://vraelis-test.us.auth0.com/", aud: "client123", exp: 9e9 })).toString("base64url");
    await throws(() => verifyIdToken(cfg, `${h}.${b}.`, undefined, keys as never), "none");
  });
  await t("code exchange: sends verifier, no secret for a public client; failure is generic", async () => {
    let sent: Record<string, string> = {};
    const ok = (async (_u: string, init: RequestInit) => { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ id_token: "tok" }), { status: 200 }); }) as unknown as typeof fetch;
    eq(await exchangeCode(cfg, "code1", "ver1", "https://vraelis.com/api/login/callback", ok), "tok");
    eq([sent.grant_type, sent.code, sent.code_verifier, "client_secret" in sent], ["authorization_code", "code1", "ver1", false]);
    const bad = (async () => new Response('{"error":"invalid_grant","error_description":"secret detail"}', { status: 403 })) as unknown as typeof fetch;
    try { await exchangeCode(cfg, "c", "v", "r", bad); throw new Error("no throw"); } catch (e) { eq((e as Error).message, "token exchange failed"); }
  });

  // Routes, with env set per case (the route modules read process.env at request time).
  const { NextRequest } = await import("next/server");
  const start = (await import("../app/api/login/start/route")).GET;
  const callback = (await import("../app/api/login/callback/route")).GET;
  const setEnv = (e: Record<string, string | undefined>) => { for (const k of ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "VRAELIS_LOGIN_OPEN"]) { if (e[k] === undefined) delete process.env[k]; else process.env[k] = e[k]; } };
  await t("route: closed start redirects to /login?closed=1 and sets no cookie", async () => {
    setEnv({}); const r = await start(new NextRequest("https://vraelis.com/api/login/start?email=a@b.co"));
    eq([r.status, r.headers.get("location"), r.headers.get("set-cookie")], [303, "https://vraelis.com/login?closed=1", null]);
  });
  await t("route: open start redirects to Auth0 with state cookie (httpOnly, lax)", async () => {
    setEnv(ENV); const r = await start(new NextRequest("https://vraelis.com/api/login/start?email=a@b.co&mode=signup"));
    const loc = new URL(r.headers.get("location")!); const ck = r.headers.get("set-cookie") ?? "";
    eq([r.status, loc.host, loc.searchParams.get("login_hint"), loc.searchParams.has("screen_hint")], [303, "vraelis-test.us.auth0.com", "a@b.co", false]);
    if (!/vr_login_state=/.test(ck) || !/HttpOnly/i.test(ck) || !/SameSite=lax/i.test(ck)) throw new Error(`cookie: ${ck}`);
  });
  await t("route: callback with mismatched state is refused, no session", async () => {
    setEnv(ENV);
    const req = new NextRequest("https://vraelis.com/api/login/callback?code=c&state=WRONG", { headers: { cookie: `vr_login_state=${encodeURIComponent(JSON.stringify({ state: "s", nonce: "n", verifier: "v", returnTo: "/login" }))}` } });
    const r = await callback(req);
    eq([r.status, r.headers.get("location")], [303, "https://vraelis.com/login?error=state"]);
    if (/vr_session=[^;]/.test(r.headers.get("set-cookie") ?? "")) throw new Error("session set");
  });
  await t("route: callback without state cookie is refused", async () => {
    setEnv(ENV); const r = await callback(new NextRequest("https://vraelis.com/api/login/callback?code=c&state=s"));
    eq(r.headers.get("location"), "https://vraelis.com/login?error=state");
  });
  await t("route: callback while closed is refused", async () => {
    setEnv({}); const r = await callback(new NextRequest("https://vraelis.com/api/login/callback?code=c&state=s"));
    eq(r.headers.get("location"), "https://vraelis.com/login?error=closed");
  });
  setEnv({});
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main();
