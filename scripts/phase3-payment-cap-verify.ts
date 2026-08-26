// Phase 3 — rolling payment caps, proven against a REAL PostgreSQL and a REAL PostgREST.
//
// WHAT WAS BROKEN. lib/vraelis-payment-authz.ts decided the day and billing-cycle caps from
// sumRecentPaymentCents, which read `.limit(5000)` with no ORDER BY, summed every status including
// 'pending', mixed currencies, and returned before the write it was guarding. Four defects:
//
//   1. TRUNCATION. Past 5,000 rows the total silently under-reported, so the cap stopped binding on
//      exactly the busy accounts it exists for — and it could not tell the caller it had truncated.
//   2. ARBITRARY. With no ORDER BY, WHICH 5,000 rows were summed was up to the planner. The same query on
//      the same data can return wildly different totals.
//   3. DENIAL OF SERVICE. Pending rows are creatable through /api/vraelis/book by anyone holding the
//      shared intake key, so an outsider could exhaust the owner's cap and mute their agent.
//   4. RACE. The read and the decision were separate round trips, so N concurrent authorizations all saw
//      the same pre-spend total and all passed one cap.
//
// This script does not take the fix on trust. It stands up PostgreSQL, installs the real migration, and
// races 20 concurrent authorizations against a cap that fits 10 — then races the SAME workload against a
// deliberately non-atomic control, so the test proves the race is real rather than proving nothing. It
// then stands up PostgREST and drives the REAL sumRecentPaymentCents over the real Supabase client, and
// runs the OLD query verbatim beside it on identical data.
//
// Requires Docker. Without it the script reports the checks it could NOT run and exits 0 — it does not
// pretend a static check is equivalent to a behavioural one.
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";

let pass = 0, fail = 0, skipped = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const skip = (n: string, why: string) => { console.log(`SKIP  ${n}  (${why})`); skipped++; };
const read = (p: string) => readFileSync(p, "utf8");

const PG = "vraelis-paycap-verify";
const REST = "vraelis-paycap-rest";
const NET = "vraelis-paycap-net";
const REST_PORT = 31711;   // PostgREST, published on the host
const PROXY_PORT = 31712;  // strips the /rest/v1 prefix supabase-js adds
const JWT_SECRET = "paycap-verify-secret-not-a-real-credential-0123456789";

const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 });
const shq = (cmd: string, args: string[]): string => { try { return sh(cmd, args); } catch { return ""; } };
const psql = (sql: string, db = "paycap"): string =>
  sh("docker", ["exec", PG, "psql", "-U", "postgres", "-d", db, "-At", "-c", sql]).trim();

// ASYNC psql. The concurrency test needs real overlap: execFileSync would run the 20 "concurrent"
// authorizations strictly one after another, and a sequential race passes trivially while proving nothing.
const psqlAsync = (sql: string, db = "paycap"): Promise<string> =>
  new Promise((resolve) => {
    execFile("docker", ["exec", PG, "psql", "-U", "postgres", "-d", db, "-At", "-c", sql],
      { encoding: "utf8", maxBuffer: 1 << 26 }, (_e, stdout) => resolve((stdout ?? "").trim()));
  });

// Comments describe the defect being fixed and naturally quote it, so a check that scans raw file text
// finds the very string it is asserting is absent. Strip comments before asserting on CODE.
const sqlCode = (s: string) => s.replace(/\r/g, "").split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const tsBody = (s: string, decl: string): string => {
  const src = s.replace(/\r/g, "");
  const start = src.indexOf(decl);
  if (start < 0) return "";
  const next = src.indexOf("\nexport ", start + decl.length);
  return src.slice(start, next < 0 ? undefined : next);
};

