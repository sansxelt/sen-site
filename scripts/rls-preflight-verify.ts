// Tests for scripts/rls-preflight.ts — the gate that stands between "the code fixes are committed" and
// "it is safe to run a 95-table RLS migration".
//
// A preflight that can pass when it should not is worse than none, because it launders a guess into an
// approval. So every test here is about making it FAIL when it must:
//
//   1. complete schema        -> CLEAR   (it must not cry wolf, or it will be ignored)
//   2. incomplete schema      -> BLOCKED (a table the migration names is absent: it would abort)
//   3. unexpected table       -> BLOCKED (a surface nobody has reviewed)
//   4. unclassified policy    -> BLOCKED (the migration creates none, so any policy is unreviewed access)
//   5. acknowledged-but-RLS-off -> BLOCKED (the manifest's claim is false in this target)
//   6. a data-bearing dump    -> refused (only schema metadata may leave production)
//   7. no target specified    -> refused (it must never guess which database it is talking to)
//   8. a non-SELECT statement -> refused by the client AND by the server
//
// Requires Docker. Without it, every database-backed check reports SKIP rather than pretending to pass.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// The shape of the preflight's JSON artifact. Declared rather than reached for with `any`, so a change to
// the report's shape shows up here as a type error instead of as a silently-undefined assertion that
// quietly passes.
type Blocker = { code: string; table?: string; detail: string };
type PreflightReport = {
  verdict: "CLEAR" | "BLOCKED";
  transactional: boolean;
  counts: { expected: number; present: number; missing: number; unexpected: number; policies: number };
  expected: string[];
  missing: string[];
  unexpected: string[];
  policies: { table: string; policy: string; roles: string; cmd: string }[];
  blockers: Blocker[];
  warnings: Blocker[];
};

let pass = 0, fail = 0, skipped = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const skip = (n: string, why: string) => { console.log(`SKIP  ${n}  (${why})`); skipped++; };

const MIGRATION = "sql/vraelis-rls-01-deny-by-default.sql";
const CONTAINER = "vraelis-rls-preflight-fixture";
const wait = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const sh = (cmd: string, args: string[]) =>
  spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26 });
const dockerUp = () => sh("docker", ["info"]).status === 0;

/**
 * Run the preflight. Returns its OWN exit status plus the parsed JSON report.
 *
 * `label` names the artifact. Deriving the filename from the ARGUMENTS instead meant every case that ran
 * with the same flags wrote to the same file and silently overwrote the previous one — so a failing case
 * was diagnosed against a different case's report. Each case gets its own artifact.
 */
function runPreflight(extra: string[], label = "case"): { code: number; out: string; report: PreflightReport | null } {
  const jsonPath = join(tmpdirOnce(), `report-${label}.json`);
  const r = spawnSync("npx", ["tsx", "scripts/rls-preflight.ts", ...extra, "--json", jsonPath],
    { encoding: "utf8", maxBuffer: 1 << 26, shell: process.platform === "win32" });
  // r.status is the child's own status. It is NOT read through a pipeline, a command substitution, or a
  // logging helper — each of those can substitute a different process's status for the one you meant.
  const code = r.status ?? -1;
  let report: PreflightReport | null = null;
  if (existsSync(jsonPath)) { try { report = JSON.parse(readFileSync(jsonPath, "utf8")); } catch { /* left null */ } }
  return { code, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, report };
}

let _tmp = "";
const tmpdirOnce = () => (_tmp ||= mkdtempSync(join(tmpdir(), "rls-preflight-")));

/**
 * The tables the migration requires to ALREADY EXIST — the same parse the preflight does, including the
 * subtraction of tables the migration creates for itself. _rls_migration_01_applied is created at the top
 * of the migration and then has RLS enabled like the rest; counting it as a prerequisite means demanding
 * that the migration has already run, which is false on every database this is ever pointed at.
 */
