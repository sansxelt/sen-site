// Phase 4.1 — the migration documentation must match the migrations.
//
// sql/README.md said every file here is "applied by hand in the Supabase SQL editor". That is wrong for two
// separate categories, and wrong in a way that does not announce itself:
//
//   1. CREATE/DROP INDEX CONCURRENTLY is REFUSED by PostgreSQL inside a transaction block. A SQL editor
//      that wraps submissions fails them — or, if the failure is a cancelled build, leaves an INVALID index
//      that `if not exists` will skip on every future run, enforcing nothing, silently.
//   2. Every *-verify.sql uses psql meta-commands (\echo, \set, \connect). Those are a psql CLIENT feature,
//      not SQL. A web editor rejects them outright.
//
// Documentation drifts. This asserts the docs against the FILES, so a new CONCURRENTLY migration that the
// README does not mention fails the build rather than waiting to be discovered by an operator mid-deploy.
import { readFileSync, readdirSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8").replace(/\r/g, "");

const README = read("sql/README.md");
const RUNBOOK = read("ops/STAGING-RUNBOOK.md");
const SQL_FILES = readdirSync("sql").filter((f) => f.endsWith(".sql"));

// ── 1. Discover the truth from the files, not from the docs ────────────────
console.log("── what the files actually contain ──");

/** Statements only — a file that merely mentions the word in a comment is not affected. */
const concurrentlyFiles = SQL_FILES.filter((f) => {
  const body = read(`sql/${f}`)
    .split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  return /\b(create|drop)\b[^;]*\bindex\b[^;]*\bconcurrently\b/i.test(body);
}).sort();

const metaCommandFiles = SQL_FILES.filter((f) =>
  read(`sql/${f}`).split("\n").some((l) => /^\\(echo|set|connect|pset|copy)\b/.test(l)),
).sort();

const transactionalFiles = SQL_FILES.filter((f) => {
  const s = read(`sql/${f}`);
  return /^begin;\s*$/im.test(s) && /^commit;\s*$/im.test(s);
}).sort();

console.log(`      CONCURRENTLY statements : ${concurrentlyFiles.join(", ") || "(none)"}`);
console.log(`      psql meta-commands      : ${metaCommandFiles.length} files`);
console.log(`      transactional           : ${transactionalFiles.join(", ") || "(none)"}`);

ok("the CONCURRENTLY set was discovered, not assumed", concurrentlyFiles.length > 0, `${concurrentlyFiles.length} files`);
ok("  a file that only MENTIONS 'concurrently' in a comment is not counted",
  !concurrentlyFiles.includes("vraelis-expire-monthly-atomic.sql"),
  "expire-monthly says 'reachable concurrently' in prose");
ok("  both forward migrations are in the set",
  concurrentlyFiles.includes("vraelis-referral-idempotency.sql") &&
  concurrentlyFiles.includes("vraelis-subscription-id-unique.sql"));
ok("  and BOTH ROLLBACKS are too (DROP INDEX CONCURRENTLY has the same restriction)",
  concurrentlyFiles.includes("vraelis-referral-idempotency-rollback.sql") &&
  concurrentlyFiles.includes("vraelis-subscription-id-unique-rollback.sql"));

// The hard invariant: none of them may carry a transaction wrapper.
for (const f of concurrentlyFiles) {
  ok(`  ${f} carries NO begin/commit`, !transactionalFiles.includes(f));
}
ok("the RLS migration IS transactional, and must stay so",
  transactionalFiles.includes("vraelis-rls-01-deny-by-default.sql"));

// ── 2. The README names every one of them ──────────────────────────────────
console.log("── sql/README.md ──");
{
  ok("the blanket 'applied by hand in the Supabase SQL editor' claim is gone",
    !/They are additive, safe to re-run, and applied by hand in the\nSupabase SQL editor/.test(README));
  ok("it has an explicit apply section", /## How to apply/.test(README));
  ok("it states the transaction restriction", /refused by PostgreSQL inside a transaction|cannot run inside a transaction/i.test(README));

  for (const f of concurrentlyFiles) {
    ok(`  README names ${f}`, README.includes(f));
  }

  ok("it warns about the INVALID-index residue", /INVALID/.test(README) && /indisvalid/.test(README));
  // [\s\S] rather than the dotAll flag: this tsconfig targets below es2018, where /s/ is a compile error.
  ok("  and that a re-run would SKIP it", /if not exists[\s\S]{0,80}(skips|skip)/i.test(README));
  ok("it gives the duplicate pre-checks for both builds",
    /plan_subscription_id, count\(\*\)/.test(README) && /referred_email, count\(\*\)/.test(README));
  ok("it covers the psql meta-command files", /\\echo/.test(README) && /verify\.sql/.test(README));
  ok("it warns about masked exit codes", /tee/.test(README) && /basename/.test(README));
  ok("it points at the runbook as the full procedure", /ops\/STAGING-RUNBOOK\.md/.test(README));
  ok("it says no migration runs before the preflight is CLEAR", /rls-preflight/.test(README) && /CLEAR/.test(README));
}

// ── 3. The runbook agrees with the README ──────────────────────────────────
console.log("── the two documents agree ──");
{
  ok("the runbook no longer says the README is wrong", !/`sql\/README\.md` is wrong for two of these/.test(RUNBOOK));
  ok("  it records that the README was corrected", /has been corrected/.test(RUNBOOK));
  for (const f of concurrentlyFiles) {
    ok(`  runbook accounts for ${f}`, RUNBOOK.includes(f));
  }
  ok("the runbook also covers the psql meta-command files", /\\echo/.test(RUNBOOK));
  ok("both documents name the same preflight gate",
    README.includes("rls-preflight") && RUNBOOK.includes("rls-preflight"));
  ok("neither instructs wrapping a CONCURRENTLY file in a transaction",
    !/begin;[\s\S]{0,200}concurrently/i.test(README) && !/begin;[\s\S]{0,200}concurrently/i.test(RUNBOOK));
}

// ── 4. Every command the docs give is runnable ─────────────────────────────
console.log("── the commands actually work ──");
{
  // Every sql/ and scripts/ path either document references must exist.
  const refs = new Set<string>();
  for (const doc of [README, RUNBOOK]) {
    for (const m of doc.matchAll(/\b(?:sql|scripts|ops)\/[A-Za-z0-9._-]+\.(?:sql|ts|md)\b/g)) refs.add(m[0]);
  }
  const missing = [...refs].filter((r) => {
    try { readFileSync(r); return false; } catch { return true; }
  });
  ok("every file path referenced by either document exists", missing.length === 0, missing.join(", ") || `${refs.size} paths checked`);

  // Every migration must have a rollback — the gap this phase found.
  const forward = SQL_FILES.filter((f) =>
    f.startsWith("vraelis-") && !f.includes("-rollback") && !f.includes("-verify") && !f.includes("-tests")
    && !f.startsWith("vraelis-preflight-") && !["vraelis.sql", "vraelis-rank.sql", "vraelis-preflight.sql", "vraelis-avatars.sql", "vraelis-demo-account.sql", "vraelis-demo-credits.sql"].includes(f));
  const rollbackFor = (f: string) =>
    SQL_FILES.includes(f.replace(/\.sql$/, "-rollback.sql")) ||
    SQL_FILES.includes(f.replace(/-01-deny-by-default\.sql$/, "-01-rollback.sql"));
  const noRollback = forward.filter((f) => !rollbackFor(f));
  ok("every migration on this branch has a rollback", noRollback.length === 0, noRollback.join(", ") || `${forward.length} migrations checked`);

  // psql invocations shown in the docs must not pipe (which would mask the exit code).
  const piped = [...README.matchAll(/^\s*psql [^\n|]*\|[^\n]*/gm)].map((m) => m[0].trim());
  ok("no psql command in the README is piped", piped.length === 0, piped.join(" ; "));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
