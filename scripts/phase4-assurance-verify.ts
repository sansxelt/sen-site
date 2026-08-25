// Phase 4 — adversarial verification of the staging-readiness work itself.
//
// The staging-readiness work is a set of claims about safety. This attacks those claims:
//
//   1. exit-status reporting cannot be masked by a pipeline, a substitution, or a logging helper
//   2. AUTO_PAY_MAX_CENTS is bounded and defaults to $500
//   3. a folded email cannot cause an account-linking collision
//   4. the cross-subdomain cookie cannot reach an unrelated host, and is not attacker-influenced
//   5. the RLS preflight fails closed        (behaviourally proven in scripts/rls-preflight-verify.ts)
//   6. the preflight cannot pass a missing migration dependency  (same, fixtures 6-8)
//
// 5 and 6 are proven against real databases there rather than restated here; this file asserts the
// wiring that makes those suites reachable, and covers 1-4 directly.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  AUTO_MAX_CENTS, AUTO_FLOOR_CENTS, AUTO_MULTIPLE, DAILY_CENTS, CYCLE_CENTS,
  CYCLE_DAYS, RESERVATION_TTL_SECONDS, MIN_CHARGE_CENTS, autoCeilingCents,
} from "../lib/vraelis-payment-authz";
import { canonicalizeEmail } from "../lib/user-credentials";
import { _resetEnvWarnings } from "../lib/env-num";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8").replace(/\r/g, "");

/**
 * The file with comments stripped.
 *
 * These files DOCUMENT the anti-patterns they avoid — gates.ts quotes `| head` and `$?` in its header to
 * explain why it uses neither, and auth.ts names the resolver it deleted. A check that scans raw text
 * therefore finds the very string it is asserting is absent and reports a false failure on correct code.
 * This is the third time that trap has fired in this remediation, so it is handled with a helper rather
 * than remembered.
 *
 * Only whole-line `//` comments and block comments are removed, so a `https://` inside a string survives.
 */
const code = (p: string): string =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

