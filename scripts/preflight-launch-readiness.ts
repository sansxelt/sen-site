// CAN THE BUTTON EVEN BE PRESSED? A read-only readiness check for one owner, or for every owner with a
// system.
//
// WHY THIS EXISTS. preflight-queue-watch.ts watches the queue, and an empty queue has two completely
// different causes that look identical through it: nobody has clicked Verify, or somebody clicked and the
// acceptance service refused before anything was ever enqueued. A refusal happens entirely inside the
// request — it writes no run row, so the watcher cannot see it, and the operator ends up staring at
// `queued 0` concluding "not clicked yet" when the truth is "clicked, bounced, nothing will ever appear".
// That guess costs a reviewer's evening.
//
// IT CALLS THE REAL GATES. gatePassLaunch, ownerActiveRunCount and ownerRunsToday are imported from the
// same modules the acceptance service uses, in the same order, rather than reimplemented here. A readiness
// checker with its own copy of the rules is a checker that eventually disagrees with the button and is
// worse than nothing, because it is trusted. The one thing NOT reproduced is the credit hold: taking a hold
// is a write, so PAYG affordability is reported from the balance instead and flagged as inferred.
//
// STRICTLY READ-ONLY. Every call below is a select. It claims no free pass, takes no hold, and enqueues
// nothing, so it is safe to run against production repeatedly and safe to run while a real run is in
// flight. It does NOT consume the free pass it reports on.
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { ownerActiveRunCount, ownerRunsToday } from "../lib/preflight/runs-db";
import { MAX_ACTIVE_RUNS_PER_OWNER, maxRunsPerDay } from "../lib/preflight/limits";
import { gatePassLaunch } from "../lib/preflight/entitlements-v1";
import { passPricingEnabled } from "../lib/preflight/pass-pricing";
import { centsToCredits } from "../lib/preflight/auto-recharge";

// AFTER the imports on purpose, and safe there: every module above reads process.env lazily at call time
// (lib/supabase-admin.ts documents exactly this), so nothing has captured an undefined URL by now. Omitting
// it entirely is what made the first run of this report "No database configured" against a populated
// .env.local.
loadLocalEnv();

const ARG = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const OWNER = ARG("--owner");
const FLOWS = Number(ARG("--flows") ?? "1");

type AppRow = { id: string; user_id: string; name: string; app_url: string; status: string; ownership_confirmed: boolean };

function usage(): void {
  console.log(`
  npx tsx scripts/preflight-launch-readiness.ts [--owner EMAIL] [--flows N]

    --owner EMAIL   check one owner. Omit to check every owner that has a system.
    --flows N       how many flows the launch would select (default 1). Affects the
                    pass price and the subscription-allowance gate.

  Read-only: consumes no free pass, takes no hold, queues nothing.
`);
}

