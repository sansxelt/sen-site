// Prototype-chain hardening of the shared OAuth provider registry, and the same class of bug in the
// fee-rate lookup.
//
// The bug: lib/preflight/oauth/providers.ts resolved a provider with a bare `REGISTRY[kind]` on a plain
// object, so an INHERITED key came back truthy — resolveOAuthProvider("constructor") returned
// Object.prototype.constructor. Three routes pass an attacker-controlled path segment straight into that
// helper and treat a truthy result as "this is a real provider", then read p.pkce / p.tokenUrl /
// p.clientIdEnv (all undefined) and interpolate the same unvalidated kind into a redirect_uri via
// callbackPath(). The fix is an own-key Map lookup in the shared helper, so every caller fails closed
// without relying on any of them to pre-validate.
//
// The same pattern was confirmed in cutRateFor(): CUT_RATES["constructor"] read as truthy, so the function
// returned undefined instead of the 0.2 starter rate, and callers compute Math.round(cents * rate) — a NaN
// platform fee.
//
// Behavioural against the real exported functions; the per-route assertions are source-level, because the
// handlers require a live session and DB.
import { readFileSync } from "node:fs";
import {
  resolveOAuthProvider,
  registeredOAuthKinds,
  OAUTH_PROVIDER_KINDS,
  providerAvailable,
  providerConfigured,
  providerGateOpen,
  callbackPath,
} from "../lib/preflight/oauth/providers";
import { cutRateFor, CUT_RATES } from "../lib/vraelis-plans";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");

// Every shape the requirement calls out.
const HOSTILE: unknown[] = [
  "constructor", "prototype", "__proto__", "toString", "valueOf", "hasOwnProperty",
  "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "__defineGetter__", "__lookupGetter__",
  "GitHub", "GITHUB", "GitHub ", " github", "github ", "Github",
  "VERCEL", "Stripe_Test", "SUPABASE",
  "github%2F", "%2Fgithub", "github%00", "github/", "github\\", "github".toUpperCase(),
  "", "   ", "\t", "\n",
  "nope", "unknown", "null", "undefined", "0", "1", "[object Object]",
  "github,vercel", "github vercel",
];

// ── 1. resolver fails closed on every hostile shape ─────────────────────────
console.log("── resolveOAuthProvider fails closed ──");
for (const k of HOSTILE) {
  const r = resolveOAuthProvider(k as string);
  ok(`${JSON.stringify(k)} -> null`, r === null, r === null ? "" : `got ${typeof r}`);
}
// Non-string runtime inputs (reachable from untyped JS or a JSON body).
// BigInt(1) rather than a 1n literal: tsconfig targets below ES2020, where the literal is a type error.
const NON_STRINGS: unknown[] = [null, undefined, 0, 1, true, false, {}, [], Symbol("github"), () => {}, BigInt(1)];
for (const v of NON_STRINGS) {
  let label: string;
  try { label = typeof v === "symbol" ? "Symbol(github)" : typeof v === "bigint" ? "1n" : JSON.stringify(v) ?? String(v); }
  catch { label = String(v); }
  ok(`non-string ${label} -> null`, resolveOAuthProvider(v as string) === null);
}
// The specific regression: the OLD implementation would have returned a truthy value for these.
for (const k of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"]) {
  const plainObjectWouldBeTruthy = !!(({} as Record<string, unknown>)[k]);
  ok(`${JSON.stringify(k)} is truthy on a plain object (the hazard is real)`, plainObjectWouldBeTruthy);
  ok(`${JSON.stringify(k)} is NOT truthy through the resolver (the hazard is closed)`, !resolveOAuthProvider(k));
}

// ── 2. valid provider behaviour is unchanged ────────────────────────────────
console.log("── valid providers unchanged ──");
const EXPECTED = ["github", "vercel", "sentry", "stripe_test", "supabase"];
for (const k of EXPECTED) {
  const p = resolveOAuthProvider(k);
  ok(`${k} still resolves`, !!p);
  ok(`${k} resolves to its own kind`, p?.kind === k);
  ok(`${k} carries its authorize + token URLs`, !!p?.authorizeUrl && !!p?.tokenUrl);
  ok(`${k} carries its credential env names`, !!p?.clientIdEnv && !!p?.clientSecretEnv);
  ok(`${k} callbackPath is the fixed per-provider path`, callbackPath(k) === `/api/preflight/apps/oauth/callback/${k}`);
}
// Field-level spot checks, so "unchanged" means unchanged in substance, not just non-null.
ok("supabase still mandates PKCE", resolveOAuthProvider("supabase")?.pkce === true);
ok("supabase is still env-gated", resolveOAuthProvider("supabase")?.gatedByEnv === "SUPABASE_OAUTH_ENABLED");
ok("sentry is still refreshable", resolveOAuthProvider("sentry")?.refreshable === true);
ok("github is still not refreshable", resolveOAuthProvider("github")?.refreshable === false);
ok("stripe_test still reuses STRIPE_SECRET_KEY", resolveOAuthProvider("stripe_test")?.clientSecretEnv === "STRIPE_SECRET_KEY");
ok("vercel still persists teamId", (resolveOAuthProvider("vercel")?.persistCallbackParams ?? []).includes("teamId"));
// The helpers that take a resolved provider still work on one.
{
  const gh = resolveOAuthProvider("github")!;
  ok("providerConfigured accepts a resolved provider", typeof providerConfigured(gh) === "boolean");
  ok("providerGateOpen is true for a non-gated provider", providerGateOpen(gh) === true);
  ok("providerAvailable is a boolean", typeof providerAvailable(gh) === "boolean");
}

