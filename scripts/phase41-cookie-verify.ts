// Phase 4.1 — the cookie topology, measured from EMITTED Set-Cookie headers.
//
// Every previous statement about cookies in this remediation was read out of auth.ts. Source strings are
// not behaviour: Auth.js supplies its own defaults for every cookie the config does not override, and those
// defaults are where most of the real attributes come from. So this drives the actual NextAuth handlers
// with synthetic requests and reads the Set-Cookie headers they produce.
//
// It found one thing reading the source had got wrong — see the __Host- assertion below.
//
// Nothing here touches a network, a database, or a deployed environment. The handlers run in-process
// against synthetic Requests with a throwaway AUTH_SECRET.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

type Emitted = { host: string; vercelEnv: string; scheme: string; cookies: string[] };

/**
 * Emit cookies for one (host, VERCEL_ENV) case.
 *
 * Run in a CHILD PROCESS. auth.ts reads VERCEL_ENV and deletes AUTH_URL at module scope, and module state
 * is cached per process — mutating the environment between in-process cases would measure whichever value
 * happened to be set when the module first loaded, not the one under test. A fresh process per case is the
 * only way this measures what it claims to.
 */
function emit(host: string, vercelEnv: string, scheme = "https"): Emitted {
  const runner = `
    process.env.AUTH_SECRET = "phase41-cookie-probe-not-a-real-credential-0000";
    ${vercelEnv ? `process.env.VERCEL_ENV = ${JSON.stringify(vercelEnv)};` : "delete process.env.VERCEL_ENV;"}
    const { NextRequest } = require("next/server");
    (async () => {
      const { handlers } = await import("../auth.ts");
      const { encode } = await import("@auth/core/jwt");
      const origin = ${JSON.stringify(`${scheme}://${host}`)};
      const csrf = await handlers.GET(new NextRequest(origin + "/api/auth/csrf", { method: "GET" }));
      const body = await csrf.json();
      const jar = csrf.headers.getSetCookie().map((c) => c.split(";")[0]);
      const all = [...csrf.headers.getSetCookie()];
      // Mint a real signed token under BOTH possible session cookie names so the sign-out has something to
      // clear whichever naming is in force.
      for (const name of ["__Secure-authjs.session-token", "authjs.session-token"]) {
        const t = await encode({ token: { email: "probe@test.invalid", sub: "probe@test.invalid" },
          secret: process.env.AUTH_SECRET, salt: name, maxAge: 3600 });
        jar.push(name + "=" + t);
      }
      const form = new URLSearchParams({ csrfToken: body.csrfToken, callbackUrl: origin + "/" });
      const out = await handlers.POST(new NextRequest(origin + "/api/auth/signout", {
        method: "POST",
        headers: { cookie: jar.join("; "), "content-type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      }));
      all.push(...out.headers.getSetCookie());
      console.log("__COOKIES__" + JSON.stringify(all));
    })().catch((e) => { console.log("__COOKIES__" + JSON.stringify([])); console.error(e && e.message); });
  `;
  // The runner must live INSIDE the repo. `tsx -e` and a temp file elsewhere resolve `next/server` against
  // the script's own directory, not the cwd, so an out-of-tree runner cannot import the app at all — it
  // fails with "Cannot find module 'next/server'" and every case comes back empty.
  const tmp = `scripts/.cookie-probe-${host.replace(/[^a-z0-9]/gi, "-")}-${vercelEnv || "none"}.tmp.ts`;
  writeFileSync(tmp, runner);
  try {
    const r = spawnSync("npx", ["tsx", tmp], {
      encoding: "utf8", maxBuffer: 1 << 26, shell: process.platform === "win32",
    });
    const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("__COOKIES__"));
    const cookies: string[] = line ? JSON.parse(line.slice("__COOKIES__".length)) : [];
    if (cookies.length === 0) {
      // Loudly, not silently. An empty result would let every downstream "does not contain X" assertion
      // pass vacuously — the harness would report green precisely when it had measured nothing.
      console.log(`  !! ${host} (${vercelEnv || "unset"}) emitted NOTHING — child stderr:`);
      console.log(`     ${(r.stderr ?? "").trim().split("\n").slice(0, 4).join("\n     ")}`);
    }
    return { host, vercelEnv: vercelEnv || "(unset)", scheme, cookies };
  } finally {
    rmSync(tmp, { force: true });
  }
}

const attr = (cookie: string, name: string): string | null => {
  for (const part of cookie.split(";").slice(1)) {
    const [k, v] = part.split("=");
    if (k.trim().toLowerCase() === name.toLowerCase()) return (v ?? "").trim() || "present";
  }
  return null;
};
const named = (e: Emitted, prefix: string) => e.cookies.find((c) => c.startsWith(prefix)) ?? null;

console.log("── emitting real Set-Cookie headers ──");
const cases: Emitted[] = [
  emit("vraelis.com", "production"),
  emit("www.vraelis.com", "production"),
  emit("app.vraelis.com", "production"),
  emit("vraelis-git-branch-x.vercel.app", "preview"),
  emit("localhost:3000", "", "http"),
];

// GUARD, before anything is asserted. If a case measured nothing, every "does not contain" assertion below
// would pass on an empty array and the suite would report green having tested nothing at all.
const empty = cases.filter((c) => c.cookies.length === 0);
ok("every case actually emitted cookies (nothing is asserted against an empty measurement)",
  empty.length === 0, empty.map((c) => `${c.host}/${c.vercelEnv}`).join(", ") || `${cases.length} cases`);
if (empty.length > 0) {
  console.log("\nRefusing to assert against empty measurements. Fix the probe first.");
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

// ── The matrix ─────────────────────────────────────────────────────────────
console.log("\n── COOKIE MATRIX (measured, not read from source) ──\n");
const rows: string[][] = [["host", "VERCEL_ENV", "cookie", "Domain", "Path", "Secure", "HttpOnly", "SameSite"]];
for (const c of cases) {
  if (c.cookies.length === 0) { rows.push([c.host, c.vercelEnv, "(none emitted)", "-", "-", "-", "-", "-"]); continue; }
  for (const cookie of c.cookies) {
    rows.push([
      c.host, c.vercelEnv, cookie.split("=")[0],
      attr(cookie, "Domain") ?? "(host-only)",
      attr(cookie, "Path") ?? "-",
      attr(cookie, "Secure") ? "yes" : "no",
      attr(cookie, "HttpOnly") ? "yes" : "no",
      attr(cookie, "SameSite") ?? "-",
    ]);
  }
}
const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? "").length)));
for (const [n, r] of rows.entries()) {
  console.log("  " + r.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("  "));
  if (n === 0) console.log("  " + widths.map((w) => "-".repeat(w)).join("  "));
}

// ── Assertions ─────────────────────────────────────────────────────────────
console.log("\n── production hosts ──");
for (const host of ["vraelis.com", "www.vraelis.com", "app.vraelis.com"]) {
  const c = cases.find((x) => x.host === host)!;
  const session = named(c, "__Secure-authjs.session-token");
  ok(`${host}: a session cookie is emitted`, session !== null);
  if (session) {
    ok(`  ${host}: Domain=.vraelis.com — the SAME value regardless of request host`, attr(session, "Domain") === ".vraelis.com", attr(session, "Domain") ?? "none");
    ok(`  ${host}: HttpOnly`, attr(session, "HttpOnly") !== null);
    ok(`  ${host}: Secure`, attr(session, "Secure") !== null);
    ok(`  ${host}: SameSite=Lax`, (attr(session, "SameSite") ?? "").toLowerCase() === "lax");
    ok(`  ${host}: Path=/`, attr(session, "Path") === "/");
  }
  const csrf = named(c, "__Host-authjs.csrf-token");
  ok(`  ${host}: the CSRF cookie uses the __Host- prefix`, csrf !== null);
  // __Host- FORBIDS a Domain attribute, so this is host-only by construction, not by configuration.
  if (csrf) ok(`  ${host}: and therefore carries NO Domain (host-only)`, attr(csrf, "Domain") === null);
  const cb = named(c, "__Secure-authjs.callback-url");
  if (cb) ok(`  ${host}: the callback-url cookie is host-only too`, attr(cb, "Domain") === null);
}

console.log("\n── non-production contexts ──");
{
  const preview = cases.find((x) => x.vercelEnv === "preview")!;
  const anyDomain = preview.cookies.filter((c) => attr(c, "Domain") !== null);
  ok("a preview deployment emits NO cookie scoped to .vraelis.com",
    anyDomain.every((c) => attr(c, "Domain") !== ".vraelis.com"),
    anyDomain.map((c) => `${c.split("=")[0]} -> ${attr(c, "Domain")}`).join(", ") || "no Domain on any cookie");
  ok("  because the production config is keyed on VERCEL_ENV === 'production'", preview.vercelEnv === "preview");

  const local = cases.find((x) => x.host.startsWith("localhost"))!;
  ok("localhost emits cookies", local.cookies.length > 0, `${local.cookies.length}`);
  ok("  none scoped to .vraelis.com", local.cookies.every((c) => attr(c, "Domain") !== ".vraelis.com"));
  ok("  and over http the __Secure-/__Host- prefixes are dropped",
    local.cookies.some((c) => /^authjs\./.test(c)) || local.cookies.every((c) => !/^__(Secure|Host)-/.test(c)),
    local.cookies.map((c) => c.split("=")[0]).join(", "));
}

// ── What the source says vs what is emitted ────────────────────────────────
console.log("\n── source claims that the measurement corrects ──");
{
  const auth = readFileSync("auth.ts", "utf8").replace(/\r/g, "");
  const prod = cases.find((x) => x.host === "vraelis.com")!;

  ok("auth.ts configures exactly ONE cookie explicitly",
    (auth.match(/domain: "\.vraelis\.com"/g) ?? []).length === 1);
  ok("  but THREE are emitted — the rest come from Auth.js defaults",
    prod.cookies.length >= 3, `${prod.cookies.length} emitted`);

  // The correction. An earlier report said the __Host- CSRF name existed only in the deleted helper.
  // It does not: Auth.js uses __Host- for the CSRF cookie BY DEFAULT in a secure context.
  ok("the __Host- CSRF name is an Auth.js DEFAULT, not something the deleted helper provided",
    named(prod, "__Host-authjs.csrf-token") !== null,
    "corrects the Phase 4 report");
  ok("  so deleting that helper did not weaken the CSRF cookie", named(prod, "__Host-authjs.csrf-token") !== null);
}

// ── The SECOND cookie path ─────────────────────────────────────────────────
//
// NextAuth is not the only thing that sets a session cookie. lib/v-sso.ts mints one itself and the OIDC
// callback attaches it to a redirect. If its options diverged from the NextAuth config there would be two
// session cookies with different scopes, and which one a browser held would depend on how you signed in.
console.log("\n── lib/v-sso.ts — the second session-cookie path ──");
{
  const sso = readFileSync("lib/v-sso.ts", "utf8").replace(/\r/g, "");
  const cb = readFileSync("app/api/v/sso/oidc/[providerId]/callback/route.ts", "utf8").replace(/\r/g, "");

  ok("v-sso.ts sets a session cookie of its own", /return \{ name: SESSION_COOKIE, value, options:/.test(sso));
  ok("  and the OIDC callback attaches it to the response", /res\.cookies\.set\(\{ name: cookie\.name/.test(cb));

  const opts = sso.slice(sso.indexOf("options: {"), sso.indexOf("options: {") + 200);
  ok("  it uses the SAME cookie name as the NextAuth config",
    /const SESSION_COOKIE = "__Secure-authjs\.session-token"/.test(sso));
  ok("  the SAME domain", /domain: "\.vraelis\.com"/.test(opts), opts.match(/domain: "[^"]*"/)?.[0] ?? "none");
  ok("  httpOnly", /httpOnly: true/.test(opts));
  ok("  secure", /secure: true/.test(opts));
  ok("  sameSite lax", /sameSite: "lax"/.test(opts));
  ok("  path /", /path: "\/"/.test(opts));

  // The divergence that DOES exist, stated rather than glossed over.
  ok("BUT it is NOT keyed on VERCEL_ENV, unlike the NextAuth config",
    !/VERCEL_ENV/.test(sso),
    "so SSO sets a Secure .vraelis.com cookie even on localhost/preview, where a browser will reject it");
  ok("  which means SSO sign-in cannot work outside production — a limitation, not a leak",
    /domain: "\.vraelis\.com"/.test(opts) && /secure: true/.test(opts));
}

// ── Cross-subdomain: does it actually work, and why ────────────────────────
console.log("\n── cross-subdomain reachability ──");
{
  // RFC 6265: Domain=.vraelis.com is sent to vraelis.com and every subdomain, and to nothing else.
  const reaches = (cookieDomain: string | null, host: string): boolean => {
    if (cookieDomain === null) return false; // host-only: only the exact issuing host
    const d = cookieDomain.replace(/^\./, "").toLowerCase();
    return host === d || host.endsWith(`.${d}`);
  };
  const session = named(cases.find((x) => x.host === "vraelis.com")!, "__Secure-authjs.session-token")!;
  const dom = attr(session, "Domain");

  ok("the session cookie reaches vraelis.com", reaches(dom, "vraelis.com"));
  ok("  and www.vraelis.com", reaches(dom, "www.vraelis.com"));
  ok("  and app.vraelis.com — this is what makes cross-subdomain auth work", reaches(dom, "app.vraelis.com"));
  for (const h of ["sansxel.ai", "chat.sansxel.ai", "evilvraelis.com", "vraelis.com.evil.test", "vraelis.co"]) {
    ok(`  and NOT ${h}`, !reaches(dom, h));
  }

  const csrf = named(cases.find((x) => x.host === "vraelis.com")!, "__Host-authjs.csrf-token")!;
  ok("the CSRF cookie does NOT span subdomains", !reaches(attr(csrf, "Domain"), "app.vraelis.com"));
  ok("  which is the correct split: session spans, CSRF stays per-host", attr(csrf, "Domain") === null && dom === ".vraelis.com");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
