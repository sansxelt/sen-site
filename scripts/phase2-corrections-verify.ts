// Phase 2 corrections — the mistakes found in review, and the guards that keep them fixed.
//
// Each section covers a defect that got through my own gates:
//   1. A route-local recipient regex whose comment did not match what it accepted.
//   2. Numeric env overrides parsed with `Number(x || d) || d`, which accepts negatives and fractions and
//      silently discards a deliberate 0.
//   3. A capped reader that returned a TRUNCATED body instead of failing.
//   4. Scripted edits "verified" by asking whether the file contains an identifier — vacuous when a
//      reference was added earlier in the same edit.
import { readFileSync } from "node:fs";
import { isSafeRecipient, normalizeRecipient } from "../lib/email-address";
import { envInt, _resetEnvWarnings } from "../lib/env-num";
import { csrfVerdict, cookieNamePresent } from "../lib/csrf";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");
const cc = (n: number) => String.fromCharCode(n);

// ── 1. Recipient validator: adversarial ───────────────────────────────────
console.log("── recipient validator rejects ──");
const REJECT: [string, string][] = [
  ["two @ signs", "a@b@c.com"],
  ["three @ signs", "a@b@c@d.com"],
  ["trailing angle bracket", "victim@example.com>"],
  ["wrapped in angle brackets", "<victim@example.com>"],
  ["leading angle bracket", "<victim@example.com"],
  ["comma separator", "a@b.com,c@d.com"],
  ["semicolon separator", "a@b.com;c@d.com"],
  ["display-name form", "Name <a@b.com>"],
  ["parenthesised comment", "a(comment)@b.com"],
  ["square brackets", "a@[192.168.1.1]"],
  ["quoted local part", '"a b"@c.com'],
  ["backslash escape", "a\\@b@c.com"],
  ["no domain dot", "victim@localhost"],
  ["no domain dot, long", "victim@internalhost"],
  ["trailing dot in domain", "a@b.com."],
  ["leading dot in domain", "a@.b.com"],
  ["consecutive dots in domain", "a@b..com"],
  ["leading dot in local", ".a@b.com"],
  ["trailing dot in local", "a.@b.com"],
  ["consecutive dots in local", "a..b@c.com"],
  ["numeric TLD", "a@b.12"],
  ["single-char TLD", "a@b.c"],
  ["hyphen-leading label", "a@-b.com"],
  ["hyphen-trailing label", "a@b-.com"],
  ["empty local", "@b.com"],
  ["empty domain", "a@"],
  ["no @ at all", "not-an-address"],
  ["empty string", ""],
  ["whitespace only", "   "],
  ["space inside", "a b@c.com"],
  ["tab inside", `a${cc(9)}b@c.com`],
  ["CR", `a${cc(13)}b@c.com`],
  ["LF", `a${cc(10)}b@c.com`],
  ["CRLF header injection", `a@b.com${cc(13)}${cc(10)}Bcc: v@e.com`],
  ["NUL", `a${cc(0)}b@c.com`],
  ["SOH control", `a${cc(1)}b@c.com`],
  ["DEL", `a${cc(127)}b@c.com`],
  ["NEL U+0085", `a${cc(0x85)}b@c.com`],
  ["U+2028", `a${cc(0x2028)}b@c.com`],
  ["U+2029", `a${cc(0x2029)}b@c.com`],
  ["Unicode lookalike (Cyrillic а)", "аdmin@example.com"],
  ["Unicode lookalike domain", "a@exаmple.com"],
  ["fullwidth commercial at", "a＠b.com"],
  ["zero-width joiner", `a${cc(0x200d)}b@c.com`],
  ["non-ASCII accent", "victimé@example.com"],
  ["emoji", "a\u{1F600}b@c.com"],
  ["local part over 64", "a".repeat(65) + "@b.com"],
  ["total over 254", "a".repeat(64) + "@" + "b".repeat(200) + ".com"],
];
for (const [label, v] of REJECT) ok(`rejects ${label}`, isSafeRecipient(v) === false, JSON.stringify(v.slice(0, 28)));
for (const bad of [null, undefined, 42, {}, [], true]) {
  ok(`rejects non-string ${String(bad)}`, isSafeRecipient(bad as unknown) === false);
}

console.log("── recipient validator accepts ──");
const ACCEPT = [
  "a@b.co", "jane.doe@example.com", "first.last+tag@sub.example.co.uk",
  "x_y-z@mail.example.org", "user123@example.travel", "a@b.museum",
];
for (const v of ACCEPT) ok(`accepts ${v}`, isSafeRecipient(v) === true);
ok("normalizeRecipient trims and lowercases", normalizeRecipient("  A@B.COM ") === "a@b.com");