// psql reading from stdin, so the repo's own .sql files are what gets executed.
//
// BOTH streams are captured. psql writes RAISE NOTICE — which is how the behavioural suite reports every
// assertion — to STDERR, so reading stdout alone sees an empty result and silently counts zero assertions
// while reporting success. Caught by the assertion-count check below.
function psqlStdin(sqlText: string, db = "paycap", stopOnError = true): { out: string; code: number } {
  const args = ["exec", "-i", PG, "psql", "-U", "postgres", "-d", db, "-q"];
  if (stopOnError) args.push("-v", "ON_ERROR_STOP=1");
  const r = spawnSync("docker", args, { input: sqlText, encoding: "utf8", maxBuffer: 1 << 26 });
  return { out: `${r.stdout ?? ""}${r.stderr ?? ""}`, code: r.status ?? 1 };
}

function dockerUp(): boolean { try { sh("docker", ["info"]); return true; } catch { return false; } }
function teardown(): void {
  shq("docker", ["rm", "-f", REST]);
  shq("docker", ["rm", "-f", PG]);
  shq("docker", ["network", "rm", NET]);
}

// ── 1. The migration package, statically ───────────────────────────────────
// These are STRUCTURAL checks on the migration package's shape. The behavioural proof is section 3.
console.log("── migration package ──");
const FWD = read("sql/vraelis-agent-payment-cap.sql");
const FWD_CODE = sqlCode(FWD);
{
  ok("the decision and the write are one function", /create or replace function v_reserve_agent_payment/.test(FWD));
  ok("concurrent authorizations for one owner are serialised", FWD.includes("pg_advisory_xact_lock"));
  ok("the lock is transaction-scoped (released on crash)", FWD.includes("_xact_lock"));
  ok("the lock namespace is its own, not the credit balance's",
    FWD.includes("'v_agent_payment:'") && !FWD.includes("'v_hold_credits:'"));
  ok("search_path is pinned on both functions",
    (FWD.match(/set search_path = public, pg_temp/g) ?? []).length >= 2);
  ok("the aggregation carries no row limit", !/limit\s+5000/i.test(FWD_CODE) && FWD_CODE.includes("sum(amount_cents)"));
  ok("attacker-writable payment rows are not read at all", !FWD_CODE.includes("vraelis_payments"));
  ok("browser-facing roles cannot execute the reserve function",
    /revoke all on function v_reserve_agent_payment[^;]*from anon, authenticated/.test(FWD));
  ok("browser-facing roles cannot execute the settle function",
    /revoke all on function v_settle_agent_payment[^;]*from anon, authenticated/.test(FWD));
  ok("service_role can execute both",
    /grant execute on function v_reserve_agent_payment[^;]*to service_role/.test(FWD) &&
    /grant execute on function v_settle_agent_payment[^;]*to service_role/.test(FWD));
  ok("the reservations table has RLS enabled", /alter table v_agent_payment_reservations enable row level security/.test(FWD));
  ok("a rollback exists and drops all three objects", (() => {
    const r = read("sql/vraelis-agent-payment-cap-rollback.sql");
    return r.includes("drop function if exists v_reserve_agent_payment")
        && r.includes("drop function if exists v_settle_agent_payment")
        && r.includes("drop table if exists v_agent_payment_reservations");
  })());
  ok("a static verification script exists", read("sql/vraelis-agent-payment-cap-verify.sql").includes("v_reserve_agent_payment"));
  ok("a behavioural test script exists", read("sql/vraelis-agent-payment-cap-tests.sql").includes("v_reserve_agent_payment"));

  // Idempotency must be decided BEFORE the cap, or a retry is refused by its own earlier success.
  const idemAt = FWD.indexOf("where owner_email = v_owner and ext_ref = p_ext_ref");
  const capAt = FWD.indexOf("if v_day + p_amount > p_day_cap");
  ok("replay is resolved before the cap is applied", idemAt > 0 && capAt > 0 && idemAt < capAt,
    `idempotency@${idemAt} cap@${capAt}`);
}

