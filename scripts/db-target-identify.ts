// Identify a database target and decide whether it may be touched — BEFORE any preflight runs.
//
// It prints five things and nothing else:
//   1. host   2. database   3. user   4. Supabase project ref (if detectable)   5. environment
//
// THE PASSWORD IS NEVER PRINTED, never logged, and never placed in argv. Neither is any other credential.
// The only value this reads from a connection string besides host/db/user is the password, and it does so
// solely to hand it to psql through the child ENVIRONMENT.
//
// ── IT REFUSES, AND REFUSING IS THE DEFAULT ────────────────────────────────────────────────────────────
//
//   - STAGING_URL missing or malformed                      -> exit 2
//   - the target resolves to a known PRODUCTION project     -> exit 3
//   - the environment cannot be POSITIVELY identified as staging -> exit 3
//   - read-only transaction mode cannot be enabled and verified  -> exit 4
//
// That third one is the one that matters most. "Not obviously production" is not the same as "staging".
// An unknown target is refused, because the whole point of this gate is that nobody has to squint at a
// hostname and decide it looks about right.
//
// Usage:  STAGING_URL='postgres://...' npx tsx scripts/db-target-identify.ts
//         npx tsx scripts/db-target-identify.ts --url 'postgres://...'   (discouraged: argv is visible)
//
// Exit: 0 = identified as staging and read-only verified   2 = missing/malformed   3 = refused   4 = read-only unverifiable
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const POLICY_PATH = "ops/db-target-policy.json";

type Policy = {
  productionProjectRefs: { ref: string; source: string; note: string }[];
  productionHostPatterns: string[];
  stagingIndicators: string[];
  localHosts: string[];
  localHostSuffixes: string[];
};

const line = (s = "") => console.log(s);
const refuse = (code: number, why: string, detail = ""): never => {
  line();
  line("  ╭──────────────────────────────────────────────────────────────────────╮");
  line("  │  REFUSED — the preflight will NOT be run against this target.        │");
  line("  ╰──────────────────────────────────────────────────────────────────────╯");
  line(`  Reason: ${why}`);
  if (detail) line(`          ${detail}`);
  line();
  process.exit(code);
};

if (!existsSync(POLICY_PATH)) refuse(2, `policy file not found: ${POLICY_PATH}`, "Without it there is nothing to compare a target against.");
let policy: Policy;
try { policy = JSON.parse(readFileSync(POLICY_PATH, "utf8")) as Policy; }
catch (e) { refuse(2, `policy file is not valid JSON: ${(e as Error).message}`); }

// ── 1. Obtain the URL, without ever printing it ────────────────────────────
const argIdx = process.argv.indexOf("--url");
const raw = (argIdx >= 0 ? process.argv[argIdx + 1] : process.env.STAGING_URL) ?? "";

if (!raw.trim()) {
  refuse(2, "STAGING_URL is not set.",
    "Set it in the environment (not on the command line, where argv is visible to other processes).");
}

let u: URL;
try { u = new URL(raw); }
catch { refuse(2, "STAGING_URL is malformed — it does not parse as a URL.", "Expected: postgres://user:password@host:5432/database"); }

if (!/^postgres(ql)?:$/.test(u!.protocol)) {
  refuse(2, `STAGING_URL has protocol "${u!.protocol}", expected postgres: or postgresql:.`);
}