// ── 3. registry and display list agree ──────────────────────────────────────
console.log("── registry / display-list agreement ──");
const registered = [...registeredOAuthKinds()].sort();
// Widened to string[]: OAUTH_PROVIDER_KINDS is a readonly literal tuple, so .includes(someString) is a
// type error against the narrow union.
const displayed: string[] = [...OAUTH_PROVIDER_KINDS].sort();
ok("every registered kind is displayable", registered.every((k) => displayed.includes(k)), registered.join(","));
ok("every displayed kind is registered", displayed.every((k) => registered.includes(k)), displayed.join(","));
ok("the two lists are the same size", registered.length === displayed.length);
ok("registeredOAuthKinds contains no inherited keys", registered.every((k) => !["constructor", "__proto__", "toString"].includes(k)));
ok("the expected five providers are registered", EXPECTED.every((k) => registered.includes(k)) && registered.length === 5);

// ── 4. cutRateFor: same class of bug, in the money path ─────────────────────
console.log("── cutRateFor own-key lookup ──");
for (const k of ["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty", "prototype"]) {
  const r = cutRateFor(k, "monthly");
  ok(`cutRateFor(${JSON.stringify(k)}) is a finite number`, Number.isFinite(r), `got ${String(r)}`);
  ok(`cutRateFor(${JSON.stringify(k)}) falls back to the starter rate`, r === 0.2, `got ${String(r)}`);
}
ok("an unknown plan still falls back to starter", cutRateFor("nope", "monthly") === 0.2);
ok("null plan still falls back to starter", cutRateFor(null, "monthly") === 0.2);
ok("empty plan still falls back to starter", cutRateFor("", "monthly") === 0.2);
// Real plans unchanged.
ok("solo monthly is unchanged", cutRateFor("solo", "monthly") === 0.07);
ok("solo lifetime is unchanged", cutRateFor("solo", "lifetime") === 0.1);
ok("growth monthly is unchanged", cutRateFor("growth", "monthly") === 0.05);
ok("growth yearly is unchanged", cutRateFor("growth", "yearly") === 0.05);
ok("agency monthly is unchanged", cutRateFor("agency", "monthly") === 0.02);
ok("starter is unchanged", cutRateFor("starter", "monthly") === 0.2);
ok("an unknown CYCLE still defaults to monthly", cutRateFor("solo", "bogus") === cutRateFor("solo", "monthly"));
// The fee arithmetic callers actually perform must never produce NaN.
for (const k of ["constructor", "__proto__", "nope", null, "solo"]) {
  const fee = Math.round(10_000 * cutRateFor(k as string | null, "monthly"));
  ok(`fee for plan ${JSON.stringify(k)} is a finite integer`, Number.isFinite(fee) && Number.isInteger(fee), `got ${fee}`);
}
ok("CUT_RATES itself has no inherited own-key surprise", !Object.prototype.hasOwnProperty.call(CUT_RATES, "constructor"));

// ── 5. every consuming route still fails closed on a null provider ──────────
console.log("── consuming routes fail closed ──");
const CONSUMERS = [
  "app/api/preflight/apps/oauth/callback/[provider]/route.ts",
  "app/api/preflight/apps/[id]/connections/oauth/[provider]/route.ts",
  "app/api/preflight/connections/[provider]/oauth/route.ts",
  "app/api/preflight/connections/route.ts",
  "lib/preflight/oauth/refresh.ts",
];
for (const f of CONSUMERS) {
  const src = read(f);
  ok(`${f.split("/").slice(-2).join("/")} resolves through the shared helper`, src.includes("resolveOAuthProvider("));
  // The three path-segment routes must have an explicit `if (!p) return <fail>` guard.
  if (f.includes("[provider]")) {
    ok(`${f.split("/").slice(-2).join("/")} guards on a null provider`, /if\s*\(!\s*p\s*\)\s*return/.test(src));
  }
  // refresh.ts guards differently and correctly: `!p?.refreshable` short-circuits on null, so a null
  // provider falls through to returning the stored token rather than attempting a refresh against
  // undefined URLs. Accept optional-chaining as a valid null guard here.
  if (f.includes("refresh.ts")) {
    ok("oauth/refresh.ts guards a null provider via optional chaining", /!\s*p\?\./.test(src));
    ok("oauth/refresh.ts never dereferences p without a guard first",
      src.indexOf("!p?.refreshable") < src.indexOf("readClientId(p)"));
  }
}
{
  const providers = read("lib/preflight/oauth/providers.ts");
  ok("the resolver uses an own-key Map, not a plain-object index", providers.includes("REGISTRY_BY_KIND.get(kind)"));
  ok("the resolver no longer indexes REGISTRY directly", !/return REGISTRY\[kind\]/.test(providers));
  ok("the resolver rejects non-string input", providers.includes('typeof kind !== "string"'));
  ok("the resolver rejects the empty string", providers.includes('kind === ""'));
  const plans = read("lib/vraelis-plans.ts");
  ok("cutRateFor uses hasOwnProperty", plans.includes("Object.prototype.hasOwnProperty.call(CUT_RATES, plan)"));
  ok("cutRateFor no longer uses bare truthiness", !/CUT_RATES\[plan\]\s*\?/.test(plans));
  const pkg = read("package.json");
  ok("package.json exposes oauth:registry:test", pkg.includes(`"oauth:registry:test"`) && pkg.includes("oauth-registry-hardening-verify.ts"));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
