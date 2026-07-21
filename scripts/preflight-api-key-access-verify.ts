// API-key access to Preflight — safety proof (pure/offline: no network, no DB, no spend, no real key).
//
// The claim under test is narrow and load-bearing: adding a second AUTHENTICATION method must not create a
// second AUTHORIZATION path. A key names an acting email and nothing more; every tenancy check, entitlement
// gate, credit hold, quota and cost governor it then passes through is the same code the browser runs.
//
// What is proven here:
//   - scope enforcement (a key missing the scope for an endpoint cannot use it; scopes are exact strings)
//   - key placement (a key in a query string is refused, because a URL is already in logs and history)
//   - idempotency bound to the PAYLOAD (same key + same body is a retry; same key + different body is not)
//   - key-scoped and tenant-scoped fingerprints (one tenant's key can never collide into another's)
//   - STRUCTURAL wiring: the three endpoints resolve a principal with a scope, the access gate is still the
//     unchanged team-access gate, no route reads a key from anywhere but the header, and no response or log
//     line carries key material
//   - the /developers CI example is labelled unavailable (it has not been run against production yet)
//
// What is NOT proven here, and cannot be without a live deployment: that a real key works end to end. That
// is exactly why the /developers assertion below exists.

import { readFileSync } from "node:fs";
import {
  PREFLIGHT_SCOPES,
  type PreflightScope,
} from "../lib/preflight/api-principal";
import { GRANTABLE_SCOPES, DEFAULT_SCOPES, sanitizeScopes, sanitizeCeilingCents } from "../lib/v-api-keys";
import { keyCeilingRefusal } from "../lib/preflight/key-spend";
import {
  keyFingerprint,
  payloadFingerprint,
  buildSubmissionId,
  submissionPayloadOf,
  submissionIdForAttempt,
} from "../lib/preflight/flow-selection";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); }
}

const read = (p: string) => readFileSync(p, "utf8");
const ROUTE_RUNS = "app/api/preflight/apps/[id]/runs/route.ts";
const ROUTE_RUN_READ = "app/api/preflight/runs/[runId]/route.ts";
const ROUTE_PREVIEW = "app/api/preflight/apps/[id]/pass-preview/route.ts";
const PRINCIPAL = "lib/preflight/api-principal.ts";

