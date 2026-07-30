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
import { apiAccessAllowed } from "../lib/v-entitlements";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const NOW = Date.parse("2026-07-27T14:00:00.000Z");
const HOUR = 3600_000, DAY = 24 * HOUR;
const run = (o: Partial<RunRow> & { created_at: string }): RunRow => ({
  id: "r", state: "completed", decision: "ready",
  held_cents: null, credits_held: null, flow_units: null, deployment_url: null, application_id: null, ...o,
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

// ── A REVOKED KEY'S SPEND MUST NOT VANISH ────────────────────────────────────────────────────────────
// revokeApiKey DELETES the row, and the per-key panel finds keys through the caller's live list, so the
// moment a key is revoked everything it spent stops being attributable to anything. Measured in production:
// 9 of 10 key-launched runs, $120 of $135. Adding up the panels gave $15 against a $135 bill. Losing "which
// key" after revocation is fair; losing "does this add up" is not.
console.log("\n── the panels must add up to the bill ──");
{
  const src = require("node:fs").readFileSync("lib/preflight/key-usage.ts", "utf8") as string;
  const code = src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok("there is an account-wide key spend summary", code.includes("export async function keySpendSummary("));
  ok("it splits live keys from revoked ones", code.includes("liveKeys:") && code.includes("revokedKeys:"));
  ok("it reads every key-launched run, not only the live ones", code.includes('.not("api_key_id", "is", null)'));
  ok("a revoked key is named from the audit log rather than guessed",
    code.includes('"api_key_used"') && code.includes("metadata->>id"));
  ok("and stays unnamed when the log cannot name it", code.includes("prefix = null"));

  const route = require("node:fs").readFileSync("app/api/v/keys/spend/route.ts", "utf8") as string;
  ok("the summary route requires a session", route.includes('{ error: "signin_required" }'));
  ok("and scopes to the caller's own keys", route.includes("listApiKeys(owner)"));
}

// The split is arithmetic, so it can be proven rather than described: live + revoked must equal the total,
// whatever the rows are.
{
  const rows: RunRow[] = [
    run({ created_at: new Date(NOW - HOUR).toISOString(), held_cents: 1500, flow_units: 1 }),
    run({ created_at: new Date(NOW - 2 * DAY).toISOString(), held_cents: 3000, flow_units: 2 }),
    run({ created_at: new Date(NOW - 3 * DAY).toISOString(), held_cents: null, flow_units: 3 }),
  ];
  const liveOnly = windowOf(rows.slice(0, 1));
  const revokedOnly = windowOf(rows.slice(1));
  const total = windowOf(rows);
  ok("live money plus revoked money equals the total",
    liveOnly.chargedCents + revokedOnly.chargedCents === total.chargedCents, `${liveOnly.chargedCents}+${revokedOnly.chargedCents} vs ${total.chargedCents}`);
  ok("live runs plus revoked runs equal the total", liveOnly.runs + revokedOnly.runs === total.runs);
  ok("live journeys plus revoked journeys equal the total",
    liveOnly.flowUnits + revokedOnly.flowUnits === total.flowUnits, `${liveOnly.flowUnits}+${revokedOnly.flowUnits} vs ${total.flowUnits}`);
}

// ── A SCALE SUBSCRIBER MUST BE ABLE TO USE THE API THEY ARE PAYING FOR ───────────────────────────────
// apiAccessAllowed took only the legacy plan. A versioned-plan subscriber has no v_subscriptions row, so
// getPlan returns "free", and "scale_v1" is not a key in the legacy TABLE either, so entitlements() also
// falls back to free. Two independent reasons, same answer: someone paying for the plan whose headline
// feature is the API was refused key creation AND every request an existing key made.
console.log("\n── the plan that sells the API must grant the API ──");
{
  ok("a versioned Scale subscriber is allowed", apiAccessAllowed("free", "a@b.c", "scale_v1"));
  ok("and that is the exact shape a v1 subscriber presents: legacy plan reads free",
    apiAccessAllowed("free", "a@b.c", "scale_v1") && !apiAccessAllowed("free", "a@b.c"));
  ok("the legacy Scale plan still works", apiAccessAllowed("scale", "a@b.c"));
  ok("enterprise still works", apiAccessAllowed("enterprise", "a@b.c"));

  // EVERY PAID PLAN GETS THE API, and this used to assert the opposite.
  //
  // It was Scale only, at $399, and no pricing card said so. The console meanwhile shipped a Command line
  // page, an installer for two platforms and a documented CI gate, so a Builder or Pro customer following
  // any of it was refused by a rule they had no way to read. The assertion was faithfully protecting a
  // decision that was costing customers the cheapest path to depending on the product.
  //
  // Volume still differs per plan and still binds: an API run spends the same allowance a console run
  // does. What changed is whether the door opens at all.
  ok("Builder gets the API", apiAccessAllowed("free", "a@b.c", "builder_v1"));
  ok("Pro gets the API", apiAccessAllowed("free", "a@b.c", "pro_v1"));
  // Free is the one that must stay shut, or the paid tiers are selling nothing.
  ok("free does not", !apiAccessAllowed("free", "a@b.c", null));
  ok("an unknown versioned key grants nothing", !apiAccessAllowed("free", "a@b.c", "enterprise_v9"));

  // Every gate must ASK with the versioned plan, or it reproduces the outage at that one call site.
  //
  // The arguments are extracted by BALANCED PARENTHESES, not by a regex. `apiAccessAllowed(await
  // getPlan(email), email, v1?.plan)` contains a nested call, and a lazy regex stops at the inner `)` and
  // reports two arguments as one. My first version of this check did exactly that and failed two call
  // sites that were correct.
  const argsOf = (src: string): string | null => {
    const start = src.indexOf("apiAccessAllowed(");
    if (start === -1) return null;
    let depth = 0;
    for (let i = start + "apiAccessAllowed".length; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") { depth--; if (depth === 0) return src.slice(start + "apiAccessAllowed(".length + 1, i); }
    }
    return null;
  };
  const topLevelArgs = (args: string): number => {
    let depth = 0, n = 1;
    for (const ch of args) {
      if (ch === "(" || ch === "[") depth++;
      else if (ch === ")" || ch === "]") depth--;
      else if (ch === "," && depth === 0) n++;
    }
    return args.trim() ? n : 0;
  };
  for (const f of ["app/api/v/keys/route.ts", "app/api/v1/_auth.ts", "app/api/v/usage/route.ts", "app/rank/app/usage/page.tsx"]) {
    const args = argsOf(require("node:fs").readFileSync(f, "utf8") as string);
    ok(`${f} asks with the versioned plan`, args !== null && topLevelArgs(args) >= 3, String(args).slice(0, 80));
  }
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