async function readiness(owner: string, apps: AppRow[]): Promise<boolean> {
  const s = getSupabaseAdminClient();
  console.log(`\n─── ${owner} ───`);

  // 1. IS THERE ANYTHING TO VERIFY? A system with no connection and no contract cannot produce a run even
  //    if every money gate passes, and this is the most likely state of a freshly seeded demo account.
  let launchable = 0;   // systems that could ACTUALLY produce a run, not just ones the money gate allows
  for (const a of apps) {
    const [{ count: conns }, contractQ] = await Promise.all([
      s.from("v_app_connections" as never).select("id", { count: "exact", head: true }).eq("application_id", a.id),
      // Newest FIRST, and the whole list, because "does a system have flows" is a question about the
      // contract a launch would actually select, not about the system.
      s.from("v_production_contracts" as never)
        .select("id, version, status, approved_at, kind").eq("application_id", a.id)
        .order("version", { ascending: false }).limit(200),
    ]);
    const contracts = (contractQ.data as { id: string; version: number | null; status: string; approved_at: string | null; kind?: string }[] | null) ?? [];

    // FLOWS HANG OFF THE CONTRACT, NOT THE SYSTEM. v_test_flows has contract_id and no application_id
    // (sql/vraelis-preflight.sql:75-77), so filtering flows by application_id names a column that does not
    // exist. Postgres answers 42703 and the count comes back null, which reads as a confident "flows 0" on
    // every system on the account. Caught only because zero flows contradicts 40 completed runs; the error
    // is surfaced now rather than discarded, so the next wrong column says so instead of lying.
    //
    // Only APPROVED contracts count: flows are generated from an approved contract, and a draft's flows are
    // not what a launch selects.
    const approved = contracts.filter((c) => c.status === "approved");
    // ONE CONTRACT, THE ONE A LAUNCH WOULD USE. This counted enabled flows across EVERY approved contract,
    // which on an app with ten revisions reported 21 flows when the launch selects 3 — an inflated number on
    // the exact tool being used to decide whether a demo is ready. getApprovedContract resolves the newest
    // APPROVED PRODUCTION contract, and that is the only one whose flows can be selected.
    const launchContract = approved.find((c) => (c.kind ?? "production") === "production");
    let flows = 0;
    let flowErr: string | null = null;
    if (launchContract) {
      const { count, error } = await s.from("v_test_flows" as never)
        .select("id", { count: "exact", head: true })
        .eq("contract_id", launchContract.id)
        .eq("enabled", true);
      if (error) flowErr = error.message;
      flows = count ?? 0;
    }
    const blocking = !a.ownership_confirmed ? "  <-- ownership NOT confirmed"
      : !launchContract ? "  <-- no approved PRODUCTION contract: nothing a launch could select"
      : flows === 0 ? "  <-- no enabled flows: nothing to run" : "";
    console.log(`  system  ${a.name}  ${a.app_url}`);
    console.log(`          status ${a.status}  connections ${conns ?? 0}  contracts ${contracts.length}` +
      ` (${approved.length} approved, launch uses v${launchContract?.version ?? "-"})  enabled flows ${flowErr ? `UNKNOWN — ${flowErr}` : flows}${blocking}`);
    if (a.ownership_confirmed && flows > 0 && !flowErr) launchable++;
  }

  // 2. THE CAPS, in the order accept-run applies them. Both are counted per OWNER, never per system, so a
  //    second system does not buy a third concurrent run.
  const [active, today] = await Promise.all([ownerActiveRunCount(owner), ownerRunsToday(owner)]);
  const perDay = maxRunsPerDay();
  const capBlocked = active >= MAX_ACTIVE_RUNS_PER_OWNER;
  const dayBlocked = today >= perDay;
  console.log(`  caps    active ${active}/${MAX_ACTIVE_RUNS_PER_OWNER}${capBlocked ? "  <-- too_many_active_runs (429)" : ""}` +
    `   today ${today}/${perDay}${dayBlocked ? "  <-- daily_limit (429)" : ""}`);

  // 3. THE MONEY GATE — the real one. This is what decides free pass vs PAYG vs subscription allowance,
  //    and it is also the gate that refuses a frozen account outright.
  const gate = await gatePassLaunch(owner, FLOWS);
  const gateOk = gate.ok;
  const detail = gateOk ? "" : `  <-- ${"error" in gate ? gate.error : "refused"}`;
  console.log(`  gate    mode ${gate.mode}  ${gateOk ? "PASS" : "REFUSE"}${detail}`);
  if (!gateOk && "message" in gate) console.log(`          "${gate.message}"`);

  // 4. IF IT IS GOING TO CHARGE, CAN THEY PAY? Reported from the balance rather than by taking a hold,
  //    because a hold is a write. Marked inferred for that reason: the authoritative answer only exists at
  //    the moment the hold is attempted.
  //
  //    THE UNIT USED TO MATTER AND NO LONGER DOES. A pass-priced run escrowed in 'cent' while every purchase
  //    minted 'credit', so a topped-up account still failed with insufficient_balance — the defect this tool
  //    was written alongside. PAYG now prices in cents and escrows in credits, converting at
  //    CENTS_PER_CREDIT, so one balance funds every path and the report below reads credits.
  //
  //    The price comes off the DECISION (gate.cents), not from passPriceCents() again: only the payg branch
  //    charges at all, and re-deriving the number here is how a readiness report ends up quoting a price the
  //    button does not. `free` and `subscription` launches cost nothing and are skipped.
  if (gateOk && gate.mode === "payg") {
    const cents = gate.cents;
    if (cents > 0) {
      const { data } = await s.from("v_credit_ledger" as never)
        .select("delta, unit").eq("user_id", owner.trim().toLowerCase()).limit(5000);
      const rows = (data as { delta?: number; unit?: string }[] | null) ?? [];
      // CREDITS DECIDE THIS NOW. The hold used to be denominated in 'cent' and this reported the cent
      // balance to match it — which was correct then and is misleading now: PAYG prices in cents and
      // escrows in credits (accept-run.ts converts at CENTS_PER_CREDIT), so the credit balance is what a
      // launch actually spends. A readiness tool still reading the old denomination would report a funded
      // account as broke, or worse, the reverse.
      const creditBal = rows.filter((r) => (r.unit ?? "credit") === "credit").reduce((n, r) => n + (r.delta ?? 0), 0);
      const centBal = rows.filter((r) => r.unit === "cent").reduce((n, r) => n + (r.delta ?? 0), 0);
      const needed = centsToCredits(cents);
      const short = creditBal < needed;
      console.log(`  pay     costs $${(cents / 100).toFixed(2)} = ${needed} credits   balance ${creditBal} credits (inferred)` +
        `${short ? `  <-- insufficient_balance (402)` : "  -> affordable"}`);
      if (short) console.log(`          top up ${needed - creditBal} more credit(s) ($${((needed - creditBal) / 10).toFixed(2)}) to launch.`);
      // Stranded cent rows are legacy: minted only by the operator-gated conversion script, and now spent by
      // nothing. Surfaced so an operator does not mistake them for spendable balance.
      if (centBal > 0) console.log(`          NOTE ${centBal} legacy 'cent' unit(s) on this account are no longer spent by any hold.`);
    }
  }

  // A PASSING MONEY GATE IS NOT READINESS. The first version of this verdict required only
  // ownership_confirmed, so an owner whose only system had no approved contract and therefore no flows was
  // reported as "a launch would be ACCEPTED and queued" — permission to spend read as something to spend it
  // on. Nothing can be queued for a system with no enabled flows regardless of how the billing gate answers.
  const ready = !capBlocked && !dayBlocked && gateOk && launchable > 0;
  console.log(`  ==>     ${ready ? `a launch would be ACCEPTED and queued (${launchable} launchable system${launchable === 1 ? "" : "s"})`
    : !gateOk || capBlocked || dayBlocked ? "a launch would be REFUSED before anything is queued"
    : "the gate would pass, but NO system has enabled flows — there is nothing to launch"}`);
  return ready;
}