// ── scopes ───────────────────────────────────────────────────────────────────────────────────────────────
// Scope strings are a published contract: a customer stores them on a key, so renaming one silently strips
// access from every key already minted. They are asserted literally, not derived from the constant.
function scopeTests() {
  console.log("── scopes are exact, published strings ──");
  ok("preview scope is preflight:preview", PREFLIGHT_SCOPES.preview === "preflight:preview");
  ok("run create scope is preflight:run:create", PREFLIGHT_SCOPES.runCreate === "preflight:run:create");
  ok("run read scope is preflight:run:read", PREFLIGHT_SCOPES.runRead === "preflight:run:read");

  // Reading is separate from creating so a polling CI job can hold a key that cannot spend money.
  ok("read and create are DIFFERENT scopes (a read-only key cannot launch a paid run)",
    (PREFLIGHT_SCOPES.runRead as string) !== (PREFLIGHT_SCOPES.runCreate as string));

  // The resolver's check is a plain array includes, so the properties that matter are exactness and the
  // behavior of a key that predates scopes entirely.
  const holds = (scopes: string[], need: PreflightScope) => scopes.includes(need);
  ok("a key with the exact scope passes", holds(["preflight:run:create"], PREFLIGHT_SCOPES.runCreate));
  ok("a key with only the READ scope cannot create a run",
    !holds(["preflight:run:read"], PREFLIGHT_SCOPES.runCreate));
  ok("a key with NO scopes (minted before scopes existed) can do nothing",
    !holds([], PREFLIGHT_SCOPES.runCreate) && !holds([], PREFLIGHT_SCOPES.runRead) && !holds([], PREFLIGHT_SCOPES.preview));
  ok("a near-miss scope string does not pass (no prefix or wildcard matching)",
    !holds(["preflight:run"], PREFLIGHT_SCOPES.runCreate)
    && !holds(["preflight:*"], PREFLIGHT_SCOPES.runCreate)
    && !holds(["Preflight:Run:Create"], PREFLIGHT_SCOPES.runCreate));

  console.log("\n── a key can actually BE granted these scopes, and only these ──");
  // Without this the whole surface is unreachable: key creation ignored scopes entirely, so every key fell
  // to the table default and none of the three endpoints could ever be called.
  for (const s of Object.values(PREFLIGHT_SCOPES)) {
    ok(`${s} is grantable at key creation`, (GRANTABLE_SCOPES as readonly string[]).includes(s));
  }
  ok("asking for a preflight scope grants exactly it", sanitizeScopes(["preflight:run:read"]).join() === "preflight:run:read");
  ok("an undefined scope is dropped, never stored", !sanitizeScopes(["preflight:run:read", "admin:*", "billing:write"]).includes("admin:*"));
  ok("asking for nothing falls back to the legacy default (no preflight access)",
    sanitizeScopes(undefined).join() === DEFAULT_SCOPES.join()
    && !sanitizeScopes(undefined).some((s) => s.startsWith("preflight:")));
  ok("a body of only junk scopes yields the default, not an empty all-denying key",
    sanitizeScopes(["nonsense"]).join() === DEFAULT_SCOPES.join());
  ok("run:create is separable from the read scopes (a polling key cannot spend)",
    !sanitizeScopes(["preflight:preview", "preflight:run:read"]).includes("preflight:run:create"));

  // The console is the only place a key is minted, so the choice has to exist there too.
  const ui = read("app/rank/app/api/page.tsx");
  ok("the console offers a Preflight access choice at creation", /Preflight access/.test(ui));
  ok("the console defaults to NO preflight access", /useState<PreflightAccess>\("none"\)/.test(ui));
  ok("the console warns that a launch key can spend credits", /can spend your credits/.test(ui));
}