// ── 1. Exit status cannot be masked ────────────────────────────────────────
//
// Demonstrated, not asserted: the two masking patterns are RUN, shown to report success for a command
// that failed, and then the repo's own runner is shown not to use them.
console.log("── exit status ──");
{
  const sh = (script: string) =>
    spawnSync("bash", ["-c", script], { encoding: "utf8" }).stdout?.trim() ?? "";

  // A pipeline reports the LAST command's status. `false` fails; `head` does not.
  const piped = sh("false | head -1; echo $?");
  ok("a pipeline really does report the wrong status", piped === "0", `false | head -1 -> $?=${piped}`);
  const direct = sh("false; echo $?");
  ok("  the same command unpiped reports its real status", direct === "1", `false -> $?=${direct}`);

  // A command substitution in the SAME line resets $? before it is read.
  const substituted = sh("false; printf '%s %s' \"$(basename /tmp/x)\" \"$?\"");
  ok("a command substitution really does clobber $?", substituted.endsWith(" 0"), substituted);

  // PIPESTATUS is the shell's own escape hatch, and proves the failure above was real.
  const pipestatus = sh("false | head -1; echo ${PIPESTATUS[0]}");
  ok("  PIPESTATUS shows the failure the pipeline hid", pipestatus === "1", `PIPESTATUS[0]=${pipestatus}`);

  // Now the property that matters: the repo's runner uses none of those.
  const gates = code("scripts/gates.ts");
  ok("the gate runner spawns without a shell pipeline", gates.includes("spawnSync(") && !/\|\s*head|\|\s*tail|\|\s*grep/.test(gates));
  ok("  it reads .status into a variable immediately", /const status = r\.status \?\? -1;/.test(gates));
  // The precise property, not a blunt string search. gates.ts PRINTS the characters "$?" in its banner
  // ("No pipes, no $?, no shell") — that is documentation, not a shell read. The only way a shell status
  // could be consulted is by invoking a shell with -c, so that is what gets asserted.
  ok("  it never invokes a shell with -c (the only way to read $?)",
    !/\["-c"|'-c'|`-c`/.test(gates) && !/spawnSync\(\s*["'](ba)?sh["']/.test(gates));
  ok("  every $? in the file is inside a printed string, not executed",
    gates.split("\n").filter((l) => l.includes("$?")).every((l) => /console\.log\(/.test(l)));
  ok("  and the returned status is what gets reported", /results\.push\(\{ name, status, ok, note \}\)/.test(gates));

  // The verify harnesses must do the same.
  for (const f of ["scripts/rls-preflight-verify.ts", "scripts/phase3-payment-cap-verify.ts"]) {
    const s = read(f);
    ok(`${f.split("/").pop()} reads a child's own status`, /\.status \?\? -1|\.status !== 0|r\.status/.test(s));
    ok(`  ${f.split("/").pop()} pipes nothing through head/tail`, !/\|\s*(head|tail)\b/.test(s));
  }

  // And the real thing: run a gate that MUST fail and confirm the runner reports non-zero.
  const failing = spawnSync("npx", ["tsx", "scripts/rls-preflight.ts", "--manifest", "sql/definitely-not-here.json", "--docker", "nope"],
    { encoding: "utf8", shell: process.platform === "win32" });
  ok("a genuinely failing command reports non-zero end to end", (failing.status ?? 0) !== 0, `exit=${failing.status}`);
}

// ── 2. The payment ceiling is bounded and defaults to $500 ─────────────────
console.log("── AUTO_PAY_MAX_CENTS ──");
{
  const withEnv = (v: string | undefined, f: () => number): number => {
    const prev = process.env.VRAELIS_AUTO_PAY_MAX_CENTS;
    if (v === undefined) delete process.env.VRAELIS_AUTO_PAY_MAX_CENTS;
    else process.env.VRAELIS_AUTO_PAY_MAX_CENTS = v;
    _resetEnvWarnings();
    const out = f();
    if (prev === undefined) delete process.env.VRAELIS_AUTO_PAY_MAX_CENTS;
    else process.env.VRAELIS_AUTO_PAY_MAX_CENTS = prev;
    _resetEnvWarnings();
    return out;
  };

  ok("unset -> $500", withEnv(undefined, AUTO_MAX_CENTS) === 50_000, String(withEnv(undefined, AUTO_MAX_CENTS)));
  ok("empty string -> $500", withEnv("", AUTO_MAX_CENTS) === 50_000);
  ok("a legitimate override is honoured", withEnv("75000", AUTO_MAX_CENTS) === 75_000);

  // Every one of these is a way an unbounded ceiling could sneak in. All must fall back to $500.
  for (const bad of ["-5", "2.5", "1e99", "0x10", "Infinity", "NaN", "60000abc", "999999999999", "1_000_000", "+50000", "0"]) {
    ok(`  ${JSON.stringify(bad)} is rejected -> $500`, withEnv(bad, AUTO_MAX_CENTS) === 50_000, String(withEnv(bad, AUTO_MAX_CENTS)));
  }
  // Surrounding whitespace IS trimmed before validation, deliberately: a stray space in a .env file is
  // a formatting slip, not an attempt to smuggle a value, and the result is still a bounded integer.
  ok("surrounding whitespace is trimmed, and the value still bounded", withEnv(" 60000 ", AUTO_MAX_CENTS) === 60_000);
  ok("  but whitespace cannot smuggle a non-integer past the check", withEnv(" 1e99 ", AUTO_MAX_CENTS) === 50_000);
  ok("  nor an out-of-range one", withEnv("  9999999  ", AUTO_MAX_CENTS) === 50_000);
  ok("above the documented range is rejected", withEnv("1000001", AUTO_MAX_CENTS) === 50_000);
  ok("the top of the range is accepted", withEnv("1000000", AUTO_MAX_CENTS) === 1_000_000);
  ok("below the provider minimum is rejected", withEnv(String(MIN_CHARGE_CENTS - 1), AUTO_MAX_CENTS) === 50_000);

  // It must not be settable from anywhere but the environment.
  const authz = read("lib/vraelis-payment-authz.ts");
  ok("the ceiling is read only from the environment", /envInt\("VRAELIS_AUTO_PAY_MAX_CENTS"/.test(authz));
  ok("  and is not read from a request, body, or database row",
    !/req\.|request\.|body\.|\.from\(/.test(authz.split("AUTO_MAX_CENTS")[1]?.slice(0, 400) ?? ""));

  // Every other knob stays bounded too.
  for (const [name, fn] of [["FLOOR", AUTO_FLOOR_CENTS], ["MULTIPLE", AUTO_MULTIPLE], ["DAILY", DAILY_CENTS],
    ["CYCLE", CYCLE_CENTS], ["CYCLE_DAYS", CYCLE_DAYS], ["TTL", RESERVATION_TTL_SECONDS]] as const) {
    const v = fn();
    ok(`${name} is a finite positive integer`, Number.isSafeInteger(v) && v >= 0, String(v));
  }

  // The ceiling a workspace actually gets, at the launch values.
  ok("a $25-deposit workspace is capped at $500", autoCeilingCents({ deposit_amount_cents: 2_500 }) === 50_000);
  ok("a $2,000-deposit workspace is ALSO capped at $500", autoCeilingCents({ deposit_amount_cents: 200_000 }) === 50_000);
  ok("  so no workspace can auto-charge above the owner's limit",
    [0, 1, 2_500, 50_000, 200_000, 10_000_000].every((d) => (autoCeilingCents({ deposit_amount_cents: d }) ?? 0) <= 50_000));
  ok("a malformed deposit yields no ceiling at all (fail closed)",
    autoCeilingCents({ deposit_amount_cents: -1 }) === null && autoCeilingCents({ deposit_amount_cents: NaN }) === null);
}

// ── 3. A folded email cannot cause an account-linking collision ────────────
console.log("── folded emails are risk-only ──");
{
  // Folding still WORKS — it has to, the rate limits depend on it.
  ok("+tag folds", canonicalizeEmail("a+one@example.com") === canonicalizeEmail("a+two@example.com"));
  ok("gmail dots fold", canonicalizeEmail("first.last@gmail.com") === canonicalizeEmail("firstlast@gmail.com"));
  ok("googlemail folds onto gmail", canonicalizeEmail("x@googlemail.com") === canonicalizeEmail("x@gmail.com"));
  ok("distinct mailboxes do NOT fold together", canonicalizeEmail("a@example.com") !== canonicalizeEmail("b@example.com"));
  ok("non-gmail dots are preserved", canonicalizeEmail("first.last@example.com") === "first.last@example.com");

  // ...but nothing resolves an ACCOUNT through it any more.
  const creds = read("lib/user-credentials.ts");
  ok("the folded-address account lookup is GONE", !/export async function getUserCredentialByCanonical/.test(creds));
  ok("  and a note explains why it must not come back", /REMOVED: getUserCredentialByCanonical/.test(creds));
  ok("sign-in still resolves by EXACT address", /export async function getUserCredentialByEmail/.test(creds));

  const auth = read("auth.ts");
  ok("auth.ts looks the account up by exact email", /getUserCredentialByEmail\(email\)/.test(auth));
  ok("  and uses the folded form ONLY for the rate-limit bucket",
    /canonicalizeEmail\(email\)/.test(auth) && /signin-fail:\$\{canonicalizeEmail\(email\)\}/.test(auth));

  for (const f of ["app/api/auth/register/route.ts", "app/api/auth/verify/route.ts"]) {
    const s = read(f);
    ok(`${f.split("/").slice(-2)[0]} no longer blocks on a folded collision`, !/getUserCredentialByCanonical\(/.test(s));
    ok(`  ${f.split("/").slice(-2)[0]} still writes/uses canonical for risk`, /canonicalizeEmail\(/.test(s));
  }

  // The database-level identity key is removed by a migration, with a rollback that admits it can fail.
  const mig = read("sql/vraelis-canonical-not-identity.sql");
  ok("a migration drops the folded UNIQUE index", /drop index if exists user_credentials_canonical_email_uidx/.test(mig));
  ok("  and replaces it with a NON-unique one", /create index if not exists user_credentials_canonical_email_idx/.test(mig));
  ok("  it does not drop the column (clustering still needs it)", !/drop column/i.test(mig));
  const rb = read("sql/vraelis-canonical-not-identity-rollback.sql");
  ok("the rollback restores the unique index", /create unique index if not exists user_credentials_canonical_email_uidx/.test(rb));
  ok("  and warns it can legitimately FAIL", /THIS CAN FAIL/.test(rb));

  // The abuse the old rule guarded is still guarded, one layer up.
  const cluster = read("lib/preflight/free-grant-cluster.ts");
  ok("the free pass is still denied on the canonical CLUSTER", /ONLY hard-denial key for the free pass is the canonical email/.test(cluster));
  ok("  by looking user_profiles up BY canonical_email", /\.eq\("canonical_email", canonical\)/.test(cluster));
}

// ── 4. The cookie cannot reach an unrelated host ───────────────────────────
console.log("── cookie scope ──");
{
  const auth = read("auth.ts");
  const authCode = code("auth.ts");

  // RFC 6265 domain-matching, applied to the value that is actually configured. A cookie with
  // Domain=.vraelis.com goes to vraelis.com and any subdomain of it — and to nothing else.
  const domainMatches = (cookieDomain: string, host: string): boolean => {
    const d = cookieDomain.replace(/^\./, "").toLowerCase();
    const h = host.toLowerCase();
    return h === d || h.endsWith(`.${d}`);
  };

  ok("the apex receives it", domainMatches(".vraelis.com", "vraelis.com"));
  ok("app.vraelis.com receives it (the reason it is scoped this way)", domainMatches(".vraelis.com", "app.vraelis.com"));
  for (const host of [
    "sansxel.ai", "chat.sansxel.ai",          // a DIFFERENT registrable domain
    "evilvraelis.com",                         // the classic suffix trap
    "notvraelis.com",
    "vraelis.com.evil.test",                   // suffix-appended
    "vraelis.co", "vraelis.com.br",
    "xn--vraelis-abc.com",                     // punycode lookalike
  ]) {
    ok(`  ${host} does NOT receive it`, !domainMatches(".vraelis.com", host));
  }
  // And the trap the old dead code contained: endsWith() would have matched evilvraelis.com.
  ok("naive endsWith WOULD have over-matched (why the literal is safer)", "evilvraelis.com".endsWith("vraelis.com"));

  // The configured value is a LITERAL, not derived from an attacker-controlled header.
  ok("the cookie domain is a literal", /domain: "\.vraelis\.com"/.test(auth));
  ok("  it is NOT computed from the Host header", !/host\.endsWith\(/.test(authCode) && !/resolveCookieDomain/.test(authCode));
  ok("  the dead per-request resolver is gone", !/function resolveCookieDomain/.test(authCode));
  ok("  and buildCookieOptions with it", !/function buildCookieOptions/.test(authCode));

  // Attributes.
  ok("the session cookie is httpOnly", /httpOnly: true/.test(auth));
  ok("  secure", /secure: true/.test(auth));
  ok("  sameSite=lax", /sameSite: "lax"/.test(auth));
  ok("  path=/", /path: "\/"/.test(auth));
  ok("  and only in production", /VERCEL_ENV === "production"/.test(auth));

  // Only ONE cookie is given a domain. CSRF must stay host-only.
  const domainCount = (auth.match(/domain: "/g) ?? []).length;
  ok("exactly one cookie is given a domain", domainCount === 1, `${domainCount}`);
  ok("  and it is the session token", /sessionToken:[\s\S]{0,200}domain: "\.vraelis\.com"/.test(auth));
  ok("  csrfToken is NOT given one (stays host-only)", !/csrfToken:[\s\S]{0,200}domain:/.test(auth));

  // The inert variable is documented as inert, so nobody sets it and assumes it took.
  const env = read(".env.example");
  ok("AUTH_COOKIE_DOMAIN is documented as having no effect", /AUTH_COOKIE_DOMAIN — CURRENTLY HAS NO EFFECT/.test(env));
}

// ── 5 & 6. The preflight suites exist, are wired, and are the real proof ───
console.log("── preflight fail-closed (proven behaviourally in its own suite) ──");
{
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  ok("the preflight is runnable as a script", pkg.scripts["rls:preflight"] === "tsx scripts/rls-preflight.ts");
  ok("  and its test suite is wired", pkg.scripts["rls:preflight:test"] === "tsx scripts/rls-preflight-verify.ts");
  ok("  and the gate runner includes it", read("scripts/gates.ts").includes("rls-preflight"));

  const v = read("scripts/rls-preflight-verify.ts");
  for (const [what, needle] of [
    ["a missing dependency", "MISSING_DEPENDENCY_INDEX"],
    ["a missing role", "MISSING_DEPENDENCY_ROLE"],
    ["an invalid index", "INVALID_INDEX"],
    ["a missing table", "MISSING_TABLE"],
    ["an unexpected table", "UNEXPECTED_TABLE"],
    ["an unclassified policy", "UNCLASSIFIED_POLICY"],
  ] as const) {
    ok(`the suite covers ${what}`, v.includes(needle));
  }
  ok("the suite also proves it stays CLEAR on a good schema", /a complete schema is CLEAR/.test(v));

  const pf = read("scripts/rls-preflight.ts");
  ok("the preflight refuses a non-SELECT", /refusing a non-SELECT statement/.test(pf));
  ok("  sets the session read-only server-side", /default_transaction_read_only = on/.test(pf));
  ok("  refuses a data-bearing dump", /contains ROW DATA/.test(pf));
  ok("  refuses to guess a target", /Refusing to guess a target/.test(pf));
  ok("  exits 1 on BLOCKED and 0 only on CLEAR", /result\.verdict === "CLEAR" \? 0 : 1/.test(pf));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
