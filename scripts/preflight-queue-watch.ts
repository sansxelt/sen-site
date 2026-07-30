// READ-ONLY observer for the Preflight run queue. Answers, in one command, the question a green Railway
// healthcheck cannot: is the worker actually claiming and finishing runs right now?
//
// WHY THIS EXISTS. The console's launch button only INSERTs a row (app/api/preflight/apps/[id]/runs
// returns {status:"queued"} and its own header says it never executes a browser). Execution happens in a
// separate Railway service that polls the queue. So "the deploy is up" and "a verification can complete"
// are different facts, and the UI cannot tell them apart: /passes counts 'queued' as active, so a run that
// nothing will ever claim looks exactly like a run that started a second ago. Watching a pill spin is not
// evidence. heartbeat_at is.
//
// WHAT IT PROVES, in order of usefulness:
//   1. RECENT HEARTBEAT   the worker is alive AND doing work. Railway's /health only proves the HTTP
//                         server is listening; a worker with bad Supabase credentials stays green forever
//                         while draining nothing. A heartbeat seconds old cannot be faked that way.
//   2. QUEUE DEPTH + AGE  an old 'queued' row with nothing claiming it is the enqueue-only failure mode.
//   3. STRANDED RUNS      rows in 'discovering' or 'analyzing' are invisible to BOTH the claim RPC (which
//                         takes 'queued' only) and reapExpiredLeases (which takes 'running' only), so a
//                         worker killed mid-run leaves them non-terminal forever with the escrow held.
//                         They also count toward MAX_ACTIVE_RUNS_PER_OWNER (2), so two of them permanently
//                         429 every future launch for that owner. This is the one finding here that the UI
//                         gives you no way to see at all.
//
// NEVER MUTATES. Only .select(). It reads run METADATA — ids, states, timestamps, owner hashes — and never
// summary, observations, artifacts or anything a customer typed. Safe to point at production.
//
// USAGE
//   vercel env pull .env.local          # or have SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   npx tsx scripts/preflight-queue-watch.ts
//   npx tsx scripts/preflight-queue-watch.ts --watch          # poll every 5s; Ctrl+C to stop
//   npx tsx scripts/preflight-queue-watch.ts --watch --run <id>   # follow one run to a terminal state
//
// Exits 0 normally, 1 when stranded runs exist (the one condition that needs a human), 2 on bad config.
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("FAIL  Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  console.error("      Try: vercel env pull .env.local");
  process.exit(2);
}
const s = createClient(url, key, { auth: { persistSession: false } });

const WATCH = process.argv.includes("--watch");
const RUN_ID = (() => {
  const i = process.argv.indexOf("--run");
  return i >= 0 ? process.argv[i + 1] : null;
})();

/** The states the schema allows. Terminal set matches TERMINAL_RUN_STATES in lib/preflight/runs-db.ts. */
const STATES = ["draft", "queued", "discovering", "running", "analyzing", "completed", "failed", "cancelled"] as const;
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
/** Non-terminal and claimable by nobody: not 'queued' (claim RPC) and not 'running' (the reaper). */
const STRANDABLE = new Set(["discovering", "analyzing"]);

type Row = {
  id: string; state: string; decision: string | null; user_id: string;
  created_at: string; started_at: string | null; completed_at: string | null;
  heartbeat_at: string | null; lease_owner: string | null; lease_expires_at: string | null;
  attempts: number; credits_held: number;
};

const ago = (iso: string | null): string => {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "?";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
  return `${Math.round(sec / 86400)}d ago`;
};
/** Owners are hashed in output. Nothing here needs to identify a person to be useful. */
const owner = (u: string): string => `…${u.slice(-6)}`;