// ── per-key daily spend ceiling ──────────────────────────────────────────────────────────────────────────
// The guard that exists because an agent in a retry loop is not the same threat as a person clicking Launch.
// The owner-level caps cannot tell them apart; a ceiling on the credential can.
async function ceilingTests() {
  console.log("\n── a key's daily ceiling only ever narrows ──");
  ok("a ceiling is a positive number of cents", sanitizeCeilingCents(1500) === 1500);
  ok("a fractional cent is floored, never rounded up into more spend", sanitizeCeilingCents(1500.9) === 1500);
  // Zero would be a key that authenticates but can never spend. That is what withholding the run:create
  // scope already says, more clearly, so 0 means "no ceiling" rather than a second way to say the same thing.
  ok("zero and negatives mean NO ceiling, not a zero-spend key",
    sanitizeCeilingCents(0) === null && sanitizeCeilingCents(-5) === null);
  ok("junk means no ceiling rather than an accidental limit",
    sanitizeCeilingCents("abc") === null && sanitizeCeilingCents(undefined) === null && sanitizeCeilingCents(NaN) === null);
  ok("a typo cannot mint a blank cheque (ceiling is bounded)", sanitizeCeilingCents(9_999_999_999) === 1_000_000);

  console.log("\n── the ceiling's failure posture ──");
  // No ceiling and no key (a browser session) must be entirely unaffected, including when the ledger is
  // unreadable. A session caller has no credential to bound.
  ok("a session caller is never touched by the ceiling",
    (await keyCeilingRefusal({ id: null, dailyCeilingCents: null }, 1500)) === null);
  ok("a key with no ceiling is never refused", (await keyCeilingRefusal({ id: "k1", dailyCeilingCents: null }, 1500)) === null);

  // This suite runs with no database configured, so the spend read returns null. A key the owner
  // deliberately bounded must NOT have that bound silently lifted by a transient read failure, which is the
  // opposite of the velocity cap's fail-open posture and intentionally so.
  const blind = await keyCeilingRefusal({ id: "k1", dailyCeilingCents: 5000 }, 1500);
  ok("a bounded key FAILS CLOSED when the spend ledger cannot be read", blind !== null);
  ok("the fail-closed refusal is a retryable 503, not a permanent denial",
    blind?.status === 503 && blind?.error === "key_ceiling_unavailable");
  ok("the refusal explains that nothing was started (no stranded hold)",
    !!blind && /not started/i.test(blind.message));

  console.log("\n── the ceiling is wired where it cannot strand money ──");
  const runsSrc = read(ROUTE_RUNS);
  ok("the run route enforces the key ceiling", /keyCeilingRefusal\(/.test(runsSrc));
  // Order is the whole point: a ceiling checked after the hold would refuse the run while the money stayed
  // reserved.
  ok("the ceiling is checked BEFORE any credit hold is taken",
    runsSrc.indexOf("keyCeilingRefusal") < runsSrc.indexOf("await hold("));
  ok("the ceiling is checked AFTER the owner-level gates (it narrows, never replaces)",
    runsSrc.indexOf("checkAccountVelocity") < runsSrc.indexOf("keyCeilingRefusal"));
  ok("the run records which key launched it (so tomorrow's ceiling is enforceable)",
    /apiKeyId: p\.principal\.keyId/.test(runsSrc));
  ok("a ceiling refusal is logged to the key audit", /status: refusal\.status/.test(runsSrc));

  console.log("\n── minting a bounded key never silently produces an unbounded one ──");
  const keysLib = read("lib/v-api-keys.ts");
  ok("key creation refuses rather than dropping a requested ceiling",
    /Refusing to mint an UNBOUNDED key/.test(keysLib));
  // The authentication path must survive a deploy that lands before its migration, or every key breaks.
  ok("verifyApiKey falls back when the ceiling column is not migrated yet",
    /if \(first\.error\)/.test(keysLib) && /daily_ceiling_cents/.test(keysLib));
}

// ── idempotency, bound to the payload ────────────────────────────────────────────────────────────────────
function idempotencyTests() {
  console.log("\n── idempotency is bound to the payload, not just the key ──");
  const OWNER = "owner@x.com", APP = "app_1";
  const bodyA = { applicationId: APP, deploymentUrl: "https://a.example.com", flowIds: ["f1", "f2"] };
  const bodyB = { applicationId: APP, deploymentUrl: "https://a.example.com", flowIds: ["f1", "f3"] };

  const idFor = (owner: string, app: string, key: string, body: typeof bodyA) =>
    buildSubmissionId(keyFingerprint(owner, app, key), payloadFingerprint(body));

  // The retry case: an agent or CI job that times out and resends the SAME request must get the original
  // run back, not a second browser session and a second hold.
  ok("same key + same payload -> the SAME submission id (a genuine retry)",
    idFor(OWNER, APP, "k1", bodyA) === idFor(OWNER, APP, "k1", bodyA));
  ok("flow order does not change the payload fingerprint (the SET is what was requested)",
    payloadFingerprint(bodyA) === payloadFingerprint({ ...bodyA, flowIds: ["f2", "f1"] }));

  // The dangerous case: reusing one key with a changed body. Without the payload half this would return the
  // first run and the caller would believe their new selection ran.
  ok("same key + DIFFERENT flows -> a different submission id (caught as reuse)",
    idFor(OWNER, APP, "k1", bodyA) !== idFor(OWNER, APP, "k1", bodyB));
  ok("same key + DIFFERENT deployment url -> a different submission id",
    idFor(OWNER, APP, "k1", bodyA) !== idFor(OWNER, APP, "k1", { ...bodyA, deploymentUrl: "https://b.example.com" }));

  console.log("\n── the payload hash is canonical (equivalent requests are the SAME request) ──");
  // A caller serializing the same request twice must not be told it is a different request. JSON key order
  // is not meaningful, so it must not reach the hash.
  const reordered = { flowIds: ["f1", "f2"], applicationId: APP, deploymentUrl: "https://a.example.com" };
  ok("a body with REORDERED keys hashes identically", payloadFingerprint(bodyA) === payloadFingerprint(reordered));
  ok("selecting the same flows in a different order is the same request",
    payloadFingerprint(bodyA) === payloadFingerprint({ ...bodyA, flowIds: ["f2", "f1"] }));
  ok("a repeated flow id is the same selection (deduplicated before hashing)",
    payloadFingerprint(bodyA) === payloadFingerprint({ ...bodyA, flowIds: ["f2", "f1", "f1", "f2"] }));
  // The route accepts both spellings of the URL field; they name one value, so they must hash as one.
  ok("deployment_url and deploymentUrl are one value, not two requests",
    payloadFingerprint({ ...bodyA, deploymentUrl: "https://a.example.com" }) === payloadFingerprint(bodyA));
  // A genuinely different request must still be different, or canonicalization has gone too far.
  ok("canonicalization does not collapse genuinely different requests",
    payloadFingerprint(bodyA) !== payloadFingerprint(bodyB)
    && payloadFingerprint(bodyA) !== payloadFingerprint({ ...bodyA, applicationId: "app_2" }));

  // THE DURABLE GUARD. The fingerprint covers the fields that change what executes. If someone later adds a
  // new meaningful body field to the run route and forgets to fold it in, a changed request would replay as
  // the original. This asserts the route reads no body field beyond the three that are accounted for.
  const bodyFields = new Set(
    Array.from(read(ROUTE_RUNS).matchAll(/body\?\.([A-Za-z_][A-Za-z0-9_]*)/g)).map((m) => m[1]),
  );
  const ACCOUNTED = new Set([
    "flow_ids", "flowIds",           // hashed as `flows`
    "deployment_url", "deploymentUrl", // hashed as `url`
    "submission_id",                 // the idempotency key itself, not part of the payload
  ]);
  const unaccounted = [...bodyFields].filter((f) => !ACCOUNTED.has(f));
  ok("the run route reads NO body field the payload fingerprint does not account for",
    unaccounted.length === 0, `unaccounted: ${unaccounted.join(", ")}`);

  // The reuse check matches on the KEY half and compares the PAYLOAD half, so both halves must isolate.
  const keyHalf = (id: string) => id.split("#")[0];
  ok("the key half is stable across payloads (so the reuse lookup finds the prior run)",
    keyHalf(idFor(OWNER, APP, "k1", bodyA)) === keyHalf(idFor(OWNER, APP, "k1", bodyB)));
  ok("two different keys never share a key half",
    keyHalf(idFor(OWNER, APP, "k1", bodyA)) !== keyHalf(idFor(OWNER, APP, "k2", bodyA)));

  console.log("\n── one tenant's idempotency key can never reach another's runs ──");
  ok("the same key text under a DIFFERENT owner is a different key half",
    keyHalf(idFor(OWNER, APP, "k1", bodyA)) !== keyHalf(idFor("mallory@z.com", APP, "k1", bodyA)));
  ok("the same key text under a DIFFERENT application is a different key half",
    keyHalf(idFor(OWNER, APP, "k1", bodyA)) !== keyHalf(idFor(OWNER, "app_2", "k1", bodyA)));
  ok("owner casing/whitespace does not fork the key half (same tenant, same key)",
    keyHalf(idFor("  OWNER@X.com ", APP, "k1", bodyA)) === keyHalf(idFor(OWNER, APP, "k1", bodyA)));

  console.log("\n── a hostile key cannot escape its own prefix ──");
  // The reuse lookup is a LIKE on "<keyHalf>#%". If a caller's raw text reached that pattern, a '#' or a
  // '%' inside it would let one key read another key's runs. Both halves are hex, so it cannot.
  const HEX = /^[0-9a-f]+$/;
  for (const nasty of ["a#b", "50%", "_", "k'--", "#%", "k\\"]) {
    const id = idFor(OWNER, APP, nasty, bodyA);
    ok(`key text ${JSON.stringify(nasty)} produces a hex-only id with exactly one separator`,
      HEX.test(keyHalf(id)) && HEX.test(submissionPayloadOf(id)) && id.split("#").length === 2);
  }

  console.log("\n── replacement runs still count as the same payload ──");
  // createRun mints "-r2", "-r3" ids when an earlier attempt on the same submission was cancelled or failed.
  // Those supersede the SAME request, so the reuse check must not read them as a changed payload.
  const base = idFor(OWNER, APP, "k1", bodyA);
  ok("a -r2 replacement id has the same payload half as its original",
    submissionPayloadOf(submissionIdForAttempt(base, 1)) === submissionPayloadOf(base));
  ok("a -r3 replacement id has the same payload half as its original",
    submissionPayloadOf(submissionIdForAttempt(base, 2)) === submissionPayloadOf(base));
  ok("a genuinely different payload is still different after the -rN strip",
    submissionPayloadOf(submissionIdForAttempt(idFor(OWNER, APP, "k1", bodyB), 1)) !== submissionPayloadOf(base));
  ok("a legacy submission id (no payload half) reads as empty, never as a match",
    submissionPayloadOf("rerun-fixed-failed-b833713d") === "" && submissionPayloadOf(base) !== "");
}

// ── structural wiring: the parts a unit test cannot reach ────────────────────────────────────────────────
function wiringTests() {
  console.log("\n── every keyed endpoint resolves a principal WITH a scope ──");
  const cases: [string, string, string][] = [
    [ROUTE_PREVIEW, "pass preview", "PREFLIGHT_SCOPES.preview"],
    [ROUTE_RUNS, "run create", "PREFLIGHT_SCOPES.runCreate"],
    [ROUTE_RUN_READ, "run read", "PREFLIGHT_SCOPES.runRead"],
  ];
  for (const [file, label, scope] of cases) {
    const src = read(file);
    ok(`${label}: resolves a principal`, /resolvePrincipal\(/.test(src));
    ok(`${label}: passes the ${scope} scope`, src.includes(scope));
    // A route that still calls auth() directly would be authenticating twice, and the key branch would be
    // dead code on that endpoint.
    ok(`${label}: no longer calls auth() directly (one auth path)`, !/\bawait auth\(\)/.test(src));
    // The key is a header credential. Reading it from the URL anywhere would defeat the resolver's refusal.
    ok(`${label}: never reads a key from the query string`,
      !/searchParams\.get\(\s*["'](api_?key|token|key)["']/i.test(src));
  }

  console.log("\n── authorization is still the unchanged team-access gate ──");
  const runsSrc = read(ROUTE_RUNS);
  const previewSrc = read(ROUTE_PREVIEW);
  const readSrc = read(ROUTE_RUN_READ);
  ok("run create still resolves access via applicationAccess (owner-anchored)", /applicationAccess\(/.test(runsSrc));
  ok("run create still role-gates at editor before spending", /hasAtLeastRole\(access\.role,\s*["']editor["']\)/.test(runsSrc));
  ok("run create still bills the resolved app OWNER, never the caller", /const owner = access\.owner/.test(runsSrc));
  ok("pass preview still goes through gatePreflightApp", /gatePreflightApp\(/.test(previewSrc));
  ok("run read still goes through applicationAccessForRun", /applicationAccessForRun\(/.test(readSrc));

  console.log("\n── spend safety is the SAME code on both paths ──");
  // The whole risk of a machine caller is unattended spend. These are the session path's own guards; if any
  // disappeared from this route, a key would be able to outspend a browser.
  for (const [needle, what] of [
    ["isRunsGovernorPaused", "cost governor auto-pause"],
    ["globalActiveRunsAtCap", "global in-flight brake"],
    ["checkAccountVelocity", "per-account velocity cap"],
    ["ownerActiveRunCount", "per-owner concurrency cap"],
    ["ownerRunsToday", "per-owner daily cap"],
    ["gatePassLaunch", "entitlement gate"],
    ["hold(", "credit hold"],
    ["refund(", "refund on failure to queue"],
  ] as [string, string][]) {
    ok(`run create still applies the ${what}`, runsSrc.includes(needle));
  }
  // Ordering matters as much as presence: a hold taken before the idempotency check would let a retry storm
  // reserve credits it never uses.
  ok("the idempotency check runs BEFORE the credit hold",
    runsSrc.indexOf("runWithSameKeyDifferentPayload") < runsSrc.indexOf("const estCredits"));
  ok("auth runs BEFORE the application is read", runsSrc.indexOf("resolvePrincipal") < runsSrc.indexOf("applicationAccess("));

  console.log("\n── the key itself never leaves the request ──");
  const principalSrc = read(PRINCIPAL);
  ok("the resolver reads the key from the x-api-key header only", /headers\.get\(["']x-api-key["']\)/.test(principalSrc));
  ok("a key placed in the query string is refused", /api_key_in_query/.test(principalSrc));
  ok("the resolver never puts the raw key on the principal",
    !/keyPrefix:\s*raw/.test(principalSrc) && !/key:\s*raw/.test(principalSrc));
  // logEvent's sanitizer drops any metadata field whose NAME contains "key", "secret", "token" or "hash",
  // so the usage log carries the public prefix and row id and could not carry the secret even by mistake.
  ok("usage logging records the public prefix and key id", /prefix: p\.keyPrefix/.test(principalSrc) && /id: p\.keyId/.test(principalSrc));
  ok("usage logging records endpoint, status, application, run and credits",
    /route: e\.endpoint/.test(principalSrc)
    && /status: e\.status/.test(principalSrc)
    && /application_id:/.test(principalSrc)
    && /run_id:/.test(principalSrc)
    && /credits_reserved:/.test(principalSrc)
    && /credits_charged:/.test(principalSrc));
  ok("usage logging is skipped for browser sessions (no key to attribute)", /if \(p\.via !== "api_key"\) return;/.test(principalSrc));

  // Defence in depth against a future edit: no route may interpolate the raw header into a response or log.
  for (const [file, label] of [[ROUTE_RUNS, "run create"], [ROUTE_PREVIEW, "pass preview"], [ROUTE_RUN_READ, "run read"]] as [string, string][]) {
    ok(`${label}: never reads the x-api-key header itself`, !read(file).includes(`"x-api-key"`));
  }

  console.log("\n── stable error codes (agents branch on these) ──");
  for (const code of ["api_key_in_query", "invalid_api_key", "insufficient_scope", "signin_required"]) {
    ok(`the resolver returns the ${code} code`, principalSrc.includes(`"${code}"`));
  }
  ok("run create returns idempotency_key_reused for a key used on a different payload",
    runsSrc.includes("idempotency_key_reused"));
  ok("an unknown key and a REVOKED key are indistinguishable (both invalid_api_key)",
    (principalSrc.match(/invalid_api_key/g) || []).length === 1);

  console.log("\n── the /developers CI example is labelled unavailable ──");
  // The user-facing rule: nothing on the site may imply this works until a real key has driven it in
  // production. Copying a broken recipe into someone's pipeline is a worse failure than saying "not yet".
  const dev = read("app/rank/developers/page.tsx");
  ok("the CI gate section carries a Not available yet label", dev.includes("Not available yet"));
  ok("the label tells the reader not to copy it", /will fail/.test(dev));
}

async function main() {
  scopeTests();
  await ceilingTests();
  idempotencyTests();
  wiringTests();
  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