console.log("── every mail path uses the ONE validator ──");
for (const f of [
  "app/api/vraelis/book/route.ts",
  "app/api/vraelis/contact/route.ts",
  "app/api/contact/route.ts",
]) {
  const s = read(f);
  const label = f.split("/").slice(-3, -1).join("/");
  // Import line and usage checked SEPARATELY — an identifier appearing anywhere is not proof of either.
  ok(`${label} imports the shared validator`, /^import \{ isSafeRecipient \} from "@\/lib\/email-address";$/m.test(s));
  ok(`${label} actually calls it`, /isSafeRecipient\b/.test(s.replace(/^import .*$/m, "")));
  ok(`${label} has no route-local address regex left`,
    !/\[\\x21-\\x7e\]\{1,64\}@/.test(s) && !/EMAIL_ASCII|EMAIL_SHAPE|BOOK_EMAIL_RE\s*=/.test(s));
}

// ── 2. Bounded numeric env parsing ────────────────────────────────────────
console.log("── envInt ──");
{
  const NAME = "ENVINT_TEST_VALUE";
  const saved = process.env[NAME];
  const set = (v: string | undefined) => { _resetEnvWarnings(); if (v === undefined) delete process.env[NAME]; else process.env[NAME] = v; };
  const opts = { min: 1, max: 100, fallback: 25 };
  const cases: [string, string | undefined, number][] = [
    ["unset uses the fallback", undefined, 25],
    ["empty uses the fallback", "", 25],
    ["a valid value is used", "50", 50],
    ["the minimum is accepted", "1", 1],
    ["the maximum is accepted", "100", 100],
    ["negative is rejected", "-5", 25],
    ["zero is rejected (outside [1,100])", "0", 25],
    ["a fraction is rejected", "2.5", 25],
    ["scientific notation is rejected", "1e99", 25],
    ["Infinity is rejected", "Infinity", 25],
    ["hex is rejected", "0x10", 25],
    ["above the max is rejected", "101", 25],
    ["far above the max is rejected", "999999999", 25],
    ["whitespace-padded valid is accepted", " 50 ", 50],
    ["non-numeric is rejected", "lots", 25],
    ["trailing junk is rejected", "50abc", 25],
    ["a huge integer is rejected", "9".repeat(30), 25],
  ];
  for (const [label, val, expect] of cases) {
    set(val);
    const got = envInt(NAME, opts);
    ok(`envInt: ${label}`, got === expect, `got ${got}, expected ${expect}`);
  }
  set(saved);
  _resetEnvWarnings();
  ok("no unsafe Number(process.env ...) pattern remains in the files I touched",
    ["app/api/preflight/apps/[id]/api-runs/route.ts", "app/api/v/keys/route.ts", "app/api/v/webhooks/route.ts"]
      .every((f) => !/Number\(process\.env/.test(read(f))));
}

// ── 3. Over-cap reads fail, they do not truncate ──────────────────────────
console.log("── capped reads ──");
{
  const s = read("app/api/preflight/apps/[id]/api-runs/route.ts");
  ok("a distinct error type exists", s.includes("class ResponseTooLargeError"));
  ok("the cap THROWS rather than breaking out", /if \(total > max\) \{[\s\S]{0,160}throw new ResponseTooLargeError\(max\)/.test(s));
  ok("no silent break remains in the read loop", !/if \(total > max\) \{[^}]*break; \}/.test(s));
  ok("the over-cap error keeps its own transportKind", s.includes("instanceof ResponseTooLargeError"));
  ok("the abort signal is passed to the fetch", /safeFetch\([\s\S]{0,220}signal: ctl\.signal/.test(s));
  ok("the timer is always cleared", s.includes("clearTimeout(timer)"));
  // safeFetch must forward init (and therefore the signal) to the real network call.
  const sf = read("lib/safe-fetch.ts");
  ok("safeFetch forwards init to undici, so the signal aborts the request",
    /undiciFetch\(url, \{ \.\.\.init,/.test(sf));
  // The crawl path returns a distinct reason rather than truncating.
  const cf = read("lib/preflight/crawl-fetch.ts");
  ok("the crawl reports page_too_large instead of truncating", /total > maxBytes[\s\S]{0,200}reason: "page_too_large"/.test(cf));
  ok("the crawl cancels the stream at the limit", /total > maxBytes[\s\S]{0,120}reader\.cancel\(\)/.test(cf));
}

// ── 4. Guard-pattern regression: declarations verified independently ──────
console.log("── declaration / import / usage checked separately ──");
{
  // The failure mode: `if (!src.includes("X")) addDeclarationOfX()` is vacuous once a REFERENCE to X was
  // added earlier in the same edit. These assert the declaration exists as a declaration.
  const decls: [string, RegExp][] = [
    ["app/api/preflight/apps/[id]/api-runs/route.ts", /^const API_FETCH_TIMEOUT_MS = envInt\(/m],
    ["app/api/preflight/apps/[id]/api-runs/route.ts", /^const API_FETCH_MAX_BYTES = envInt\(/m],
    ["app/api/preflight/apps/[id]/api-runs/route.ts", /^async function readCapped\(/m],
    ["app/api/v/keys/route.ts", /^const MAX_API_KEYS_PER_USER = envInt\(/m],
    ["app/api/v/webhooks/route.ts", /^const MAX_WEBHOOKS_PER_USER = envInt\(/m],
    ["lib/cron-auth.ts", /^export function cronAuthorized\(/m],
    ["lib/csrf.ts", /^export function csrfVerdict\(/m],
    ["lib/email-address.ts", /^export function isSafeRecipient\(/m],
    ["lib/env-num.ts", /^export function envInt\(/m],
  ];
  for (const [f, re] of decls) {
    ok(`${f.split("/").slice(-2).join("/")} declares ${re.source.slice(1, 40)}`, re.test(read(f)));
  }
  // No file may import a module it never uses, and none may use one it never imported.
  const pairs: [string, string, RegExp][] = [
    ["app/api/v/keys/route.ts", "@/lib/env-num", /envInt\(/],
    ["app/api/v/webhooks/route.ts", "@/lib/env-num", /envInt\(/],
    ["app/api/vraelis/book/route.ts", "@/lib/email-address", /isSafeRecipient\(/],
    ["proxy.ts", "@/lib/csrf", /csrfVerdict\(/],
  ];
  for (const [f, mod, use] of pairs) {
    const s = read(f);
    const imported = new RegExp(`^import \\{[^}]+\\} from "${mod.replace(/[/@]/g, "\\$&")}";$`, "m").test(s);
    const used = use.test(s.split("\n").filter((l) => !l.startsWith("import ")).join("\n"));
    ok(`${f.split("/").slice(-2).join("/")} imports AND uses ${mod}`, imported && used, `imported=${imported} used=${used}`);
  }
}

// ── 5. Fixes for the independent re-attack findings ───────────────────────
console.log("── re-attack closures ──");
{
  const px = read("proxy.ts");
  // The check must precede the app-host branch: that branch returns for /api/ as its FIRST statement, so
  // a check placed after it was inert on the host that actually carries the session cookie.
  ok("CSRF runs before the app-host branch", px.indexOf("csrfVerdict({") < px.indexOf("if (isAppHost) {"));
  ok("CSRF is wired exactly once", (px.match(/csrfVerdict\(\{/g) ?? []).length === 1);

  // Auth.js chunks a large session cookie; a base-name-only check would see no session and wave it through.
  const CH = "__Secure-authjs.session-token.0=abc; __Secure-authjs.session-token.1=def";
  const chunked = csrfVerdict({ method: "POST", cookieHeader: CH, origin: "https://evil.test", secFetchSite: "cross-site", host: "vraelis.com", proto: "https" });
  ok("a CHUNKED session cookie still counts as ambient authority", chunked.enforced === true && chunked.ok === false);
  ok("an unchunked session cookie still counts", cookieNamePresent("__Secure-authjs.session-token=x", "__Secure-authjs.session-token"));
  ok("a differently-named cookie does NOT count", !cookieNamePresent("not-authjs.session-token=x", "authjs.session-token"));
  ok("a cookie VALUE containing the name does NOT count", !cookieNamePresent("junk=authjs.session-token=x", "authjs.session-token"));
  ok("a non-numeric suffix does NOT count", !cookieNamePresent("authjs.session-token.evil=x", "authjs.session-token"));

  const a = read("auth.ts");
  // The per-mailbox bucket must be PEEKED before auth and CONSUMED only on failure, or wrong guesses by a
  // stranger lock the real owner out of their own account.
  ok("sign-in peeks the mailbox budget rather than consuming it", a.includes("peekAllowed(mailboxKey"));
  ok("sign-in consumes the mailbox budget only on failure",
    /!tokenValid && !passwordValid\)[\s\S]{0,300}allowStrict\(mailboxKey/.test(a));
  ok("the per-IP bucket is still consumed up front", a.includes("allowStrict(`signin-ip:"));
  ok("the GitHub email_verified gap is documented where the check lives", /GitHub does not send email_verified/.test(a));

  const t = read("app/rank/app/systems/[id]/team/page.tsx");
  ok("the team page uses the hardened guard", t.includes("requirePreflightAppAccess(id,"));
  ok("the team page no longer calls applicationAccess directly", !t.includes("await applicationAccess("));

  const w = read("lib/v-workspace.ts");
  ok("project invites enforce the TTL too", (w.split("invite_expires_at.is.null").length - 1) >= 2);

  const h = read("sql/vraelis-credit-hold-atomic.sql");
  ok("the hold migration guarantees the unit column it depends on", h.includes("add column if not exists unit"));
  ok("that guarantee precedes the function it protects", h.indexOf("add column if not exists unit") < h.indexOf("create or replace function v_hold_credits"));

  const rl = read("lib/vraelis-ratelimit.ts");
  ok("peekAllowed does not consume",
    /export async function peekAllowed[\s\S]{0,700}\.select\("count, window_start"\)/.test(rl));
  ok("peekAllowed honours a rolled-over window",
    /peekAllowed[\s\S]{0,900}windowSecs \* 1000\) return true/.test(rl));
}

const pkg = read("package.json");
ok("package.json exposes phase2:corrections:test", pkg.includes(`"phase2:corrections:test"`));
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
