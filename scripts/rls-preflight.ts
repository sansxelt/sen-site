// RLS deployment preflight — READ-ONLY schema reconciliation.
//
// WHY THIS EXISTS. sql/vraelis-rls-01-deny-by-default.sql enables RLS on 95 tables by name, in one
// transaction, with no `if exists` guard — so a single absent table rolls the whole thing back. The
// schema those names come from is spread across TWO directories: sql/ and docs/. Every one of the 95 is
// defined somewhere, but roughly 42 of them only under docs/*.sql, which sql/README.md never mentions as
// part of the migration path. A schema built from sql/ alone is missing them.
//
// So "all the code fixes are committed" is nowhere near "safe to run a 95-table RLS migration against
// production", and this script is the gate between those two statements.
//
// It also checks the dependencies the OTHER migrations need but do not create — including one
// (v_ledger_extref_uidx) whose absence makes a migration apply cleanly and silently not work.
//
// It compares five things and refuses to say "clear" unless they reconcile:
//   1. the tables the migration EXPECTS      (parsed from the migration file, so it cannot drift)
//   2. the tables actually PRESENT           (from the target database's catalog)
//   3. which tables already have RLS enabled
//   4. the policies and privileges expected to hold afterwards
//   5. the tables intentionally excluded, and why       (sql/rls-preflight-manifest.json)
//
// IT FAILS CLOSED. A missing table, an unexpected table, or a policy nobody has classified all BLOCK.
// Silence is never treated as consent: a table the manifest does not mention is a surface nobody has
// reviewed, and that is exactly the thing this is meant to catch.
//
// ── READ-ONLY, AND THAT IS ENFORCED, NOT PROMISED ──────────────────────────────────────────────────────
// Every statement is asserted to be a SELECT before it is sent, and the session is opened with
// default_transaction_read_only = on so the SERVER refuses a write even if that assertion were wrong.
// It reads catalog metadata only (pg_tables, pg_policies, information_schema, pg_default_acl) and never
// selects from an application table, so it cannot read customer data even accidentally.
//
// Credentials are passed to psql through the CHILD ENVIRONMENT (PGHOST/PGUSER/PGPASSWORD/...), never on
// the command line, so they do not appear in the process list. Nothing prints a password.
//
// ── USAGE ──────────────────────────────────────────────────────────────────────────────────────────────
//   tsx scripts/rls-preflight.ts --url postgres://user:pass@host:5432/db  [--json out.json]
//   tsx scripts/rls-preflight.ts --dump prod-schema.sql                   [--json out.json]
//   tsx scripts/rls-preflight.ts --docker <container> --database <db>     [--json out.json]
//
// --dump takes a `pg_dump --schema-only` file and loads it into a THROWAWAY local container. It REFUSES a
// dump containing row data (COPY/INSERT), which enforces the rule that only schema-only metadata leaves
// production.
//
// Exit: 0 = CLEAR (preflight passed)   1 = BLOCKED (do not migrate)   2 = ERROR (could not determine)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

// ASCII unit separator, built from its code point rather than typed as a literal: a raw control character
// does not survive being copied between tools. It silently becomes the empty string, and an empty field
// separator makes every row parse as a single column.
const SEP = String.fromCharCode(31);

type Args = {
  url?: string; dump?: string; docker?: string; database: string;
  json?: string; manifest: string; migration: string;
};

function parseArgs(argv: string[]): Args {
  const get = (n: string): string | undefined => {
    const i = argv.indexOf(n);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
  };
  return {
    url: get("--url"),
    dump: get("--dump"),
    docker: get("--docker"),
    database: get("--database") ?? "postgres",
    json: get("--json"),
    manifest: get("--manifest") ?? "sql/rls-preflight-manifest.json",
    migration: get("--migration") ?? "sql/vraelis-rls-01-deny-by-default.sql",
  };
}