// ── 2. The application wiring ──────────────────────────────────────────────
console.log("── application wiring ──");
{
  const authz = read("lib/vraelis-payment-authz.ts");
  const db = read("lib/vraelis-db.ts");

  // [^}] already spans newlines, so no dotAll flag is needed for a multi-line import list.
  ok("authz imports the atomic reservation, not just the sum", /import \{[^}]*reserveAgentPayment[^}]*\} from "\.\/vraelis-db"/.test(authz));
  ok("authz uses ONE shared bounded env parser", authz.includes('from "./env-num"') && !/const num = \(name: string/.test(authz));
  ok("every cap override is bounded", (() => {
    const calls = authz.match(/envInt\("VRAELIS_AUTO_PAY_[A-Z_]+",\s*\{[^}]*\}/g) ?? [];
    return calls.length >= 7 && calls.every((c) => c.includes("min:") && c.includes("max:") && c.includes("fallback:"));
  })());

  // A real RPC failure must refuse, NOT silently retry the weaker path.
  const nullAt = authz.indexOf("if (reserved === null)");
  const bridgeAt = authz.indexOf("Bridge: the RPC is not deployed yet");
  ok("a real RPC failure refuses instead of falling back", nullAt > 0 && bridgeAt > 0 && nullAt < bridgeAt);
  ok("only an ABSENT function reaches the bridge", authz.includes('reserved !== "unavailable"'));

  // Assert on the FUNCTION BODY, not the file: the doc comment above it quotes ".limit(5000)" while
  // explaining the defect, and a whole-file scan would find that quotation and report a false failure.
  const bridge = tsBody(db, "export async function sumRecentPaymentCents(");
  ok("the bridge function body was located", bridge.length > 200, `${bridge.length} chars`);
  ok("the bridge no longer reads a capped 5000 rows", !/\.limit\(5000\)/.test(bridge));
  ok("the bridge counts only settled payments", /\.eq\("status", "paid"\)/.test(bridge));
  ok("the bridge scopes to one currency", /\.eq\("currency", currency\)/.test(bridge));
  ok("the bridge pages with a total order", /\.order\("created_at"[^)]*\)\s*\n?\s*\.order\("id"/.test(bridge));
  ok("the bridge fails closed at its page bound rather than under-reporting",
    /exceeded page bound; refusing to under-report[\s\S]{0,80}return null/.test(bridge));
  ok("the RPC-absent code path is detected by code, not by message alone",
    db.includes('code === "42883"') && db.includes('code === "PGRST202"'));

  // Every agent payment route must close out its reservation, AFTER the charge attempt.
  for (const f of [
    "app/api/vraelis/sms/inbound/route.ts",
    "app/api/vraelis/inbound/email/route.ts",
    "app/api/vraelis/intake/continue/route.ts",
  ]) {
    const label = f.split("/").slice(-3, -1).join("/");
    const s = read(f);
    ok(`${label} imports finishAgentPayment from the authz module`,
      /import \{[^}]*\bfinishAgentPayment\b[^}]*\} from "@\/lib\/vraelis-payment-authz"/.test(s));
    ok(`${label} settles with the real outcome, not a constant`, s.includes("finishAgentPayment(authz, pay.ok)"));
    const startAt = s.indexOf("startWorkspacePayment(");
    const finishAt = s.indexOf("finishAgentPayment(authz, pay.ok)");
    const branchAt = s.indexOf("if (pay.ok && pay.url)");
    // Ordering is the whole point: settling before the charge would settle a payment that never happened,
    // and settling after the branch would skip the release on the failure path.
    ok(`${label} settles AFTER the charge attempt and BEFORE the success branch`,
      startAt > 0 && finishAt > startAt && branchAt > finishAt, `start@${startAt} finish@${finishAt} branch@${branchAt}`);
  }
}