function expectedTables(): string[] {
  const src = readFileSync(MIGRATION, "utf8").replace(/\r/g, "");
  const out = new Set<string>();
  for (const m of src.matchAll(/^alter table public\.([a-z0-9_]+) enable row level security;/gim)) out.add(m[1]);
  for (const m of src.matchAll(/^create table if not exists public\.([a-z0-9_]+)/gim)) out.delete(m[1]);
  return [...out].sort();
}

/**
 * The dependency objects the OTHER migrations need but do not create. A "complete" fixture has to include
 * these or it is not complete — and the preflight is right to block it.
 */
// referral_events is NOT one of the RLS migration's 94 tables, and no CREATE TABLE for it exists anywhere
// in the repository — yet vraelis-referral-idempotency.sql builds a unique index on it. So a schema that
// is "complete" as far as the RLS migration is concerned still lacks it. The fixture has to add it
// explicitly, which is precisely the cross-migration gap the preflight exists to surface.
// The referral_events shape the manifest's contract asserts. Fixtures that should come out CLEAR must
// create THIS, because the preflight now compares columns, not just existence.
const CONTRACT_REFERRAL_EVENTS = `create table public.referral_events (
  id               uuid        primary key default gen_random_uuid(),
  referrer_email   text        not null,
  referred_email   text        not null,
  code             text        not null,
  kind             text        not null,
  credits_awarded  integer     not null default 0,
  created_at       timestamptz not null default now()
);`;

// Everything a "complete" fixture needs EXCEPT referral_events, so a fixture can supply its own shape.
const DEPENDENCY_INDEX_ONLY_TABLES = [
  "alter table public.v_credit_ledger add column if not exists user_id text;",
  "alter table public.v_credit_ledger add column if not exists reason text;",
  "alter table public.v_credit_ledger add column if not exists ext_ref text;",
].join("\n");

const DEPENDENCY_TABLES = [CONTRACT_REFERRAL_EVENTS, DEPENDENCY_INDEX_ONLY_TABLES].join("\n");

// The silent one, kept separate so a fixture can omit JUST this: without v_ledger_extref_uidx,
// v_expire_monthly's replay protection is a no-op and nothing errors to tell you.
const DEPENDENCY_INDEX =
  "create unique index v_ledger_extref_uidx on public.v_credit_ledger (user_id, reason, ext_ref) where ext_ref is not null;";

const DEPENDENCY_DDL = [DEPENDENCY_TABLES, DEPENDENCY_INDEX].join("\n");

/** Build a throwaway database whose PUBLIC SCHEMA contains exactly `tables`, plus optional extra DDL. */
function fixture(tables: string[], extraDdl = ""): void {
  sh("docker", ["rm", "-f", CONTAINER]);
  execFileSync("docker", ["run", "-d", "--name", CONTAINER, "-e", "POSTGRES_PASSWORD=fx", "postgres:16-alpine"], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 60; i += 1) {
    if ((sh("docker", ["exec", CONTAINER, "pg_isready", "-U", "postgres"]).stdout || "").includes("accepting")) { up = true; break; }
    wait(500);
  }
  if (!up) throw new Error("fixture database did not become ready");
  const ddl = [
    "create database target;",
    `\\connect target`,
    "do $$ begin",
    "  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;",
    "  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;",
    "  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;",
    "end $$;",
    ...tables.map((t) => `create table public.${t} (id int);`),
    extraDdl,
  ].join("\n");
  const load = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: ddl, encoding: "utf8", maxBuffer: 1 << 26 });
  if (load.status !== 0) throw new Error(`fixture DDL failed: ${(load.stderr || "").slice(0, 300)}`);
}