// ── The read-only query channel ────────────────────────────────────────────
//
// One choke point. Every query in this file goes through it, so the read-only guarantee is a property of
// the program rather than a habit of whoever edits it next.
class ReadOnlyDb {
  private env: NodeJS.ProcessEnv;
  private mode: "local" | "docker";
  private container = "";
  private database: string;

  constructor(opts: { url?: string; docker?: string; database: string }) {
    this.database = opts.database;
    this.env = { ...process.env };
    if (opts.docker) {
      this.mode = "docker";
      this.container = opts.docker;
      return;
    }
    if (!opts.url) throw new Error("no connection specified");
    // Parse the URL here so the credential travels in the ENVIRONMENT, not in argv where `ps` would show
    // it. PGPASSWORD is read by psql directly.
    const u = new URL(opts.url);
    this.env.PGHOST = decodeURIComponent(u.hostname);
    this.env.PGPORT = u.port || "5432";
    this.env.PGUSER = decodeURIComponent(u.username);
    if (u.password) this.env.PGPASSWORD = decodeURIComponent(u.password);
    this.env.PGDATABASE = decodeURIComponent(u.pathname.replace(/^\//, "")) || opts.database;
    const ssl = u.searchParams.get("sslmode");
    if (ssl) this.env.PGSSLMODE = ssl;
    this.mode = "local";
    this.database = this.env.PGDATABASE;
  }

  /** Every read goes through here. Non-SELECT is refused before it reaches the network. */
  query(sql: string): string[][] {
    const trimmed = sql.trim().replace(/\s+/g, " ");
    if (!/^select /i.test(trimmed)) {
      throw new Error(`refusing a non-SELECT statement in a read-only preflight: ${trimmed.slice(0, 60)}`);
    }
    // Belt and braces: the client refuses to send a write, and the SERVER refuses to perform one.
    const wrapped = `set default_transaction_read_only = on; ${sql}`;
    // -q so the "SET" command tag does not land in stdout and get parsed as a data row.
    const psqlArgs = ["-q", "-tAF", SEP, "-v", "ON_ERROR_STOP=1"];
    const args = this.mode === "docker"
      ? ["exec", "-i", this.container, "psql", "-U", "postgres", "-d", this.database, ...psqlArgs]
      : psqlArgs;
    const bin = this.mode === "docker" ? "docker" : "psql";
    const r = spawnSync(bin, args, { input: wrapped, encoding: "utf8", env: this.env, maxBuffer: 1 << 26 });
    const code = r.status;
    if (code !== 0) {
      // Never echo the environment; the message may contain a host but never the password.
      throw new Error(`psql exited ${code}: ${(r.stderr || "").trim().split("\n").slice(0, 3).join(" | ")}`);
    }
    return (r.stdout || "")
      .split("\n")
      .map((l) => l.replace(/\r$/, ""))
      .filter((l) => l.length > 0 && l !== "SET")
      .map((l) => l.split(SEP));
  }
}

// ── Expectations, parsed from the migration itself ─────────────────────────
function expectedTables(migrationPath: string): string[] {
  const src = readFileSync(migrationPath, "utf8").replace(/\r/g, "");
  const out = new Set<string>();
  // Only explicit, unconditional statements at the start of a line. Deliberately does NOT match the
  // catch-all DO block, because the catch-all is the safety net — the point of the preflight is to know
  // what the reviewable list covers versus what only the net would catch.
  for (const m of src.matchAll(/^alter table public\.([a-z0-9_]+) enable row level security;/gim)) {
    out.add(m[1]);
  }
  // SUBTRACT anything the migration CREATES for itself. _rls_migration_01_applied is created at the top of
  // the file and then has RLS enabled like everything else, so a naive parse counts it as a table that
  // must already exist — and it does not exist on any database where the migration has not run yet, which
  // is every database this preflight is pointed at. That produced a MISSING_TABLE blocker on a perfectly
  // healthy target: the preflight failing on its own migration's output.
  for (const m of src.matchAll(/^create table if not exists public\.([a-z0-9_]+)/gim)) {
    out.delete(m[1]);
  }
  return [...out].sort();
}

/** Tables the migration creates itself. Reported separately so their absence reads as normal, not missing. */
function createdByMigration(migrationPath: string): string[] {
  const src = readFileSync(migrationPath, "utf8").replace(/\r/g, "");
  return [...new Set([...src.matchAll(/^create table if not exists public\.([a-z0-9_]+)/gim)].map((m) => m[1]))].sort();
}

function migrationIsTransactional(migrationPath: string): boolean {
  const src = readFileSync(migrationPath, "utf8").replace(/\r/g, "");
  return /^begin;\s*$/im.test(src) && /^commit;\s*$/im.test(src);
}

/**
 * Is this connection string a production project the policy denies?
 *
 * Recognises BOTH Supabase shapes, because they hide the ref in different places: the direct form puts it
 * in the host (db.<ref>.supabase.co), while the pooler puts it in the USERNAME
 * (postgres.<ref>@aws-0-....pooler.supabase.com). Checking only the host would let the pooler form
 * straight through — and the pooler form is the one people actually paste.
 *
 * Fails CLOSED on a missing or unreadable policy: no policy means no way to know a target is safe.
 */
function deniedProductionRef(url: string): { ref: string; note: string } | null {
  const POLICY = "ops/db-target-policy.json";
  let policy: { productionProjectRefs?: { ref: string; note?: string }[] };
  try { policy = JSON.parse(readFileSync(POLICY, "utf8")); }
  catch { return { ref: "(policy unreadable)", note: `${POLICY} is missing or malformed, so no target can be shown to be safe.` }; }

  let host = "", user = "";
  try { const u = new URL(url); host = u.hostname.toLowerCase(); user = decodeURIComponent(u.username).toLowerCase(); }
  catch { return null; } // a malformed URL fails later, on its own terms

  const fromHost = host.match(/^(?:db\.)?([a-z0-9]{16,})\.supabase\.(?:co|in)$/);
  const fromUser = user.match(/^postgres\.([a-z0-9]{16,})$/);
  const ref = fromHost?.[1] ?? fromUser?.[1] ?? null;
  if (!ref) return null;

  const hit = (policy.productionProjectRefs ?? []).find((p) => p.ref.toLowerCase() === ref);
  return hit ? { ref: hit.ref, note: hit.note ?? "recorded as a production project" } : null;
}

// ── Report model ───────────────────────────────────────────────────────────
type TableRow = { table: string; rls: boolean; browserGrants: string[] };
type Blocker = { code: string; table?: string; detail: string };

function main(): number {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(args.manifest)) {
    console.error(`ERROR  manifest not found: ${args.manifest}`);
    return 2;
  }
  if (!existsSync(args.migration)) {
    console.error(`ERROR  migration not found: ${args.migration}`);
    return 2;
  }

  let manifest: {
    expectedPolicyCount: number; allowedPolicies: { table: string; policy: string }[];
    browserFacingRoles: string[]; privilegedRoles: string[];
    acknowledgedExtraTables: { table: string; reason: string; rlsExpected: boolean }[];
    intentionallyExcluded: { table: string; reason: string }[];
    migrationDependencies?: { kind: string; name: string; table?: string; severity: string; requiredBy: string[]; reason: string }[];
    expectedColumns?: Record<string, { source: string; confidence?: string; columns: { name: string; type: string; nullable: boolean; confidence?: string; why?: string }[] }>;
  };
  try {
    manifest = JSON.parse(readFileSync(args.manifest, "utf8"));
  } catch (e) {
    console.error(`ERROR  manifest is not valid JSON: ${(e as Error).message}`);
    return 2;
  }
  for (const k of ["expectedPolicyCount", "allowedPolicies", "browserFacingRoles", "acknowledgedExtraTables", "intentionallyExcluded"] as const) {
    if (manifest[k] === undefined) {
      console.error(`ERROR  manifest is missing required key: ${k}`);
      return 2;
    }
  }

  // ── DENYLIST, CHECKED HERE TOO ───────────────────────────────────────────
  //
  // scripts/db-target-identify.ts is the gate that is SUPPOSED to run first, but nothing forces anyone to
  // run it — this script accepts --url directly. A gate that can be walked around is a suggestion. So the
  // denylist is enforced at the point of connection as well, and a target resolving to a production
  // project is refused here even if the identify step was skipped entirely.
  if (args.url) {
    const denied = deniedProductionRef(args.url);
    if (denied) {
      console.error(`\nREFUSED  the target resolves to a production project (${denied.ref}).`);
      console.error(`         ${denied.note}`);
      console.error("         This is a staging tool. It does not point at production, read-only or not.\n");
      return 3;
    }
  }

  let db: ReadOnlyDb;
  let ephemeral = "";
  try {
    if (args.dump) {
      const loaded = loadDumpIntoThrowaway(args.dump);
      if ("error" in loaded) { console.error(`ERROR  ${loaded.error}`); return 2; }
      ephemeral = loaded.container;
      db = new ReadOnlyDb({ docker: loaded.container, database: loaded.database });
    } else if (args.docker) {
      db = new ReadOnlyDb({ docker: args.docker, database: args.database });
    } else if (args.url) {
      db = new ReadOnlyDb({ url: args.url, database: args.database });
    } else {
      console.error("ERROR  supply one of --url, --dump, or --docker. Refusing to guess a target.");
      return 2;
    }

    const result = reconcile(db, args, manifest);
    if (args.json) {
      writeFileSync(args.json, JSON.stringify(result, null, 2));
      console.log(`\nJSON written to ${args.json}`);
    }
    return result.verdict === "CLEAR" ? 0 : 1;
  } catch (e) {
    console.error(`ERROR  ${(e as Error).message}`);
    return 2;
  } finally {
    if (ephemeral) { try { execFileSync("docker", ["rm", "-f", ephemeral], { stdio: "ignore" }); } catch { /* best effort */ } }
  }
}

function reconcile(db: ReadOnlyDb, args: Args, manifest: {
  expectedPolicyCount: number; allowedPolicies: { table: string; policy: string }[];
  browserFacingRoles: string[]; privilegedRoles: string[];
  acknowledgedExtraTables: { table: string; reason: string; rlsExpected: boolean }[];
  intentionallyExcluded: { table: string; reason: string }[];
  migrationDependencies?: { kind: string; name: string; table?: string; severity: string; requiredBy: string[]; reason: string }[];
  expectedColumns?: Record<string, { source: string; confidence?: string; columns: { name: string; type: string; nullable: boolean; confidence?: string; why?: string }[] }>;
}) {
  const blockers: Blocker[] = [];
  const warnings: Blocker[] = [];

  // 1. Expected — from the migration file.
  const expected = expectedTables(args.migration);
  const created = createdByMigration(args.migration);
  const transactional = migrationIsTransactional(args.migration);

  // 2. Present + 3. RLS state — from the catalog.
  const roleList = manifest.browserFacingRoles.map((r) => `'${r.replace(/'/g, "''")}'`).join(",");
  const rows = db.query(`
    select t.tablename,
           t.rowsecurity::text,
           coalesce((select string_agg(distinct g.grantee, ',')
                       from information_schema.role_table_grants g
                      where g.table_schema = 'public'
                        and g.table_name = t.tablename
                        and g.grantee in (${roleList})), '')
      from pg_tables t
     where t.schemaname = 'public'
     order by t.tablename`);
  const present: TableRow[] = rows.map((r) => ({
    table: r[0],
    rls: r[1] === "t" || r[1] === "true",
    browserGrants: r[2] ? r[2].split(",").filter(Boolean) : [],
  }));
  const presentNames = new Set(present.map((p) => p.table));

  // 4. Policies.
  const policyRows = db.query(
    `select schemaname, tablename, policyname, roles::text, cmd from pg_policies where schemaname = 'public' order by tablename, policyname`,
  );
  const policies = policyRows.map((r) => ({ table: r[1], policy: r[2], roles: r[3], cmd: r[4] }));

  // Default privileges for FUTURE objects — the thing that silently re-opens a schema after it is locked.
  const defaclRows = db.query(`
    select r.rolname, coalesce(n.nspname, '-'), a.defaclobjtype::text, a.defaclacl::text
      from pg_default_acl a
      join pg_roles r on r.oid = a.defaclrole
      left join pg_namespace n on n.oid = a.defaclnamespace`);
  const defaultAcls = defaclRows.map((r) => ({ role: r[0], schema: r[1], objType: r[2], acl: r[3] }));

  // 5. Manifest classifications.
  const acked = new Map(manifest.acknowledgedExtraTables.map((t) => [t.table, t]));
  const excluded = new Map(manifest.intentionallyExcluded.map((t) => [t.table, t]));

  // ── Reconcile ────────────────────────────────────────────────────────────
  const missing = expected.filter((t) => !presentNames.has(t));
  const unexpected = present
    .map((p) => p.table)
    // `created` is subtracted too: if a previous attempt already made the migration's own ledger table,
    // its presence is expected, not a surprise.
    .filter((t) => !expected.includes(t) && !created.includes(t) && !acked.has(t) && !excluded.has(t));

  for (const t of missing) {
    blockers.push({
      code: "MISSING_TABLE", table: t,
      detail: transactional
        ? "named in the migration but absent from the target. The migration is transactional, so it would ABORT and change nothing — but it would not run. Reconcile the list or the schema first."
        : "named in the migration but absent from the target. The migration is NOT transactional, so it could apply partially before failing.",
    });
  }
  for (const t of unexpected) {
    const row = present.find((p) => p.table === t)!;
    blockers.push({
      code: "UNEXPECTED_TABLE", table: t,
      detail: `present in the target but not named in the migration and not accounted for in the manifest. Currently rls=${row.rls}, browser-role grants=[${row.browserGrants.join(",") || "none"}]. The catch-all WOULD enable RLS on it, but nobody has reviewed it. Add it to acknowledgedExtraTables or intentionallyExcluded with a reason.`,
    });
  }

  const allowed = new Set(manifest.allowedPolicies.map((p) => `${p.table}.${p.policy}`));
  for (const p of policies) {
    if (!allowed.has(`${p.table}.${p.policy}`)) {
      blockers.push({
        code: "UNCLASSIFIED_POLICY", table: p.table,
        detail: `policy "${p.policy}" (cmd=${p.cmd}, roles=${p.roles}) exists on this table. The migration creates no policies, so this predates it and grants row access to some role. Classify it in allowedPolicies before migrating.`,
      });
    }
  }
  if (policies.length !== manifest.expectedPolicyCount && manifest.allowedPolicies.length === 0 && policies.length > 0) {
    warnings.push({
      code: "POLICY_COUNT", detail: `manifest expects ${manifest.expectedPolicyCount} policies; the target has ${policies.length}.`,
    });
  }

  // Informational, not blocking: the state the migration is about to change.
  const alreadyRls = present.filter((p) => p.rls).length;
  const withBrowserGrants = present.filter((p) => p.browserGrants.length > 0);
  for (const t of manifest.acknowledgedExtraTables) {
    const row = present.find((p) => p.table === t.table);
    if (!row) {
      warnings.push({ code: "ACK_TABLE_ABSENT", table: t.table, detail: "acknowledged in the manifest but not present in this target. Harmless here; means the manifest is ahead of this database." });
    } else if (t.rlsExpected && !row.rls) {
      blockers.push({ code: "ACK_TABLE_RLS_OFF", table: t.table, detail: `manifest says this table protects itself (rlsExpected true) but RLS is OFF in the target. Its own migration has not run, or was rolled back.` });
    }
  }
  for (const t of manifest.intentionallyExcluded) {
    const row = present.find((p) => p.table === t.table);
    if (row) {
      warnings.push({ code: "EXCLUDED_TABLE", table: t.table, detail: `intentionally excluded: ${t.reason} — current rls=${row.rls}, browser grants=[${row.browserGrants.join(",") || "none"}]. The exemption stays visible on every run.` });
    }
  }
  for (const d of defaultAcls) {
    if (manifest.browserFacingRoles.some((r) => (d.acl || "").includes(`${r}=`))) {
      warnings.push({ code: "DEFAULT_PRIVILEGE", detail: `default privileges grant to a browser-facing role (${d.role}/${d.schema}/${d.objType}): ${d.acl}. The migration revokes these; confirm afterwards that it did.` });
    }
  }

  // ── Dependencies the OTHER migrations need but do not create ─────────────
  //
  // Checked here because this is the last moment the answer is cheap. One of them (v_ledger_extref_uidx)
  // fails SILENTLY: without it the expiry migration applies fine and its replay protection simply does
  // not work. A preflight that only checked what errors loudly would pass that straight through.
  type Dep = { kind: string; name: string; table?: string; severity: string; requiredBy: string[]; reason: string };
  const deps: Dep[] = manifest.migrationDependencies ?? [];
  const depResults: { dep: Dep; present: boolean }[] = [];
  if (deps.length) {
    const roleRows = db.query(`select rolname from pg_roles`);
    const roles = new Set(roleRows.map((r) => r[0]));
    const idxRows = db.query(`select indexname, tablename from pg_indexes where schemaname = 'public'`);
    const indexes = new Set(idxRows.map((r) => r[0]));

    for (const d of deps) {
      let ispresent = false;
      if (d.kind === "role") ispresent = roles.has(d.name);
      else if (d.kind === "table") ispresent = presentNames.has(d.name);
      else if (d.kind === "index") ispresent = indexes.has(d.name);
      depResults.push({ dep: d, present: ispresent });
      if (!ispresent) {
        const entry = {
          code: `MISSING_DEPENDENCY_${d.kind.toUpperCase()}`, table: d.table ?? d.name,
          detail: `${d.kind} "${d.name}" is required by ${d.requiredBy.join(", ")} but is NOT present. ${d.reason}`,
        };
        if (d.severity === "blocker") blockers.push(entry); else warnings.push(entry);
      }
    }
  }

  // ── Structural contracts ─────────────────────────────────────────────────
  //
  // A table can be PRESENT, pass every check above, and still be the wrong table. For any table whose
  // shape is asserted somewhere but proven nowhere — referral_events is the case that prompted this — the
  // manifest carries a column contract, and any difference BLOCKS. A missing column, an extra one, a
  // different type, or a different nullability all mean the contract and the database disagree, and until
  // that is resolved nobody knows which one is wrong.
  const columnContracts = manifest.expectedColumns ?? {};
  const structural: { table: string; matched: boolean; diffs: string[] }[] = [];
  for (const [table, contract] of Object.entries(columnContracts)) {
    if (!presentNames.has(table)) {
      // Its absence is already reported by the dependency check; do not double-report it here.
      structural.push({ table, matched: false, diffs: ["table not present"] });
      continue;
    }
    const rows = db.query(`
      select column_name, data_type, is_nullable
        from information_schema.columns
       where table_schema = 'public' and table_name = '${table.replace(/'/g, "''")}'
       order by ordinal_position`);
    const actual = new Map(rows.map((r) => [r[0], { type: r[1], nullable: r[2] === "YES" }]));
    const diffs: string[] = [];
    for (const c of contract.columns) {
      const got = actual.get(c.name);
      if (!got) { diffs.push(`MISSING column "${c.name}" (expected ${c.type}${c.nullable ? "" : " NOT NULL"})`); continue; }
      if (got.type !== c.type) diffs.push(`column "${c.name}" type is ${got.type}, contract says ${c.type}`);
      if (got.nullable !== c.nullable) diffs.push(`column "${c.name}" is ${got.nullable ? "NULLABLE" : "NOT NULL"}, contract says ${c.nullable ? "NULLABLE" : "NOT NULL"}`);
      actual.delete(c.name);
    }
    for (const extra of actual.keys()) diffs.push(`EXTRA column "${extra}" the contract does not know about`);
    structural.push({ table, matched: diffs.length === 0, diffs });
    if (diffs.length > 0) {
      blockers.push({
        code: "SCHEMA_MISMATCH", table,
        detail: `the target's shape differs from the contract in sql/rls-preflight-manifest.json (${contract.source}). ${diffs.join("; ")}. Resolve which is wrong before migrating — the contract is a hypothesis, not a fact.`,
      });
    }
  }

  // A failed CREATE INDEX CONCURRENTLY leaves an INVALID index behind. Re-running the migration then hits
  // "already exists" and skips, so the index stays invalid and enforces nothing — another silent pass.
  const invalidRows = db.query(`
    select c.relname
      from pg_class c
      join pg_index i on i.indexrelid = c.oid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and i.indisvalid = false`);
  for (const r of invalidRows) {
    blockers.push({
      code: "INVALID_INDEX", table: r[0],
      detail: `index "${r[0]}" exists but is INVALID — the residue of a failed CREATE INDEX CONCURRENTLY. It enforces nothing, and a re-run will skip it because the name already exists. Drop it, then rebuild.`,
    });
  }

  const verdict = blockers.length === 0 ? "CLEAR" : "BLOCKED";

  // ── Human-readable report ────────────────────────────────────────────────
  const line = (s = "") => console.log(s);
  line();
  line("══ RLS DEPLOYMENT PREFLIGHT ═════════════════════════════════════════════");
  line(`migration        ${args.migration}`);
  line(`transactional    ${transactional ? "yes — aborts atomically, changes nothing on failure" : "NO — a failure can leave a partial state"}`);
  line(`manifest         ${args.manifest}`);
  line();
  line("── reconciliation ──");
  line(`  tables expected by the migration   ${expected.length}`);
  line(`  tables present in the target       ${present.length}`);
  line(`  ... of those, RLS already on       ${alreadyRls}`);
  line(`  ... with browser-role grants       ${withBrowserGrants.length}`);
  line(`  expected but MISSING               ${missing.length}`);
  line(`  present but UNEXPECTED             ${unexpected.length}`);
  line(`  policies found                     ${policies.length} (manifest expects ${manifest.expectedPolicyCount})`);
  line(`  acknowledged extra tables          ${manifest.acknowledgedExtraTables.length}`);
  line(`  intentionally excluded             ${manifest.intentionallyExcluded.length}`);
  line(`  created BY the migration itself    ${created.length}${created.length ? " (" + created.join(", ") + ")" : ""}`);
  line(`  migration dependencies checked     ${depResults.length}  (${depResults.filter((d) => !d.present).length} missing)`);
  line(`  structural contracts checked       ${structural.length}  (${structural.filter((x) => !x.matched).length} mismatched)`);
  line();
  if (blockers.length) {
    line("── BLOCKERS ── (the migration must NOT be run)");
    for (const b of blockers) line(`  [${b.code}] ${b.table ?? ""}\n      ${b.detail}`);
    line();
  }
  if (warnings.length) {
    line("── notes ──");
    for (const w of warnings) line(`  [${w.code}] ${w.table ?? ""}\n      ${w.detail}`);
    line();
  }
  line(`VERDICT: ${verdict}`);
  line(verdict === "CLEAR"
    ? "  Reconciled. The migration's expectations match this target."
    : `  ${blockers.length} blocker(s). Resolve every one, then re-run. Do NOT run the migration.`);
  line("═════════════════════════════════════════════════════════════════════════");

  return {
    verdict, generatedFor: args.dump ? "schema-dump" : args.docker ? "docker" : "url",
    migration: args.migration, transactional,
    counts: {
      expected: expected.length, present: present.length, rlsAlreadyOn: alreadyRls,
      withBrowserGrants: withBrowserGrants.length, missing: missing.length,
      unexpected: unexpected.length, policies: policies.length,
    },
    expected, created, present, missing, unexpected, policies, defaultAcls,
    dependencies: depResults.map((d) => ({ kind: d.dep.kind, name: d.dep.name, present: d.present })),
    structural,
    blockers, warnings,
  };
}

// ── --dump: load a SCHEMA-ONLY dump into a throwaway database ──────────────
//
// Refuses a dump carrying row data. Only schema metadata should ever leave production, and a preflight
// that quietly ingested a data dump would undermine the rule it exists to support.
function loadDumpIntoThrowaway(path: string): { container: string; database: string } | { error: string } {
  if (!existsSync(path)) return { error: `dump not found: ${path}` };
  const sql = readFileSync(path, "utf8");

  const dataMarkers: string[] = [];
  if (/^COPY\s+[^\s(]+\s*\(/im.test(sql)) dataMarkers.push("COPY ... FROM stdin");
  if (/^INSERT INTO /im.test(sql)) dataMarkers.push("INSERT INTO");
  if (dataMarkers.length) {
    return {
      error:
        `the dump at ${path} contains ROW DATA (${dataMarkers.join(", ")}). This preflight accepts ` +
        `SCHEMA-ONLY dumps. Re-export with:  pg_dump --schema-only --no-owner --no-privileges  ` +
        `(add --no-acl if your tooling needs it). Refusing to load customer data.`,
    };
  }

  try { execFileSync("docker", ["info"], { stdio: "ignore" }); }
  catch { return { error: "--dump needs Docker to stand up a throwaway database, and Docker is not available. Use --url against a staging clone instead." }; }

  const container = "vraelis-rls-preflight-dump";
  try { execFileSync("docker", ["rm", "-f", container], { stdio: "ignore" }); } catch { /* not running */ }
  execFileSync("docker", ["run", "-d", "--name", container, "-e", "POSTGRES_PASSWORD=preflight", "postgres:16-alpine"], { stdio: "ignore" });

  let up = false;
  for (let i = 0; i < 60; i += 1) {
    const r = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"], { encoding: "utf8" });
    if ((r.stdout || "").includes("accepting")) { up = true; break; }
    // Synchronous wait with no shell and no platform branch. Shelling out to sleep/timeout for this is
    // both slower and one more thing that behaves differently on Windows.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  if (!up) return { error: "the throwaway database did not become ready" };

  // Roles a Supabase dump references. Created without LOGIN so the throwaway cannot be connected to as them.
  spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-q"], {
    input: `create database target;
      do $$ begin
        if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
        if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      end $$;`,
    encoding: "utf8",
  });
  const load = spawnSync("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "target", "-q"], {
    input: sql, encoding: "utf8", maxBuffer: 1 << 28,
  });
  // A schema dump commonly emits benign noise (roles/extensions that already exist). Only a hard failure
  // to create the public schema's tables matters, and that shows up as an empty catalog later.
  if (load.status !== 0) {
    console.log(`  note: psql reported issues loading the dump (exit ${load.status}); continuing so the`);
    console.log("        reconciliation can still report what DID load. Review the counts below carefully.");
  }
  return { container, database: "target" };
}

process.exit(main());