// ── 3. Behaviour, against a real database ──────────────────────────────────
async function behavioural(): Promise<void> {
  console.log("── behaviour against a real PostgreSQL ──");
  if (!dockerUp()) {
    skip("the whole behavioural suite", "Docker is not available on this machine");
    return;
  }
  teardown();
  sh("docker", ["network", "create", NET]);
  sh("docker", ["run", "-d", "--name", PG, "--network", NET, "-e", "POSTGRES_PASSWORD=pgpw", "postgres:16-alpine"]);

  // Wait for readiness rather than sleeping a guessed interval.
  let up = false;
  for (let i = 0; i < 60; i += 1) {
    if (shq("docker", ["exec", PG, "pg_isready", "-U", "postgres"]).includes("accepting connections")) { up = true; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) { skip("the whole behavioural suite", "PostgreSQL did not become ready"); return; }

  psqlStdin("create database paycap;", "postgres");
  psqlStdin(`
    create table vraelis_workspaces (owner_email text primary key);
    create table vraelis_payments (
      id uuid primary key default gen_random_uuid(), owner_email text not null,
      kind text not null default 'full', currency text not null default 'usd',
      amount_cents integer not null, status text not null default 'pending',
      created_at timestamptz not null default now(), paid_at timestamptz);
    do $x$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      -- LOGIN, not "nologin ... login": specifying both is a conflicting-options error, and with
      -- ON_ERROR_STOP that aborted the whole setup, leaving the migration to fail on a missing role.
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role login bypassrls password 'srpw'; end if;
    end $x$;
    grant usage on schema public to anon, service_role;
    grant select on vraelis_payments to service_role;
  `);

  const mig = psqlStdin(FWD);
  ok("the migration applies to a clean database", mig.code === 0, mig.out.slice(0, 200));

  const ver = psqlStdin(read("sql/vraelis-agent-payment-cap-verify.sql"));
  const okCount = (ver.out.match(/\bOK\b/g) ?? []).length;
  ok("all 10 static verification checks pass on the live schema", okCount === 10, `${okCount}/10`);
  ok("no verification check reports FAIL", !ver.out.includes("FAIL"));

  const tests = psqlStdin(read("sql/vraelis-agent-payment-cap-tests.sql"));
  const passes = (tests.out.match(/PASS/g) ?? []).length;
  ok("the behavioural suite runs to completion", tests.code === 0, tests.out.split("\n").filter((l) => /FAIL|ERROR/.test(l))[0] ?? "");
  ok("every behavioural assertion passes", passes >= 46 && !/FAIL|ERROR/.test(tests.out), `${passes} assertions`);

  // Re-applying must not disturb data already reserved.
  const before = psql("select count(*) from v_agent_payment_reservations;");
  const again = psqlStdin(FWD);
  const after = psql("select count(*) from v_agent_payment_reservations;");
  ok("the migration is idempotent", again.code === 0 && before === after, `${before} -> ${after}`);

  // Rollback must actually remove it, and re-application must restore it.
  const rb = psqlStdin(read("sql/vraelis-agent-payment-cap-rollback.sql"));
  ok("the rollback runs clean", rb.code === 0, rb.out.slice(0, 200));
  ok("the rollback removes the table", psql("select to_regclass('public.v_agent_payment_reservations') is null;") === "t");
  ok("the rollback removes both functions",
    psql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('v_reserve_agent_payment','v_settle_agent_payment');") === "0");
  ok("re-applying after rollback restores it", psqlStdin(FWD).code === 0);

  // ── The race, and a control that proves the race is real ────────────────
  console.log("── 20 concurrent authorizations of 100c against a 1000c daily cap ──");
  psqlStdin(`
    -- A DETERMINISTIC barrier, not a sleep. Each connection is a separate 'docker exec', and those start
    -- several hundred milliseconds apart, so a fixed pg_sleep does not reliably make the reads overlap:
    -- the first run of this test reported the non-atomic control landing exactly ON the cap, i.e. it
    -- reported the race as ABSENT. A concurrency test that intermittently proves nothing is worse than no
    -- test, because it reads as evidence.
    --
    -- Sequences are non-transactional, so last_value is visible across sessions immediately. Every party
    -- announces itself and then waits for the rest before doing anything. All 20 are therefore inside the
    -- critical section together, whatever the process-start jitter was.
    create sequence if not exists race_counter;
    create or replace function v_race_barrier(p_parties int) returns void
    language plpgsql as $b$
    declare i int := 0;
    begin
      perform nextval('race_counter');
      while i < 2000 loop
        exit when (select last_value from race_counter) >= p_parties;
        perform pg_sleep(0.01);
        i := i + 1;
      end loop;
    end $b$;

    create or replace function v_reserve_agent_payment_naive(p_owner text, p_amount int, p_day_cap int)
    returns jsonb language plpgsql set search_path = public, pg_temp as $n$
    declare v_owner text := lower(trim(p_owner)); v_day bigint; v_id uuid;
    begin
      -- Read, decide, write, with nothing serialising the three: the exact shape the application had.
      select coalesce(sum(amount_cents),0) into v_day from v_agent_payment_reservations
       where owner_email=v_owner and released_at is null
         and (settled_at is not null or expires_at > now()) and created_at > now() - interval '1 day';
      if v_day + p_amount > p_day_cap then return jsonb_build_object('ok', false); end if;
      insert into v_agent_payment_reservations (owner_email, amount_cents, expires_at, settled_at)
      values (v_owner, p_amount, now() + interval '1 hour', now()) returning id into v_id;
      return jsonb_build_object('ok', true);
    end $n$;
  `);

  const PARTIES = 20;
  const race = async (call: string, owner: string): Promise<{ authorized: number; total: number }> => {
    psql(`delete from v_agent_payment_reservations where owner_email='${owner}';`);
    psql("alter sequence race_counter restart with 1;");
    // psqlAsync, not psql: 20 genuinely overlapping connections. Wrapping a SYNCHRONOUS call in a promise
    // runs them one at a time, and a sequential race cannot fail — it would report a green result for the
    // very defect it exists to detect.
    //
    // Both arms take the same barrier, so this is a fair comparison: identical overlap, and the only
    // difference is whether the function serialises what happens after it.
    const results = await Promise.all(Array.from({ length: PARTIES }, () =>
      psqlAsync(`select v_race_barrier(${PARTIES}); select ${call}`)));
    return {
      authorized: results.filter((r) => r.includes('"ok": true')).length,
      total: Number(psql(`select coalesce(sum(amount_cents),0) from v_agent_payment_reservations where owner_email='${owner}' and released_at is null;`)),
    };
  };

  const naive = await race("v_reserve_agent_payment_naive('race@t.co', 100, 1000);", "race@t.co");
  const atomic = await race("v_reserve_agent_payment('atomic@t.co', 100, 1000, 999999);", "atomic@t.co");
  console.log(`      non-atomic control: ${naive.authorized}/20 authorized, ${naive.total}c reserved`);
  console.log(`      atomic  reserve   : ${atomic.authorized}/20 authorized, ${atomic.total}c reserved`);
  ok("the non-atomic control DOES overshoot the cap (so the race is real)", naive.total > 1000,
    `${naive.total}c against a 1000c cap`);
  ok("the atomic reservation authorizes exactly 10 of 20", atomic.authorized === 10, `${atomic.authorized}`);
  ok("the atomic reservation lands exactly ON the cap, never past it", atomic.total === 1000, `${atomic.total}c`);
}

// ── 4. The bridge, driven through a real Supabase client ───────────────────
async function bridge(): Promise<void> {
  console.log("── the bridge path, over a real PostgREST ──");
  if (!dockerUp()) { skip("bridge behaviour", "Docker is not available"); return; }

  sh("docker", ["run", "-d", "--name", REST, "--network", NET, "-p", `${REST_PORT}:3000`,
    "-e", `PGRST_DB_URI=postgres://postgres:pgpw@${PG}:5432/paycap`,
    "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", `PGRST_JWT_SECRET=${JWT_SECRET}`, "postgrest/postgrest:v12.2.3"]);

  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${REST_PORT}/`);
      if (r.status === 200) { ready = true; break; }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) { skip("bridge behaviour", "PostgREST did not become ready"); return; }

  // A dataset the OLD read could not measure: 11,500 qualifying rows in the window.
  psqlStdin(`
    delete from vraelis_payments where owner_email='probe@t.co';
    insert into vraelis_payments (owner_email, amount_cents, status, currency)
      select 'probe@t.co', 3, 'paid', 'usd' from generate_series(1,7000);
    insert into vraelis_payments (owner_email, amount_cents, status, currency)
      select 'probe@t.co', 1000, 'pending', 'usd' from generate_series(1,4000);
    insert into vraelis_payments (owner_email, amount_cents, status, currency)
      select 'probe@t.co', 900, 'paid', 'eur' from generate_series(1,500);
    insert into vraelis_payments (owner_email, amount_cents, status, currency, created_at)
      select 'probe@t.co', 7777, 'paid', 'usd', now() - interval '3 days' from generate_series(1,10);
  `);

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ role: "service_role" })}`;
  const jwt = `${unsigned}.${createHmac("sha256", JWT_SECRET).update(unsigned).digest("base64url")}`;

  // supabase-js talks to `${url}/rest/v1`; PostgREST serves at `/`. Strip the prefix in between so the
  // REAL client and the REAL query run, rather than a reimplementation of them.
  const proxy = http.createServer((req, res) => {
    const path = (req.url ?? "/").replace(/^\/rest\/v1/, "") || "/";
    const up = http.request(
      { host: "127.0.0.1", port: REST_PORT, method: req.method, path, headers: { ...req.headers, host: `127.0.0.1:${REST_PORT}` } },
      (r) => { res.writeHead(r.statusCode ?? 500, r.headers); r.pipe(res); },
    );
    up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    req.pipe(up);
  });
  await new Promise<void>((r) => proxy.listen(PROXY_PORT, "127.0.0.1", () => r()));

  try {
    process.env.SUPABASE_URL = `http://127.0.0.1:${PROXY_PORT}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = jwt;
    const { sumRecentPaymentCents } = await import("../lib/vraelis-db");
    const { getSupabaseAdminClient } = await import("../lib/supabase-admin");

    const day = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const month = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    ok("7,000 paid rows are summed exactly, past the old 5,000-row ceiling",
      (await sumRecentPaymentCents("probe@t.co", day, "usd")) === 21_000);
    ok("4,000 attacker-creatable pending rows contribute nothing",
      (await sumRecentPaymentCents("probe@t.co", day, "usd")) === 21_000);
    ok("a second currency keeps its own total", (await sumRecentPaymentCents("probe@t.co", day, "eur")) === 450_000);
    ok("the 30-day window includes older paid rows the 24h window excludes",
      (await sumRecentPaymentCents("probe@t.co", month, "usd")) === 98_770);
    ok("an owner with no payments sums to zero, not null", (await sumRecentPaymentCents("nobody@t.co", day, "usd")) === 0);

    // The OLD query, verbatim, on the SAME data — the defect demonstrated rather than asserted.
    const sb = getSupabaseAdminClient();
    const oldQuery = (order?: string) => {
      let q = sb.from("vraelis_payments" as never).select("amount_cents, status")
        .eq("owner_email", "probe@t.co").gte("created_at", day);
      if (order) q = q.order(order, { ascending: false });
      return q.limit(5000);
    };
    const { data: dA } = await oldQuery();
    const rowsA = (dA as unknown as { amount_cents: number; status: string }[]) ?? [];
    const totA = rowsA.reduce((a, r) => a + (Number(r.amount_cents) || 0), 0);
    const { data: dB } = await oldQuery("amount_cents");
    const rowsB = (dB as unknown as { amount_cents: number; status: string }[]) ?? [];
    const totB = rowsB.reduce((a, r) => a + (Number(r.amount_cents) || 0), 0);

    console.log(`      old query, planner order : ${rowsA.length} rows, ${totA}c`);
    console.log(`      old query, another order : ${rowsB.length} rows, ${totB}c, ${rowsB.filter((r) => r.status === "pending").length} of them 'pending'`);
    ok("the old query WAS truncated by its row limit", rowsA.length === 5000);
    ok("the old query's answer depended on arbitrary row order", totA !== totB, `${totA}c vs ${totB}c on identical data`);
    ok("one of those orders summed attacker-creatable pending rows", rowsB.some((r) => r.status === "pending"));
  } finally {
    proxy.close();
  }
}

async function main(): Promise<void> {
  try {
    await behavioural();
    await bridge();
  } finally {
    teardown();
  }
  console.log(`\n${pass} passed, ${fail} failed${skipped ? `, ${skipped} skipped` : ""}`);
  process.exit(fail === 0 ? 0 : 1);
}
void main();
