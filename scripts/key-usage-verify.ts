// WHAT A CUSTOMER READS ABOUT THEIR KEY MUST BE WHAT THEY WERE CHARGED.
//
// The console showed a per-key REQUEST COUNT and no money at all. A request count is not a bill: a key can
// make a thousand cheap reads or four verifications, and only one of those appears on a card.
//
// The deeper problem was the source. The daily ceiling reads v_preflight_runs, because a run row is written
// in the same operation as the run. The request count came from the events log, which is best-effort by
// design (logEvent swallows its own failures so analytics can never break a product flow). A customer
// reading one number and being refused by another is the same defect as a verdict that disagrees with
// itself, which is the thing this company exists to stop.
//
// These are behavioural. The arithmetic is a pure function precisely so that every figure about money can
// be tested without a database, because a number about money that only production can check is a number
// nobody checks.
import { summarizeKeyRuns, windowOf, chargedCentsOf, type RunRow } from "../lib/preflight/key-usage";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const NOW = Date.parse("2026-07-27T14:00:00.000Z");
const HOUR = 3600_000, DAY = 24 * HOUR;
const run = (o: Partial<RunRow> & { created_at: string }): RunRow => ({
  id: "r", state: "completed", decision: "ready",
  held_cents: null, credits_held: null, flow_units: null, deployment_url: null, ...o,
});

// ── A PAY-AS-YOU-GO RUN IS MONEY. A SUBSCRIPTION RUN IS NOT. ──────────────────────────────────────────
// Production carries both shapes on the same key: held_cents 1500 / credits_held 1500 for PAYG, and
// held_cents null / credits_held 0 / flow_units 3 for a run drawn from a plan allowance.
console.log("── a charge is money taken, not allowance consumed ──");
ok("a PAYG run reports the cents that were taken", chargedCentsOf({ held_cents: 1500 }) === 1500);
ok("a subscription run reports no money", chargedCentsOf({ held_cents: null }) === 0);
ok("and a zero charge is zero, not null", chargedCentsOf({ held_cents: 0 }) === 0);
{
  // credits_held is 1500 here too, and must NOT be double counted or preferred.
  const w = windowOf([run({ created_at: "2026-07-27T10:00:00Z", held_cents: 1500, credits_held: 1500, flow_units: 1 })]);
  ok("a PAYG run counts its money once", w.chargedCents === 1500, `got ${w.chargedCents}`);
  ok("and its journey", w.flowUnits === 1);
}
{
  const w = windowOf([run({ created_at: "2026-07-27T10:00:00Z", held_cents: null, credits_held: 0, flow_units: 3 })]);
  ok("a subscription run is charged nothing", w.chargedCents === 0);
  ok("but its allowance is still counted, so the key does not look free", w.flowUnits === 3);
  ok("and it is still a run", w.runs === 1);
}

// ── THE WINDOWS ──────────────────────────────────────────────────────────────────────────────────────
console.log("\n── today, 30 days, all time ──");
{
  const rows = [
    run({ created_at: new Date(NOW - 2 * HOUR).toISOString(), held_cents: 1500, flow_units: 1 }),   // today
    run({ created_at: new Date(NOW - 20 * HOUR).toISOString(), held_cents: 1500, flow_units: 1 }),  // yesterday UTC
    run({ created_at: new Date(NOW - 10 * DAY).toISOString(), held_cents: 1500, flow_units: 2 }),   // in 30d
    run({ created_at: new Date(NOW - 200 * DAY).toISOString(), held_cents: 1500, flow_units: 5 }),  // older
  ];
  const s = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: null, spentTodayCents: null });
  ok("today counts only runs since UTC midnight", s.today.runs === 1, `got ${s.today.runs}`);
  ok("30 days excludes the 200-day-old run", s.last30d.runs === 3, `got ${s.last30d.runs}`);
  ok("all time counts everything", s.allTime.runs === 4);
  ok("the windows nest: today <= 30d <= all", s.today.chargedCents <= s.last30d.chargedCents && s.last30d.chargedCents <= s.allTime.chargedCents);
  ok("all-time money is the sum of the rows", s.allTime.chargedCents === 6000, `got ${s.allTime.chargedCents}`);
  ok("all-time journeys are the sum of the rows", s.allTime.flowUnits === 9, `got ${s.allTime.flowUnits}`);
}

