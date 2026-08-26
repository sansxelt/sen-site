// Phase 2 — credit hold atomicity, proven against a REAL PostgreSQL.
//
// THE RACE. lib/v-credits.ts hold() read the live balance, decided the monthly/purchased split, then
// inserted the debits — three round trips with nothing serialising them. Two concurrent launches both read
// the same balance, both decided they could afford it, and both debited. The ledger is append-only and the
// balance is a SUM, so the result is a NEGATIVE balance: credits spent that were never held.
//
// This test does not inspect SQL text. It stands up PostgreSQL, installs the real migration, and races 20
// concurrent holds against a balance that can only cover 10. It also races the SAME workload against a
// deliberately non-atomic implementation, so the test proves the race is real rather than proving nothing.
//
// Requires Docker. If Docker is unavailable the script reports the checks it could NOT run and exits 0 —
// it does not pretend a static check is equivalent.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0, skipped = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const skip = (n: string, why: string) => { console.log(`SKIP  ${n}  (${why})`); skipped++; };
const read = (p: string) => readFileSync(p, "utf8");

const NAME = "vraelis-credit-verify";
const sh = (cmd: string, args: string[]): string =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 24 });
const psql = (sql: string): string => sh("docker", ["exec", NAME, "psql", "-U", "postgres", "-d", "vc", "-At", "-c", sql]).trim();

function dockerUp(): boolean {
  try { sh("docker", ["info"]); return true; } catch { return false; }
}

