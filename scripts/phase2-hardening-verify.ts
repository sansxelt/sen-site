// Phase 2 — CSRF, SSRF, cron secret comparison, auth fallbacks, session revocation.
// Behavioural against the real exported functions wherever the function is pure; source assertions only
// for wiring that cannot be exercised without a server or a database.
import { readFileSync } from "node:fs";
import { csrfVerdict, allowedOrigins } from "../lib/csrf";
import { isPrivateIp } from "../lib/safe-fetch";
import { secretsMatch, cronAuthorized } from "../lib/cron-auth";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");
// Comments in this codebase deliberately name the thing they removed ("no redirect: follow", the old
// literal, and so on). Asserting against raw source therefore matches the explanation instead of the code.
// codeOf strips line and block comments so a check means what it says.
const codeOf = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

// ── 1. CSRF: enforced only where ambient authority exists ─────────────────
console.log("── CSRF verdicts ──");
const SESSION = "__Secure-authjs.session-token=abc123; other=1";
const base = { host: "vraelis.com", proto: "https" };
const V = (o: Partial<Parameters<typeof csrfVerdict>[0]>) =>
  csrfVerdict({ method: "POST", cookieHeader: null, origin: null, secFetchSite: null, ...base, ...o });

// Protected class: session cookie + mutating method.
{
  const evil = V({ cookieHeader: SESSION, origin: "https://evil.test", secFetchSite: "cross-site" });
  ok("cross-origin POST with a session cookie is BLOCKED", evil.enforced && !evil.ok, evil.reason);
  const lookalike = V({ cookieHeader: SESSION, origin: "https://vraelis.com.evil.tld", secFetchSite: "cross-site" });
  ok("a look-alike suffix host is BLOCKED", lookalike.enforced && !lookalike.ok);
  const prefix = V({ cookieHeader: SESSION, origin: "https://evil-vraelis.com", secFetchSite: "cross-site" });
  ok("a look-alike prefix host is BLOCKED", prefix.enforced && !prefix.ok);
  const noOrigin = V({ cookieHeader: SESSION, origin: null, secFetchSite: null });
  ok("a missing Origin with a session cookie is BLOCKED", noOrigin.enforced && !noOrigin.ok, noOrigin.reason);
  const same = V({ cookieHeader: SESSION, origin: "https://vraelis.com", secFetchSite: "same-origin" });
  ok("same-origin POST is allowed", same.enforced && same.ok);
  const app = V({ cookieHeader: SESSION, origin: "https://app.vraelis.com", secFetchSite: "cross-site" });
  ok("the product subdomain is allowed", app.enforced && app.ok, app.reason);
  const sfs = V({ cookieHeader: SESSION, origin: null, secFetchSite: "same-origin" });
  ok("Sec-Fetch-Site same-origin is trusted without an Origin", sfs.enforced && sfs.ok);
  const nav = V({ cookieHeader: SESSION, origin: null, secFetchSite: "none" });
  ok("a user-initiated navigation is allowed", nav.enforced && nav.ok);
}
// Exempt classes: no ambient authority, so not enforced at all.
for (const [label, cookie] of [["webhook / cron / API key / CLI (no cookie)", null], ["a cookie that is not ours", "cf_bm=1; ajs_anonymous_id=2"]] as [string, string | null][]) {
  const r = V({ cookieHeader: cookie, origin: "https://stripe.com", secFetchSite: "cross-site" });
  ok(`${label} is NOT enforced`, r.enforced === false, r.reason);
}
ok("GET is never enforced", V({ method: "GET", cookieHeader: SESSION, origin: "https://evil.test" }).enforced === false);
for (const m of ["POST", "PUT", "PATCH", "DELETE"]) {
  ok(`${m} with a session cookie IS enforced`, V({ method: m, cookieHeader: SESSION, origin: "https://evil.test", secFetchSite: "cross-site" }).enforced === true);
}
ok("the allowlist is exact strings, never suffix matching",
  !read("lib/csrf.ts").includes("endsWith(") && !/origin\.includes\(/.test(read("lib/csrf.ts")));
ok("the product hosts are on the allowlist", allowedOrigins().includes("https://app.vraelis.com"));
{
  const px = read("proxy.ts");
  ok("the check runs in the one place every API request passes", px.includes("csrfVerdict({"));
  ok("a refusal is a 403, not a redirect", px.includes('{ error: "cross_origin_blocked" }, { status: 403 }'));
  ok("the check precedes the passthrough it guards", px.indexOf("csrfVerdict({") < px.indexOf("cross_origin_blocked"));
}

// ── 2. The state-changing GET is gone ─────────────────────────────────────
console.log("── state-changing GET ──");
{
  const d = read("app/api/vraelis/calendar/disconnect/route.ts");
  ok("disconnect is a POST", /export async function POST\(/.test(d));
  ok("its GET no longer mutates", !/export async function GET[\s\S]*setWorkspaceCalendar/.test(d));
  ok("its GET answers 405 with Allow: POST", d.includes("status: 405") && d.includes('Allow: "POST"'));
}

// ── 3. SSRF: extended address detection ───────────────────────────────────
console.log("── private address detection ──");
const MUST_BLOCK: [string, string][] = [
  ["IPv4 loopback", "127.0.0.1"], ["IPv4 private 10/8", "10.0.0.1"], ["IPv4 private 172.16/12", "172.16.0.1"],
  ["IPv4 private 192.168/16", "192.168.1.1"], ["cloud metadata", "169.254.169.254"], ["0.0.0.0", "0.0.0.0"],
  ["CGNAT 100.64/10", "100.64.0.1"], ["benchmark 198.18/15", "198.18.0.1"],
  ["IPv6 loopback", "::1"], ["IPv6 unspecified", "::"], ["ULA fc00::/7", "fc00::1"], ["ULA fd00::/8", "fd00::1"],
  ["link-local fe80::/10", "fe80::1"], ["site-local fec0::/10", "fec0::1"], ["multicast ff00::/8", "ff02::1"],
  ["IPv4-mapped dotted", "::ffff:127.0.0.1"],
  ["IPv4-mapped HEX", "::ffff:7f00:1"],
  ["IPv4-compatible hex", "::7f00:1"],
  ["IPv4-mapped hex private", "::ffff:a00:1"],
  ["NAT64 loopback", "64:ff9b::7f00:1"],
  ["NAT64 private", "64:ff9b::a00:1"],
  ["discard 100::/64", "100::1"],
  ["documentation 2001:db8::/32", "2001:db8::1"],
  ["benchmarking 2001:2::/48", "2001:2::1"],
  ["Teredo 2001::/32", "2001::1"],
];
for (const [label, ip] of MUST_BLOCK) ok(`blocks ${label} (${ip})`, isPrivateIp(ip) === true);
const MUST_ALLOW: [string, string][] = [
  ["public v4", "8.8.8.8"], ["public v4", "1.1.1.1"], ["public v4", "93.184.216.34"],
  ["public v6", "2606:4700:4700::1111"], ["public v6", "2a00:1450:4001:80b::200e"],
];
for (const [label, ip] of MUST_ALLOW) ok(`allows ${label} (${ip}) — no overblocking`, isPrivateIp(ip) === false);
ok("garbage is treated as unsafe", isPrivateIp("not-an-ip") === true && isPrivateIp("") === true);

// ── 4. Redirect chains are re-validated ───────────────────────────────────
console.log("── redirect re-validation ──");
{
  const r = read("lib/preflight/deployment-reach.ts");
  ok("redirects are followed manually", r.includes('redirect: "manual"'));
  ok("no redirect: follow remains in CODE", !/redirect:\s*"follow"/.test(codeOf("lib/preflight/deployment-reach.ts")));
  ok("each hop goes back through safeFetch", /followWithRevalidation[\s\S]{0,900}await safeFetch\(current/.test(r));
  ok("the chain is bounded", r.includes("MAX_HOPS"));
  ok("a relative Location is resolved against the current hop", r.includes("new URL(location, current)"));
}

// ── 5. Cron secret comparison ─────────────────────────────────────────────
console.log("── cron secret comparison ──");
ok("equal secrets match", secretsMatch("abc123", "abc123") === true);
ok("different secrets do not match", secretsMatch("abc123", "abc124") === false);
ok("a length mismatch does not throw", secretsMatch("short", "muchlongersecret") === false);
ok("empty vs empty matches (callers reject empty separately)", secretsMatch("", "") === true);
{
  const saved = process.env.CRON_SECRET;
  const hdrs = (v: string | null) => ({ headers: { get: () => v } });
  process.env.CRON_SECRET = "";
  ok("an unset CRON_SECRET denies (fails closed)", cronAuthorized(hdrs("Bearer anything")) === false);
  process.env.CRON_SECRET = "s3cr3t";
  ok("the correct bearer is accepted", cronAuthorized(hdrs("Bearer s3cr3t")) === true);
  ok("a wrong bearer is refused", cronAuthorized(hdrs("Bearer wrong")) === false);
  ok("a missing header is refused", cronAuthorized(hdrs(null)) === false);
  ok("a bare secret without the Bearer prefix is refused", cronAuthorized(hdrs("s3cr3t")) === false);
  if (saved === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = saved;
}
{
  const CRONS = [
    "app/api/cron/lifecycle/route.ts", "app/api/cron/reverify-domains/route.ts", "app/api/cron/webhook-retries/route.ts",
    "app/api/vraelis/cron/bill-fees/route.ts", "app/api/vraelis/cron/followups/route.ts",
    "app/api/vraelis/cron/provision-numbers/route.ts", "app/api/vraelis/cron/reconcile/route.ts",
    "app/api/vraelis/cron/recovery/route.ts", "app/api/vraelis/cron/reminders/route.ts",
    "app/api/vraelis/cron/subscriptions/route.ts",
  ];
  ok("all ten cron routes are covered", CRONS.length === 10);
  for (const f of CRONS) {
    const s = read(f);
    const label = f.split("/").slice(-2, -1)[0];
    ok(`${label} uses the shared constant-time check`, s.includes("cronAuthorized(req)"));
    ok(`${label} no longer compares with !==`, !/authorization"\) !== `Bearer/.test(s));
  }
}

// ── 6. Auth fallbacks and revocation wiring ───────────────────────────────
console.log("── auth hardening ──");
{
  const sso = read("lib/v-sso.ts");
  // The remaining `AUTH_SECRET || ""` occurrences are inside the fail-closed readers themselves, where
  // they only avoid calling .trim() on undefined immediately before throwing. What must NOT exist is a
  // crypto call taking the raw fallback directly — that was the actual defect, in three places: the
  // AES key AND both sides of the OIDC state HMAC.
  ok("no crypto call takes the raw empty-string fallback",
    !/create(Hmac|Hash|Cipheriv)\([^)]*AUTH_SECRET \|\| ""/.test(codeOf("lib/v-sso.ts")));
  ok("both key readers throw when unset", (codeOf("lib/v-sso.ts").match(/AUTH_SECRET is not set/g) ?? []).length >= 2);
  ok("the SSO key throws when unset", /AUTH_SECRET is not set; refusing/.test(sso));
  const st = read("lib/stealth.ts");
  ok("no public signing literal remains in CODE", !codeOf("lib/stealth.ts").includes("stealth-fallback-key"));
  ok("stealth signing throws when unset", /refusing to sign stealth tokens/.test(st));
  const a = read("auth.ts");
  ok("sign-in is rate limited per IP", a.includes("signin-ip:"));
  ok("sign-in is rate limited per canonical mailbox", a.includes("signin-fail:"));
  ok("the limiter fails closed", a.includes("allowStrict(`signin-ip:"));
  ok("the limiter runs before the password verify", a.indexOf("signin-ip:") < a.indexOf("verifyPassword("));
  ok("an unverified provider email is refused", /email_verified/.test(a) && /provider reports the email is not verified/.test(a));
  ok("the token carries a revocation version", a.includes("token.tv = await currentTokenVersion("));
  ok("a stale token is discarded", /tokenVersionIsCurrent\(email, token\.tv\)\)\) \{\s*[\r\n]+\s*return null;/.test(a));
  ok("sign-out revokes", /async signOut\(message\)[\s\S]{0,320}bumpTokenVersion\(email, "sign_out"\)/.test(a));
  const rc = read("app/api/auth/reset-password/confirm/route.ts");
  ok("password reset revokes existing sessions", rc.includes('bumpTokenVersion(email, "password_reset")'));
  ok("a failed revocation does not fail the reset", /bumped === null[\s\S]{0,200}console\.error/.test(rc));
  const w = read("lib/v-workspace.ts");
  ok("invite expiry is enforced on the email-match path", w.includes("invite_expires_at.is.null,invite_expires_at.gt."));
}

const pkg = read("package.json");
ok("package.json exposes phase2:hardening:test", pkg.includes(`"phase2:hardening:test"`));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