// ── THE FIGURE AGAINST THE LIMIT IS THE ONE THE LIMIT ENFORCES ───────────────────────────────────────
// spentTodayCents is passed in from keySpentTodayCents rather than recomputed. Recomputing it here would
// be a second implementation, and a second implementation is how the number a customer reads starts
// disagreeing with the number that refuses them.
console.log("\n── remaining, against the ceiling ──");
{
  const rows = [run({ created_at: new Date(NOW - HOUR).toISOString(), held_cents: 1500, flow_units: 1 })];
  const s = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: 4500, spentTodayCents: 1500 });
  ok("remaining is the ceiling minus what the ceiling counted", s.remainingTodayCents === 3000, `got ${s.remainingTodayCents}`);

  const over = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: 1000, spentTodayCents: 1500 });
  ok("an overspent key has nothing left, not a negative balance", over.remainingTodayCents === 0, `got ${over.remainingTodayCents}`);

  const noCeiling = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: null, spentTodayCents: 1500 });
  ok("a key with no limit has no remaining figure to show", noCeiling.remainingTodayCents === null);

  const unreadable = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: 4500, spentTodayCents: null });
  ok("an unreadable ledger shows nothing rather than a made-up number", unreadable.remainingTodayCents === null);

  // The one that matters: remaining must follow the ENFORCED figure, not the rows on screen. If a run was
  // committed that these rows do not include, the customer must still see it consumed.
  const enforcedHigher = summarizeKeyRuns(rows, { nowMs: NOW, dailyCeilingCents: 4500, spentTodayCents: 3000 });
  ok("remaining follows what the ceiling counted, even when it exceeds the visible rows",
    enforcedHigher.remainingTodayCents === 1500, `got ${enforcedHigher.remainingTodayCents}`);
}

// ── DEGRADING ────────────────────────────────────────────────────────────────────────────────────────
console.log("\n── nothing invents a number ──");
{
  const s = summarizeKeyRuns([], { nowMs: NOW, dailyCeilingCents: 4500, spentTodayCents: 0 });
  ok("an unused key is all zeroes", s.allTime.runs === 0 && s.allTime.chargedCents === 0 && s.allTime.flowUnits === 0);
  ok("and its whole limit is still available", s.remainingTodayCents === 4500);

  const bad = summarizeKeyRuns([run({ created_at: "not-a-date", held_cents: 1500 })], { nowMs: NOW, dailyCeilingCents: null, spentTodayCents: null });
  ok("a row with an unparseable date is excluded from the windows rather than counted as today",
    bad.today.runs === 0 && bad.last30d.runs === 0, `today=${bad.today.runs} 30d=${bad.last30d.runs}`);
  ok("but it is still visible in all time, so money never disappears", bad.allTime.chargedCents === 1500);

  const junk = windowOf([run({ created_at: new Date(NOW).toISOString(), held_cents: Number.NaN as unknown as number, flow_units: Number.NaN as unknown as number })]);
  ok("a NaN never propagates into a total", junk.chargedCents === 0 && junk.flowUnits === 0);
}

// ── THE SOURCE RULE ──────────────────────────────────────────────────────────────────────────────────
console.log("\n── money comes from the run table, requests come from the log, and they never mix ──");
{
  const src = require("node:fs").readFileSync("lib/preflight/key-usage.ts", "utf8") as string;
  const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("spend today is the ceiling's own function, not a reimplementation", code.includes("await keySpentTodayCents(key.id, nowMs)"));
  ok("the run read is owner-scoped as well as key-scoped",
    code.includes('.eq("user_id"') && code.includes('.eq("api_key_id", key.id)'));
  ok("requests are read from the events log", code.includes("v_events"));
  ok("and the request count is never folded into a money figure",
    !/chargedCents[^\n]*requests|requests[^\n]*chargedCents/.test(code));

  const route = require("node:fs").readFileSync("app/api/v/keys/[id]/usage/route.ts", "utf8") as string;
  ok("the route establishes ownership from the caller's own key list", route.includes("listApiKeys(owner)") && route.includes("keys.find("));
  ok("a key that is not the caller's is a 404, not someone else's spend", route.includes('{ error: "not_found" }'));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