function main(): void {
  const expected = expectedTables();
  console.log(`── the migration names ${expected.length} tables explicitly ──`);
  ok("the expected-table list parses to a plausible size", expected.length > 90 && expected.length < 200, `${expected.length}`);
  ok("the list contains no duplicates", new Set(expected).size === expected.length);

  // ── checks that need no database ───────────────────────────────────────
  console.log("── refusals that need no database ──");
  {
    const noTarget = runPreflight([], "no-target");
    ok("refuses to run with no target specified", noTarget.code === 2, `exit=${noTarget.code}`);
    ok("  and says so rather than guessing", /supply one of --url, --dump, or --docker/.test(noTarget.out));

    const dataDump = join(tmpdirOnce(), "with-data.sql");
    writeFileSync(dataDump, [
      "CREATE TABLE public.leads (id int, email text);",
      "COPY public.leads (id, email) FROM stdin;",
      "1\tsomeone@example.test",
      "\\.",
      "",
    ].join("\n"));
    const withData = runPreflight(["--dump", dataDump], "dump-copy");
    ok("REFUSES a dump that carries row data", withData.code === 2, `exit=${withData.code}`);
    ok("  and names the offending markers", /contains ROW DATA/.test(withData.out) && /COPY/.test(withData.out));
    ok("  and tells the operator how to re-export safely", /--schema-only/.test(withData.out));

    const insertDump = join(tmpdirOnce(), "with-inserts.sql");
    writeFileSync(insertDump, "CREATE TABLE public.x (id int);\nINSERT INTO public.x VALUES (1);\n");
    const withInserts = runPreflight(["--dump", insertDump], "dump-insert");
    ok("REFUSES a dump using INSERT rather than COPY", withInserts.code === 2 && /INSERT INTO/.test(withInserts.out));

    const missingManifest = runPreflight(["--docker", "nonexistent", "--manifest", "sql/does-not-exist.json"], "manifest-absent");
    ok("refuses when the manifest is absent", missingManifest.code === 2 && /manifest not found/.test(missingManifest.out));

    const badManifest = join(tmpdirOnce(), "bad.json");
    writeFileSync(badManifest, "{ not json");
    const bad = runPreflight(["--docker", "nonexistent", "--manifest", badManifest], "manifest-bad");
    ok("refuses when the manifest is malformed", bad.code === 2 && /not valid JSON/.test(bad.out));

    const incompleteManifest = join(tmpdirOnce(), "incomplete.json");
    writeFileSync(incompleteManifest, JSON.stringify({ expectedPolicyCount: 0 }));
    const inc = runPreflight(["--docker", "nonexistent", "--manifest", incompleteManifest], "manifest-incomplete");
    ok("refuses when the manifest is missing a required key", inc.code === 2 && /missing required key/.test(inc.out));
  }

  if (!dockerUp()) {
    skip("every database-backed fixture", "Docker is not available on this machine");
    finish();
    return;
  }

  // ── 1. COMPLETE ────────────────────────────────────────────────────────
  console.log("── fixture 1: complete expected schema ──");
  fixture(expected, DEPENDENCY_DDL);
  const complete = runPreflight(["--docker", CONTAINER, "--database", "target"], "complete");
  ok("a complete schema is CLEAR", complete.code === 0, `exit=${complete.code}`);
  ok("  the report says CLEAR", complete.report?.verdict === "CLEAR", complete.report?.verdict);
  ok("  with zero blockers", (complete.report?.blockers ?? []).length === 0);
  ok("  and it actually looked at every expected table", complete.report?.counts?.expected === expected.length,
    `${complete.report?.counts?.expected}/${expected.length}`);
  ok("  and found them present", complete.report?.counts?.missing === 0);
  ok("  it recognises the migration is transactional", complete.report?.transactional === true);
  ok("  a JSON artifact was produced", Boolean(complete.report));

  // ── 2. INCOMPLETE ──────────────────────────────────────────────────────
  console.log("── fixture 2: incomplete schema (one expected table absent) ──");
  const dropped = expected[Math.floor(expected.length / 2)];
  fixture(expected.filter((t) => t !== dropped), DEPENDENCY_DDL);
  const incomplete = runPreflight(["--docker", CONTAINER, "--database", "target"], "incomplete");
  ok("an incomplete schema is BLOCKED", incomplete.code === 1, `exit=${incomplete.code}`);
  ok("  the report says BLOCKED", incomplete.report?.verdict === "BLOCKED");
  ok("  it names the missing table", (incomplete.report?.missing ?? []).includes(dropped), dropped);
  ok("  with a MISSING_TABLE blocker", (incomplete.report?.blockers ?? []).some((b: Blocker) => b.code === "MISSING_TABLE" && b.table === dropped));
  ok("  and explains the migration would abort", (incomplete.report?.blockers ?? []).some((b: Blocker) => /ABORT/i.test(b.detail)));

  // ── 3. UNEXPECTED ──────────────────────────────────────────────────────
  console.log("── fixture 3: an unexpected table ──");
  fixture([...expected, "surprise_table_nobody_reviewed"], DEPENDENCY_DDL);
  const unexpected = runPreflight(["--docker", CONTAINER, "--database", "target"], "unexpected");
  ok("an unexpected table is BLOCKED", unexpected.code === 1, `exit=${unexpected.code}`);
  ok("  it names the table", (unexpected.report?.unexpected ?? []).includes("surprise_table_nobody_reviewed"));
  ok("  with an UNEXPECTED_TABLE blocker", (unexpected.report?.blockers ?? []).some((b: Blocker) => b.code === "UNEXPECTED_TABLE"));
  ok("  and reports its current RLS/grant state so it can be judged",
    (unexpected.report?.blockers ?? []).some((b: Blocker) => b.code === "UNEXPECTED_TABLE" && /rls=/.test(b.detail)));

  // ── 4. UNCLASSIFIED POLICY ─────────────────────────────────────────────
  console.log("── fixture 4: a policy nobody has classified ──");
  fixture(expected, [
    DEPENDENCY_DDL,
    "alter table public.waitlist enable row level security;",
    "create policy anon_can_read on public.waitlist for select to anon using (true);",
  ].join("\n"));
  const policy = runPreflight(["--docker", CONTAINER, "--database", "target"], "policy");
  ok("an unclassified policy is BLOCKED", policy.code === 1, `exit=${policy.code}`);
  ok("  with an UNCLASSIFIED_POLICY blocker", (policy.report?.blockers ?? []).some((b: Blocker) => b.code === "UNCLASSIFIED_POLICY"));
  ok("  it names the policy and the role it grants to",
    (policy.report?.blockers ?? []).some((b: Blocker) => b.code === "UNCLASSIFIED_POLICY" && /anon_can_read/.test(b.detail)));
  ok("  and the policy is in the machine-readable report", (policy.report?.policies ?? []).some((p: { policy: string }) => p.policy === "anon_can_read"));

  // ── 5. MANIFEST CLAIM THAT IS FALSE IN THIS TARGET ─────────────────────
  console.log("── fixture 5: an acknowledged self-protecting table with RLS OFF ──");
  fixture([...expected, "v_oauth_identities"], DEPENDENCY_DDL); // present, but RLS never enabled
  const ackOff = runPreflight(["--docker", CONTAINER, "--database", "target"], "ack-rls-off");
  ok("a manifest claim contradicted by the target is BLOCKED", ackOff.code === 1, `exit=${ackOff.code}`);
  ok("  with an ACK_TABLE_RLS_OFF blocker",
    (ackOff.report?.blockers ?? []).some((b: Blocker) => b.code === "ACK_TABLE_RLS_OFF" && b.table === "v_oauth_identities"));

  // ── 6. A MISSING MIGRATION DEPENDENCY — including the one that fails SILENTLY ───────────────────────
  //
  // This is the case that matters most. v_expire_monthly's replay protection is an
  // `exception when unique_violation` handler, which can only fire if v_ledger_extref_uidx exists. The
  // migration adds the ext_ref COLUMN but never creates the INDEX. With the index absent, the migration
  // applies cleanly, the function runs, and a replayed webhook just inserts a second clawback. Nothing
  // errors. A preflight that only looked for things that fail LOUDLY would wave this through.
  console.log("── fixture 6: a migration dependency that is missing ──");
  fixture(expected, DEPENDENCY_TABLES); // tables present, INDEX deliberately absent
  const missingDep = runPreflight(["--docker", CONTAINER, "--database", "target"], "missing-dependency");
  ok("a missing migration dependency is BLOCKED", missingDep.code === 1, `exit=${missingDep.code}`);
  ok("  it names the silent-failure index",
    (missingDep.report?.blockers ?? []).some((b) => b.code === "MISSING_DEPENDENCY_INDEX" && /v_ledger_extref_uidx/.test(b.detail)));
  ok("  and says which migration needs it",
    (missingDep.report?.blockers ?? []).some((b) => /vraelis-expire-monthly-atomic\.sql/.test(b.detail)));
  ok("  and explains that its absence is SILENT, not an error",
    (missingDep.report?.blockers ?? []).some((b) => b.code === "MISSING_DEPENDENCY_INDEX" && /silent|Nothing errors|silently/i.test(b.detail)));

  console.log("── fixture 7: a missing role ──");
  fixture(expected, [DEPENDENCY_DDL, "drop role if exists authenticated;"].join("\n"));
  const missingRole = runPreflight(["--docker", CONTAINER, "--database", "target"], "missing-role");
  ok("a missing Supabase role is BLOCKED", missingRole.code === 1, `exit=${missingRole.code}`);
  ok("  with a MISSING_DEPENDENCY_ROLE blocker",
    (missingRole.report?.blockers ?? []).some((b) => b.code === "MISSING_DEPENDENCY_ROLE" && /authenticated/.test(b.detail)));

  // ── 8. AN INVALID INDEX left by a failed CONCURRENTLY build ────────────
  //
  // Two migrations use CREATE INDEX CONCURRENTLY. A failed build leaves an INVALID index behind, and
  // because `if not exists` matches on NAME, re-running skips it — so the index stays invalid and
  // enforces nothing, forever, silently.
  console.log("── fixture 8: an INVALID index from a failed concurrent build ──");
  fixture(expected, [
    DEPENDENCY_DDL,
    // Force an invalid index the way a cancelled concurrent build leaves one.
    "create unique index concurrently referral_events_signup_uidx on public.referral_events (id);",
    "update pg_index set indisvalid = false where indexrelid = 'referral_events_signup_uidx'::regclass;",
  ].join("\n"));
  const invalid = runPreflight(["--docker", CONTAINER, "--database", "target"], "invalid-index");
  ok("an INVALID index is BLOCKED", invalid.code === 1, `exit=${invalid.code}`);
  ok("  with an INVALID_INDEX blocker naming it",
    (invalid.report?.blockers ?? []).some((b) => b.code === "INVALID_INDEX" && /referral_events_signup_uidx/.test(b.detail)));
  ok("  and warns that a re-run would skip it",
    (invalid.report?.blockers ?? []).some((b) => b.code === "INVALID_INDEX" && /re-run will skip/i.test(b.detail)));

  // ── 9. referral_events: missing, or STRUCTURALLY DIFFERENT ─────────────
  //
  // Its shape is asserted in a comment and proven nowhere. So a preflight that only asked "does the table
  // exist?" would wave through a table with the right NAME and the wrong COLUMNS — which, for a table the
  // credit-awarding path writes to, is not a smaller problem than it being absent.
  console.log("── fixture 9: referral_events present but structurally WRONG ──");
  {
    // Present, but with a shape that disagrees with the contract in three different ways at once.
    fixture(expected, [
      DEPENDENCY_INDEX_ONLY_TABLES,
      `create table public.referral_events (
         id serial primary key,
         referrer_email text,
         referred_email text not null,
         code text not null,
         kind text not null,
         credits_awarded integer not null default 0,
         created_at timestamptz not null default now(),
         campaign_id text
       );`,
      DEPENDENCY_INDEX,
    ].join("\n"));
    const drift = runPreflight(["--docker", CONTAINER, "--database", "target"], "schema-drift");
    ok("a structurally different referral_events is BLOCKED", drift.code === 1, `exit=${drift.code}`);
    const sm = (drift.report?.blockers ?? []).filter((b) => b.code === "SCHEMA_MISMATCH");
    ok("  with a SCHEMA_MISMATCH blocker", sm.length > 0);
    ok("  it catches the WRONG TYPE (serial/integer vs uuid)", sm.some((b) => /"id" type is integer/.test(b.detail)));
    ok("  it catches the WRONG NULLABILITY (referrer_email)", sm.some((b) => /"referrer_email" is NULLABLE/.test(b.detail)));
    ok("  it catches an EXTRA column the contract does not know about", sm.some((b) => /EXTRA column "campaign_id"/.test(b.detail)));
    ok("  and it says the contract is a hypothesis, not a fact", sm.some((b) => /hypothesis/.test(b.detail)));
  }

  console.log("── fixture 10: referral_events matching the contract exactly ──");
  {
    fixture(expected, [DEPENDENCY_INDEX_ONLY_TABLES, CONTRACT_REFERRAL_EVENTS, DEPENDENCY_INDEX].join("\n"));
    const match = runPreflight(["--docker", CONTAINER, "--database", "target"], "schema-match");
    ok("a contract-matching referral_events is CLEAR", match.code === 0, `exit=${match.code}`);
    ok("  with no SCHEMA_MISMATCH blocker", !(match.report?.blockers ?? []).some((b) => b.code === "SCHEMA_MISMATCH"));
  }

  // ── 10. THE READ-ONLY GUARANTEE ────────────────────────────────────────
  console.log("── the read-only guarantee ──");
  fixture(expected, DEPENDENCY_DDL);
  {
    // The server side: prove default_transaction_read_only actually refuses a write on this connection.
    const write = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "target", "-q", "-v", "ON_ERROR_STOP=1"],
      { input: "set default_transaction_read_only = on; create table public.should_not_exist (id int);", encoding: "utf8" });
    ok("the server refuses a write under default_transaction_read_only", write.status !== 0, `exit=${write.status}`);
    ok("  and says why", /read-only transaction/i.test(`${write.stdout ?? ""}${write.stderr ?? ""}`));

    const stillAbsent = spawnSync("docker", ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "target", "-tAq"],
      { input: "select count(*) from pg_tables where schemaname='public' and tablename='should_not_exist';", encoding: "utf8" });
    ok("  the table really was not created", (stillAbsent.stdout || "").trim() === "0");

    // The client side: the preflight's own source must route every query through the SELECT-only choke
    // point. Asserted structurally because there is no way to make the running program issue a write.
    const src = readFileSync("scripts/rls-preflight.ts", "utf8").replace(/\r/g, "");
    ok("the query channel refuses a non-SELECT", /refusing a non-SELECT statement/.test(src));
    ok("  and sets the session read-only server-side", /default_transaction_read_only = on/.test(src));
    ok("  credentials go through the environment, not argv", /this\.env\.PGPASSWORD/.test(src) && !/--dbname=.*password/.test(src));
    ok("  no application table is ever selected from",
      !/from\s+(vraelis_|v_)[a-z_]*\b/i.test(src.replace(/from pg_tables|from pg_policies|from pg_default_acl|from pg_roles|from pg_namespace/gi, "")));
  }

  sh("docker", ["rm", "-f", CONTAINER]);
  finish();
}

function finish(): void {
  console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
  process.exit(fail === 0 ? 0 : 1);
}

try { main(); } catch (e) { console.error(`FAIL  harness error: ${(e as Error).message}`); sh("docker", ["rm", "-f", CONTAINER]); process.exit(1); }