async function snapshot(): Promise<number> {
  // Newest 400 runs is plenty to see a queue and any stranding; ordered so "oldest queued" is exact.
  const { data, error } = await s
    .from("v_preflight_runs" as never)
    .select("id,state,decision,user_id,created_at,started_at,completed_at,heartbeat_at,lease_owner,lease_expires_at,attempts,credits_held")
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) {
    console.error(`FAIL  Could not read v_preflight_runs: ${error.message}`);
    return 2;
  }
  const rows = (data as Row[] | null) ?? [];

  const counts: Record<string, number> = {};
  for (const st of STATES) counts[st] = 0;
  for (const r of rows) counts[r.state] = (counts[r.state] ?? 0) + 1;

  const active = rows.filter((r) => !TERMINAL.has(r.state));
  const queued = rows.filter((r) => r.state === "queued");
  const stranded = rows.filter((r) => STRANDABLE.has(r.state));
  // The single most informative number: has ANY run been touched by a worker recently?
  const beats = rows.map((r) => r.heartbeat_at).filter((h): h is string => Boolean(h)).sort().reverse();
  const lastBeat = beats[0] ?? null;
  const beatAgeSec = lastBeat ? Math.round((Date.now() - Date.parse(lastBeat)) / 1000) : null;

  console.log(`\n─── preflight queue @ ${new Date().toISOString()} ───`);
  console.log(`  states   ${STATES.filter((st) => counts[st] > 0).map((st) => `${st}=${counts[st]}`).join("  ") || "(no runs at all)"}`);
  console.log(`  active   ${active.length}   queued ${queued.length}   stranded ${stranded.length}`);

  // WORKER LIVENESS. Heartbeat interval defaults to 20s (worker/preflight/config.ts), so anything under a
  // minute means a worker is currently holding a run. "No heartbeat" is only damning while work is waiting:
  // an idle worker with an empty queue writes nothing, which is correct and looks identical to a dead one.
  if (beatAgeSec === null) {
    console.log(`  worker   no heartbeat on any of the last ${rows.length} runs` +
      (queued.length ? "  <-- work is QUEUED and nothing is touching it" : "  (queue is empty, so this is expected)"));
  } else {
    const verdict = beatAgeSec < 60 ? "WORKING" : beatAgeSec < 600 ? "idle-ish" : "stale";
    console.log(`  worker   last heartbeat ${ago(lastBeat)} (${beatAgeSec}s)  ->  ${verdict}`);
  }

  if (queued.length) {
    const oldest = queued[queued.length - 1];
    console.log(`  oldest queued  ${oldest.id}  created ${ago(oldest.created_at)}  owner ${owner(oldest.user_id)}` +
      (Date.now() - Date.parse(oldest.created_at) > 120_000 ? "   <-- older than 2min: nothing is draining" : ""));
  }

  if (stranded.length) {
    console.log(`\n  !! ${stranded.length} STRANDED run(s) — non-terminal, unclaimable, escrow still held.`);
    console.log(`     The claim RPC only takes 'queued' and the reaper only takes 'running', so these are`);
    console.log(`     invisible to both. Each counts toward MAX_ACTIVE_RUNS_PER_OWNER=2 forever.`);
    for (const r of stranded.slice(0, 10)) {
      console.log(`     ${r.id}  ${r.state.padEnd(11)} started ${ago(r.started_at)}  beat ${ago(r.heartbeat_at)}` +
        `  lease ${r.lease_owner ? owner(r.lease_owner) : "none"}  held ${r.credits_held}`);
    }
  }

  if (RUN_ID) {
    const r = rows.find((x) => x.id === RUN_ID);
    if (!r) console.log(`\n  run ${RUN_ID}: not in the newest ${rows.length} runs`);
    else {
      console.log(`\n  run ${r.id}`);
      console.log(`     state ${r.state}${r.decision ? `  decision ${r.decision}` : ""}  attempts ${r.attempts}  held ${r.credits_held}`);
      console.log(`     created ${ago(r.created_at)}  started ${ago(r.started_at)}  beat ${ago(r.heartbeat_at)}  done ${ago(r.completed_at)}`);
      if (TERMINAL.has(r.state)) console.log(`     TERMINAL — this is the queued -> ${r.state} proof.`);
    }
  }

  return stranded.length ? 1 : 0;
}

async function main() {
  // process.exitCode, NOT process.exit(). Exiting immediately after the last query tears the process down
  // while the Supabase client's socket is still closing, and libuv aborts with
  // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" on Windows — which prints after a perfectly
  // good report and reads like the script failed. Setting the code lets Node drain its handles and exit on
  // its own.
  if (!WATCH) { process.exitCode = await snapshot(); return; }
  console.log("watching every 5s — Ctrl+C to stop");
  for (;;) {
    const code = await snapshot();
    if (RUN_ID && code !== 2) {
      // Stop on our own accord once the followed run is terminal: the whole point was to see it land.
      const { data } = await s.from("v_preflight_runs" as never).select("state").eq("id", RUN_ID).maybeSingle();
      const st = (data as { state?: string } | null)?.state;
      if (st && TERMINAL.has(st)) { console.log(`\nrun reached ${st}. done.`); process.exit(0); }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

void main();