// ── Static checks that hold regardless of Docker ───────────────────────────
console.log("── migration package ──");
{
  const fwd = read("sql/vraelis-credit-hold-atomic.sql");
  ok("the hold is one function, not a sequence of statements", fwd.includes("create or replace function v_hold_credits"));
  ok("concurrent holds for one user are serialised", fwd.includes("pg_advisory_xact_lock"));
  ok("the lock is transaction-scoped (released on crash)", fwd.includes("_xact_lock"));
  ok("search_path is pinned", fwd.includes("set search_path = public, pg_temp"));
  ok("browser-facing roles cannot execute it", /revoke all on function v_hold_credits[^;]*from public, anon, authenticated/.test(fwd));
  ok("service_role can execute it", /grant execute on function v_hold_credits[^;]*to service_role/.test(fwd));
  ok("legacy rows without a unit are read as 'credit'", fwd.includes("coalesce(unit, 'credit')"));
  ok("a rollback exists", read("sql/vraelis-credit-hold-atomic-rollback.sql").includes("drop function if exists v_hold_credits"));
  ok("a verification script exists", read("sql/vraelis-credit-hold-atomic-verify.sql").includes("v_hold_credits"));

  const c = read("lib/v-credits.ts");
  ok("hold() tries the atomic path first", /const atomic = await holdAtomic\([\s\S]{0,80}if \(atomic !== "unavailable"\) return atomic;/.test(c));
  ok("a missing function falls back rather than blocking launches", c.includes('return "unavailable"'));
  ok("a REAL rpc error refuses the hold instead of retrying the racy path", /A real error is NOT a fallback[\s\S]{0,240}return false;/.test(c));
}

// ── The part that needs a database ─────────────────────────────────────────
if (!dockerUp()) {
  console.log("\n── concurrency (NOT RUN) ──");
  for (const n of [
    "20 concurrent holds against a balance for 10 grant exactly 10",
    "the balance never goes negative",
    "the non-atomic shape DOES race (proves the test measures something)",
    "an insufficient balance is refused",
  ]) skip(n, "Docker is not running");
  console.log(`\n${pass}/${pass + fail} passed, ${skipped} NOT RUN (no local PostgreSQL)`);
  process.exit(fail ? 1 : 0);
}

console.log("\n── concurrency, against real PostgreSQL ──");
try { sh("docker", ["rm", "-f", NAME]); } catch { /* not running */ }
sh("docker", ["run", "-d", "--name", NAME, "-e", "POSTGRES_PASSWORD=testpw", "-e", "POSTGRES_DB=vc", "postgres:16-alpine"]);
// Synchronous sleep without shelling out: `timeout` on Windows needs a TTY and fails under a pipe.
const sleepSync = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
let ready = false;
for (let i = 0; i < 40; i++) {
  try { sh("docker", ["exec", NAME, "pg_isready", "-U", "postgres", "-d", "vc"]); ready = true; break; }
  catch { sleepSync(1000); }
}
ok("PostgreSQL is up", ready);

if (ready) {
  psql(`create extension if not exists pgcrypto;
        create role service_role nologin bypassrls; create role anon nologin; create role authenticated nologin;
        create table v_credit_ledger (
          id uuid primary key default gen_random_uuid(), user_id text not null, delta int not null,
          reason text not null, ref_type text, ref_id uuid, bucket text not null default 'purchased',
          expires_at timestamptz, created_at timestamptz not null default now(),
          ext_ref text, unit text not null default 'credit');`);
  sh("docker", ["cp", "sql/vraelis-credit-hold-atomic.sql", `${NAME}:/tmp/h.sql`]);
  sh("docker", ["exec", NAME, "psql", "-U", "postgres", "-d", "vc", "-q", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/h.sql"]);
  ok("the migration applies cleanly", true);

  // ATOMIC: 20 racers, 10 credits each, balance of 100 -> exactly 10 must win.
  psql(`insert into v_credit_ledger (user_id, delta, reason, bucket) values ('racer','100','pack','purchased');`);
  const race = `for i in $(seq 1 20); do psql -U postgres -d vc -At -c "select (v_hold_credits('racer', gen_random_uuid(), 10, 'credit')->>'ok')" & done; wait`;
  const out = sh("docker", ["exec", NAME, "sh", "-c", race]);
  const wins = (out.match(/\btrue\b/g) ?? []).length;
  const losses = (out.match(/\bfalse\b/g) ?? []).length;
  ok("exactly 10 of 20 concurrent holds succeed", wins === 10, `won=${wins} lost=${losses}`);
  ok("exactly 10 are refused", losses === 10, `lost=${losses}`);
  const bal = Number(psql(`select coalesce(sum(delta),0) from v_credit_ledger where user_id='racer';`));
  ok("the final balance is exactly zero", bal === 0, `balance=${bal}`);
  ok("the balance never went negative", bal >= 0, `balance=${bal}`);
  const holds = Number(psql(`select count(*) from v_credit_ledger where user_id='racer' and reason='hold';`));
  ok("exactly 10 hold rows were written", holds === 10, `holds=${holds}`);

  // Insufficient balance is refused outright.
  const short = psql(`select (v_hold_credits('racer', gen_random_uuid(), 5, 'credit')->>'ok');`);
  ok("a hold against a zero balance is refused", short === "false", short);

  // CONTROL: the same race against a deliberately non-atomic implementation MUST break, or this test
  // would pass even if the RPC did nothing.
  psql(`insert into v_credit_ledger (user_id, delta, reason, bucket) values ('naive','100','pack','purchased');
        create or replace function v_hold_naive(p_user text, p_amount int) returns boolean
        language plpgsql set search_path = public, pg_temp as $$
        declare v_bal int;
        begin
          select coalesce(sum(delta),0) into v_bal from v_credit_ledger where user_id=p_user
            and (expires_at is null or expires_at > now());
          perform pg_sleep(0.05);
          if v_bal < p_amount then return false; end if;
          insert into v_credit_ledger (user_id, delta, reason, bucket) values (p_user, -p_amount, 'hold', 'purchased');
          return true;
        end; $$;`);
  const raceNaive = `for i in $(seq 1 20); do psql -U postgres -d vc -At -c "select v_hold_naive('naive', 10)" & done; wait`;
  sh("docker", ["exec", NAME, "sh", "-c", raceNaive]);
  const naiveBal = Number(psql(`select coalesce(sum(delta),0) from v_credit_ledger where user_id='naive';`));
  ok("the NON-atomic shape does go negative (the race is real)", naiveBal < 0, `balance=${naiveBal}`);
  ok("the atomic path is strictly better than the shape it replaced", bal === 0 && naiveBal < 0, `atomic=${bal} naive=${naiveBal}`);

  // Rollback leaves the data alone.
  sh("docker", ["cp", "sql/vraelis-credit-hold-atomic-rollback.sql", `${NAME}:/tmp/rb.sql`]);
  sh("docker", ["exec", NAME, "psql", "-U", "postgres", "-d", "vc", "-q", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/rb.sql"]);
  const gone = psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='v_hold_credits';`);
  ok("the rollback removes the function", gone === "0");
  const afterRb = Number(psql(`select coalesce(sum(delta),0) from v_credit_ledger where user_id='racer';`));
  ok("the rollback touches no ledger data", afterRb === bal, `before=${bal} after=${afterRb}`);

  // Idempotency: re-applying the forward migration is a no-op.
  sh("docker", ["exec", NAME, "psql", "-U", "postgres", "-d", "vc", "-q", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/h.sql"]);
  sh("docker", ["exec", NAME, "psql", "-U", "postgres", "-d", "vc", "-q", "-v", "ON_ERROR_STOP=1", "-f", "/tmp/h.sql"]);
  ok("the forward migration is idempotent", true);

  try { sh("docker", ["rm", "-f", NAME]); } catch { /* best effort */ }
}

console.log(`\n${pass}/${pass + fail} passed${skipped ? `, ${skipped} NOT RUN` : ""}`);
process.exit(fail ? 1 : 0);