async function main() {
  if (process.argv.includes("--help")) { usage(); return; }
  if (!isDatabaseConfigured()) {
    console.error("No database configured. Run: vercel env pull .env.local --environment=production");
    process.exitCode = 2;
    return;
  }
  const s = getSupabaseAdminClient();
  let q = s.from("v_applications" as never)
    .select("id, user_id, name, app_url, status, ownership_confirmed")
    .order("created_at", { ascending: false });
  if (OWNER) q = q.eq("user_id", OWNER.trim().toLowerCase());
  const { data, error } = await q.limit(200);
  if (error) { console.error(`query failed: ${error.message}`); process.exitCode = 2; return; }

  const apps = (data as AppRow[] | null) ?? [];
  if (!apps.length) {
    console.log(OWNER ? `\n  ${OWNER} has NO systems. Nothing to verify, so the button cannot queue anything.`
      : "\n  No systems exist at all.");
    process.exitCode = 1;
    return;
  }

  const byOwner = new Map<string, AppRow[]>();
  for (const a of apps) {
    const list = byOwner.get(a.user_id) ?? [];
    list.push(a);
    byOwner.set(a.user_id, list);
  }
  console.log(`pass pricing ${passPricingEnabled() ? "ON" : "OFF"}   owners with a system: ${byOwner.size}   flows assumed: ${FLOWS}`);

  let anyReady = false;
  for (const [owner, list] of byOwner) {
    if (await readiness(owner, list)) anyReady = true;
  }
  // exitCode, not process.exit(): exiting here tears the process down while the Supabase socket is still
  // closing, and libuv aborts on Windows AFTER a perfectly good report.
  process.exitCode = anyReady ? 0 : 1;
}

void main();