const host = decodeURIComponent(u!.hostname);
const port = u!.port || "5432";
const database = decodeURIComponent(u!.pathname.replace(/^\//, "")) || "(default)";
const user = decodeURIComponent(u!.username) || "(none)";
const hasPassword = Boolean(u!.password);

if (!host) refuse(2, "STAGING_URL has no host.");
if (user === "(none)") refuse(2, "STAGING_URL has no user.");

// ── 2. Supabase project ref, if detectable ─────────────────────────────────
//
// Two shapes: a direct connection (db.<ref>.supabase.co) and the pooler, where the ref rides in the
// USERNAME (postgres.<ref>@aws-0-<region>.pooler.supabase.com) rather than the host.
function detectRef(h: string, usr: string): { ref: string | null; how: string } {
  const direct = h.match(/^db\.([a-z0-9]{16,})\.supabase\.(co|in)$/i);
  if (direct) return { ref: direct[1], how: "host db.<ref>.supabase.co" };
  const api = h.match(/^([a-z0-9]{16,})\.supabase\.(co|in)$/i);
  if (api) return { ref: api[1], how: "host <ref>.supabase.co" };
  const pooled = usr.match(/^postgres\.([a-z0-9]{16,})$/i);
  if (pooled && /pooler\.supabase\.com$/i.test(h)) return { ref: pooled[1], how: "pooler username postgres.<ref>" };
  if (pooled) return { ref: pooled[1], how: "username postgres.<ref>" };
  return { ref: null, how: "not a recognised Supabase host/user shape" };
}
const { ref, how } = detectRef(host, user);

// ── 3. Classify ────────────────────────────────────────────────────────────
const hay = `${host} ${database} ${user}`.toLowerCase();
const isLocal =
  policy!.localHosts.includes(host.toLowerCase()) ||
  policy!.localHostSuffixes.some((sfx) => host.toLowerCase().endsWith(sfx));

const prodRef = ref ? policy!.productionProjectRefs.find((p) => p.ref.toLowerCase() === ref.toLowerCase()) : undefined;
const prodHost = policy!.productionHostPatterns.find((p) => host.toLowerCase() === p.toLowerCase());
const saysProd = /\bprod(uction)?\b/.test(hay);

// Indicators must match as WORDS, not as substrings.
//
// A raw `hay.includes(s)` classified an unknown project as STAGING, because the indicator "stg" appears
// inside "po-stg-res" — and almost every Postgres URL has `postgres` as its user or database. That is the
// worst possible failure for this gate: it manufactures the very confidence the refusal condition exists
// to withhold. Letters on either side disqualify a match; separators (- _ . /) and string ends do not, so
// "vraelis-staging-db" and "staging.internal" still match.
const matchesIndicator = (s: string) => new RegExp(`(?<![a-z])${s}(?![a-z])`, "i").test(hay);
const saysStaging = policy!.stagingIndicators.some(matchesIndicator);

let environment: "production" | "staging" | "local" | "unknown";
if (prodRef || prodHost || saysProd) environment = "production";
else if (isLocal) environment = "local";
else if (saysStaging) environment = "staging";
else environment = "unknown";

// ── 4. Print the sanitized identification — and ONLY this ──────────────────
line();
line("  ══ TARGET IDENTIFICATION (sanitized) ══════════════════════════════════");
line(`  1. Database host        ${host}:${port}`);
line(`  2. Database name        ${database}`);
line(`  3. Database user        ${user}`);
line(`  4. Supabase project ref ${ref ?? "(not detectable)"}${ref ? "" : `  — ${how}`}`);
line(`  5. Environment          ${environment.toUpperCase()}`);
line();
line(`     password              ${hasPassword ? "PRESENT — REDACTED, never printed or placed in argv" : "absent"}`);
line("  ═══════════════════════════════════════════════════════════════════════");

// ── 5. Refuse, per the stated conditions ───────────────────────────────────
if (prodRef) {
  refuse(3, `the target resolves to a KNOWN PRODUCTION project (${prodRef.ref}).`,
    `Recorded in ${POLICY_PATH}: ${prodRef.note}`);
}
if (prodHost) refuse(3, `the host matches a production pattern (${prodHost}).`);
if (saysProd) refuse(3, "the host, database, or user name contains \"prod\".");
if (environment === "local") {
  refuse(3, "the target is a LOCAL database, not staging.",
    "A local database cannot answer the question this preflight exists to answer, which is what PRODUCTION's schema looks like.");
}
if (environment !== "staging") {
  refuse(3, "the environment cannot be POSITIVELY identified as staging.",
    `Nothing in "${host} / ${database} / ${user}" marks it as staging. Absence of evidence that a target is production is NOT evidence that it is staging — an unknown target is refused by design. Add a staging indicator to the host or database name, or record the ref in ${POLICY_PATH}.`);
}

// ── 6. Read-only mode must be enabled AND verified ─────────────────────────
//
// Verified by asking the SERVER what it thinks the session is, inside a real transaction — not by trusting
// that the SET was sent. Credentials go through the child environment, never argv.
line();
line("  ── verifying read-only transaction mode ──");
const env = { ...process.env };
env.PGHOST = host; env.PGPORT = port; env.PGUSER = user; env.PGDATABASE = database;
if (u!.password) env.PGPASSWORD = decodeURIComponent(u!.password);
const ssl = u!.searchParams.get("sslmode");
if (ssl) env.PGSSLMODE = ssl;

const probe = spawnSync("psql", ["-q", "-tA", "-v", "ON_ERROR_STOP=1"], {
  input: [
    "set default_transaction_read_only = on;",
    "begin;",
    // Catalog metadata only. No application table is read.
    "select current_setting('transaction_read_only') || '|' || current_setting('default_transaction_read_only') || '|' || current_database() || '|' || current_user || '|' || version();",
    "rollback;",
  ].join("\n"),
  encoding: "utf8", env, maxBuffer: 1 << 24,
});
const status = probe.status;

if (status !== 0) {
  refuse(4, `could not connect or could not enable read-only mode (psql exited ${status}).`,
    (probe.stderr || "").trim().split("\n").slice(0, 2).join(" | ").replace(/password=\S+/gi, "password=REDACTED"));
}
const row = (probe.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean).find((l) => l.includes("|"));
if (!row) { refuse(4, "read-only mode could not be VERIFIED - the server returned no readable answer."); throw new Error("unreachable"); }

const [txnRo, defaultRo, liveDb, liveUser, ver] = row.split("|");
line(`     transaction_read_only          ${txnRo}`);
line(`     default_transaction_read_only  ${defaultRo}`);
line(`     server reports database/user    ${liveDb} / ${liveUser}`);
line(`     server version                  ${(ver ?? "").split(" ").slice(0, 2).join(" ")}`);

if (txnRo !== "on" || defaultRo !== "on") {
  refuse(4, "read-only transaction mode is NOT in force on this connection.",
    `The server reports transaction_read_only=${txnRo}, default_transaction_read_only=${defaultRo}. Both must be "on".`);
}
// The URL said one thing; the server said another. Trust the server, and stop.
if (liveDb !== database && database !== "(default)") {
  refuse(3, `the server reports database "${liveDb}" but the URL named "${database}".`,
    "Identification must be unambiguous before anything runs.");
}

line();
line("  ✓ Target identified as STAGING and read-only mode verified by the server.");
line("    Nothing has been read from any application table.");
line();
process.exit(0);
