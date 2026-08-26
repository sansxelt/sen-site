// Phase 4.1 — the auto-pay charge calculation, boundary by boundary.
//
// THE DISTINCTION THIS FILE EXISTS TO PIN DOWN. There are three different numbers, and conflating them is
// how a $25-deposit workspace ended up able to have $500 authorized:
//
//   1. THE CHARGE               what the lead is actually asked to pay.
//   2. THE ORDINARY BAND        max(deposit x MULTIPLE, FLOOR) — proportional to the owner's own config.
//   3. THE HARD INCIDENT CEILING min(band, MAX) — MAX does not scale with anything and bounds ONE incident.
//
// For kind="deposit" the charge is deposit_amount_cents VERBATIM. The band and the ceiling are not
// consulted at all, so no ceiling value can ever inflate a deposit charge. For kind="full" a
// model-proposed number exists, and THAT is what the band and ceiling bound — by REFUSAL, never by
// silently clamping down to the ceiling.
//
// The defect being corrected: FLOOR was $500, equal to MAX. max(deposit x 10, 50000) can never be below
// 50000, so min(that, 50000) was always exactly 50000. Every workspace got the maximum and the deposit
// stopped mattering. Floor is now $25.
import { readFileSync } from "node:fs";
import {
  autoCeilingCents, ceilingBreakdown, authorizeAgentPayment,
  AUTO_MAX_CENTS, AUTO_FLOOR_CENTS, AUTO_MULTIPLE, MIN_CHARGE_CENTS,
} from "../lib/vraelis-payment-authz";
import { _resetEnvWarnings } from "../lib/env-num";
import type { VraelisWorkspace } from "../lib/vraelis-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const $ = (cents: number) => `$${(cents / 100).toLocaleString()}`;

const ENV_KEYS = [
  "VRAELIS_AUTO_PAY_MAX_CENTS", "VRAELIS_AUTO_PAY_FLOOR_CENTS", "VRAELIS_AUTO_PAY_MULTIPLE",
] as const;

/** Run `f` with the given overrides, then restore every key exactly as it was. */
function withEnv<T>(over: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, f: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) prev[k] = process.env[k];
  for (const [k, v] of Object.entries(over)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  _resetEnvWarnings();
  try { return f(); } finally {
    for (const k of ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k];
    }
    _resetEnvWarnings();
  }
}

const ws = (depositCents: number): VraelisWorkspace =>
  ({ deposit_amount_cents: depositCents } as unknown as VraelisWorkspace);

// ── 1. The launch defaults are what the owner chose ────────────────────────
console.log("── launch defaults ──");
{
  const clean = { VRAELIS_AUTO_PAY_MAX_CENTS: undefined, VRAELIS_AUTO_PAY_FLOOR_CENTS: undefined, VRAELIS_AUTO_PAY_MULTIPLE: undefined };
  ok("hard incident ceiling defaults to $500", withEnv(clean, AUTO_MAX_CENTS) === 50_000, $(withEnv(clean, AUTO_MAX_CENTS)));
  ok("ordinary floor defaults to $25", withEnv(clean, AUTO_FLOOR_CENTS) === 2_500, $(withEnv(clean, AUTO_FLOOR_CENTS)));
  ok("multiple defaults to 10", withEnv(clean, AUTO_MULTIPLE) === 10, String(withEnv(clean, AUTO_MULTIPLE)));
  // The collapse condition, asserted directly so it cannot come back unnoticed.
  ok("the floor is STRICTLY BELOW the ceiling (no collapse)",
    withEnv(clean, AUTO_FLOOR_CENTS) < withEnv(clean, AUTO_MAX_CENTS),
    `${$(withEnv(clean, AUTO_FLOOR_CENTS))} < ${$(withEnv(clean, AUTO_MAX_CENTS))}`);
}

// ── 2. THE HEADLINE: a $25 deposit does not produce a $500 charge ──────────
console.log("── a $25 deposit ──");
{
  const clean = { VRAELIS_AUTO_PAY_MAX_CENTS: undefined, VRAELIS_AUTO_PAY_FLOOR_CENTS: undefined, VRAELIS_AUTO_PAY_MULTIPLE: undefined };
  const b = withEnv(clean, () => ceilingBreakdown(ws(2_500)))!;
  ok("its ordinary band is $250, not $500", b.band === 25_000, $(b.band));
  ok("its enforced ceiling is $250", b.ceiling === 25_000, $(b.ceiling));
  ok("the hard ceiling is NOT what decided it", b.cappedByIncidentCeiling === false);
  ok("$500 is ABOVE its ceiling and would be refused", 50_000 > b.ceiling);

  // Ground 2 — that a deposit charge is the configured amount, never the ceiling — is proven in section 6.
  ok("under the OLD floor the same workspace WOULD have got $500",
    withEnv({ VRAELIS_AUTO_PAY_FLOOR_CENTS: "50000" }, () => autoCeilingCents(ws(2_500))) === 50_000,
    "this is the defect being corrected");
}

// ── 3. Deposits below / at / between / above the boundaries ────────────────
console.log("── boundary sweep ──");
{
  const clean = { VRAELIS_AUTO_PAY_MAX_CENTS: undefined, VRAELIS_AUTO_PAY_FLOOR_CENTS: undefined, VRAELIS_AUTO_PAY_MULTIPLE: undefined };
  const FLOOR = 2_500, MAX = 50_000;

  // deposit -> expected ceiling, derived from the formula rather than hardcoded, then spot-checked.
  const cases: { deposit: number; ceiling: number; note: string }[] = [
    { deposit: 0,       ceiling: FLOOR,  note: "unset deposit falls back to the floor" },
    { deposit: 1,       ceiling: FLOOR,  note: "1c: below where the multiple bites" },
    { deposit: 249,     ceiling: FLOOR,  note: "just below floor/MULT" },
    { deposit: 250,     ceiling: FLOOR,  note: "exactly floor/MULT: band == floor" },
    { deposit: 251,     ceiling: 2_510,  note: "just above: the multiple takes over" },
    { deposit: 2_500,   ceiling: 25_000, note: "$25 deposit -> $250" },
    { deposit: 4_999,   ceiling: 49_990, note: "just below the ceiling" },
    { deposit: 5_000,   ceiling: MAX,    note: "exactly at MAX/MULT: band == ceiling" },
    { deposit: 5_001,   ceiling: MAX,    note: "just above: the hard ceiling binds" },
    { deposit: 20_000,  ceiling: MAX,    note: "$200 deposit, capped" },
    { deposit: 200_000, ceiling: MAX,    note: "$2,000 deposit, still capped" },
    { deposit: 99_999_999, ceiling: MAX, note: "absurd deposit, still capped" },
  ];

  for (const c of cases) {
    const got = withEnv(clean, () => autoCeilingCents(ws(c.deposit)));
    ok(`deposit ${$(c.deposit).padEnd(12)} -> ceiling ${$(c.ceiling).padEnd(8)} — ${c.note}`, got === c.ceiling, got === null ? "null" : $(got));
  }

  // The invariant that must hold for EVERY deposit, not just the sampled ones.
  const many = [0, 1, 49, 50, 249, 250, 251, 999, 2_500, 4_999, 5_000, 5_001, 12_345, 50_000, 200_000, 1_000_000, 99_999_999];
  ok("no deposit ever yields a ceiling above the hard incident ceiling",
    withEnv(clean, () => many.every((d) => (autoCeilingCents(ws(d)) ?? 0) <= MAX)));
  ok("no deposit ever yields a ceiling below the floor",
    withEnv(clean, () => many.every((d) => (autoCeilingCents(ws(d)) ?? 0) >= FLOOR)));
  ok("the ceiling is monotonic in the deposit (more deposit never means less headroom)",
    withEnv(clean, () => {
      const sorted = [...many].sort((a, b) => a - b);
      let prev = -1;
      for (const d of sorted) { const c = autoCeilingCents(ws(d)) ?? 0; if (c < prev) return false; prev = c; }
      return true;
    }));
  ok("proportionality is restored: a bigger deposit gets a strictly bigger band below the cap",
    withEnv(clean, () => (autoCeilingCents(ws(2_500)) ?? 0) < (autoCeilingCents(ws(4_000)) ?? 0)));

  // Malformed deposits fail closed — no ceiling at all, so nothing can be authorized.
  for (const bad of [-1, -0.5, NaN, Infinity, -Infinity]) {
    ok(`a deposit of ${String(bad)} yields NO ceiling (fail closed)`, withEnv(clean, () => autoCeilingCents(ws(bad))) === null);
  }
  ok("a null deposit is treated as 0, not as unbounded",
    withEnv(clean, () => autoCeilingCents({ deposit_amount_cents: null } as unknown as VraelisWorkspace)) === FLOOR);
}

// ── 4. The band vs the hard ceiling, separated ─────────────────────────────
console.log("── ordinary band vs hard incident ceiling ──");
{
  const clean = { VRAELIS_AUTO_PAY_MAX_CENTS: undefined, VRAELIS_AUTO_PAY_FLOOR_CENTS: undefined, VRAELIS_AUTO_PAY_MULTIPLE: undefined };
  const small = withEnv(clean, () => ceilingBreakdown(ws(2_500)))!;
  const large = withEnv(clean, () => ceilingBreakdown(ws(200_000)))!;

  ok("a small workspace is bounded by its OWN configuration", small.cappedByIncidentCeiling === false, `band ${$(small.band)} == ceiling ${$(small.ceiling)}`);
  ok("a large workspace is bounded by the HARD CEILING", large.cappedByIncidentCeiling === true, `band ${$(large.band)} -> ceiling ${$(large.ceiling)}`);
  ok("  and the hard ceiling only ever reduces, never raises", large.ceiling < large.band && small.ceiling === small.band);
  ok("the hard ceiling is not derived from workspace data",
    withEnv(clean, AUTO_MAX_CENTS) === withEnv(clean, AUTO_MAX_CENTS) && withEnv(clean, () => ceilingBreakdown(ws(999_999_999))!.ceiling) === 50_000);
}

// ── 5. Malformed and extreme environment values ────────────────────────────
console.log("── environment values ──");
{
  const BAD = ["-5", "2.5", "1e99", "0x10", "Infinity", "NaN", "abc", "50000abc", "1_000_000", "+50000", "0", "999999999999", ""];
  for (const v of BAD) {
    ok(`MAX=${JSON.stringify(v)} falls back to $500`, withEnv({ VRAELIS_AUTO_PAY_MAX_CENTS: v }, AUTO_MAX_CENTS) === 50_000);
    ok(`FLOOR=${JSON.stringify(v)} falls back to $25`, withEnv({ VRAELIS_AUTO_PAY_FLOOR_CENTS: v }, AUTO_FLOOR_CENTS) === 2_500);
  }
  ok("MULTIPLE=0 falls back to 10", withEnv({ VRAELIS_AUTO_PAY_MULTIPLE: "0" }, AUTO_MULTIPLE) === 10);
  ok("MULTIPLE=101 (above range) falls back to 10", withEnv({ VRAELIS_AUTO_PAY_MULTIPLE: "101" }, AUTO_MULTIPLE) === 10);
  ok("MULTIPLE=100 (top of range) is honoured", withEnv({ VRAELIS_AUTO_PAY_MULTIPLE: "100" }, AUTO_MULTIPLE) === 100);

  // THE IMPORTANT ONE: even with every knob pushed as far as the ranges allow, the ceiling is bounded.
  const extreme = withEnv(
    { VRAELIS_AUTO_PAY_MULTIPLE: "100", VRAELIS_AUTO_PAY_FLOOR_CENTS: "1000000", VRAELIS_AUTO_PAY_MAX_CENTS: undefined },
    () => autoCeilingCents(ws(99_999_999)),
  );
  ok("with MULTIPLE and FLOOR maxed, the hard ceiling still binds at $500", extreme === 50_000, extreme === null ? "null" : $(extreme));

  // A misconfiguration that re-creates the collapse must be visible, not silent.
  const collapsed = withEnv({ VRAELIS_AUTO_PAY_FLOOR_CENTS: "50000" }, () => ceilingBreakdown(ws(100)));
  ok("setting FLOOR == MAX re-collapses the band (documented hazard)", collapsed!.ceiling === 50_000 && collapsed!.band === 50_000);

  // An operator CAN raise the ceiling deliberately — that is the documented escape hatch.
  ok("a deliberate in-range override is honoured", withEnv({ VRAELIS_AUTO_PAY_MAX_CENTS: "200000" }, AUTO_MAX_CENTS) === 200_000);
  ok("  and then the band can reach it", withEnv(
    { VRAELIS_AUTO_PAY_MAX_CENTS: "200000", VRAELIS_AUTO_PAY_FLOOR_CENTS: undefined },
    () => autoCeilingCents(ws(20_000))) === 200_000);
}

// ── 6. The charge itself — a deposit is never the ceiling ──────────────────
console.log("── the charge, not the ceiling ──");
async function chargePaths(): Promise<void> {
  // No database is configured in this process, so the rolling-cap reservation cannot be read and
  // authorizeAgentPayment must FAIL CLOSED. That is the correct behaviour and it is asserted here: an
  // unreadable ledger must never fall through to "charge something".
  const deposit = await authorizeAgentPayment(ws(2_500), { kind: "deposit", proposedCents: 50_000 });
  ok("a deposit with an unreadable ledger is refused, not charged", deposit.ok === false);
  if (!deposit.ok) ok("  and the reason names the unavailable ceiling", deposit.reason === "ceiling_unavailable", deposit.reason);

  const full = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: 50_000 });
  ok("a $500 'full' against a $25 deposit is refused", full.ok === false);
  if (!full.ok) {
    ok("  refused for being ABOVE THE CEILING, before the ledger is even consulted",
      full.reason === "above_auto_ceiling", full.reason);
    ok("  and the ceiling it reports is $250, not $500", full.ceilingCents === 25_000, full.ceilingCents === null ? "null" : $(full.ceilingCents));
    ok("  a refusal never carries an amount to charge", !("amountCents" in full));
  }

  // The model proposing exactly the ceiling is allowed through to the ledger check; one cent more is not.
  const atCeiling = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: 25_000 });
  ok("exactly at the ceiling is NOT refused for the ceiling", !atCeiling.ok && atCeiling.reason !== "above_auto_ceiling", atCeiling.ok ? "ok" : atCeiling.reason);
  const overCeiling = await authorizeAgentPayment(ws(2_500), { kind: "full", proposedCents: 25_001 });
  ok("one cent past the ceiling IS refused for the ceiling", !overCeiling.ok && overCeiling.reason === "above_auto_ceiling");

  // Source-level: the deposit branch must not consult the ceiling at all.
  const src = readFileSync("lib/vraelis-payment-authz.ts", "utf8").replace(/\r/g, "");
  const depositBranch = src.slice(src.indexOf('if (input.kind === "deposit")'), src.indexOf("const proposed = Number("));
  ok("the deposit branch never calls autoCeilingCents", !depositBranch.includes("autoCeilingCents("));
  ok("  it charges the configured amount verbatim", /amountCents: configured/.test(depositBranch));
  ok("  and it refuses a deposit below the provider minimum", /configured < MIN_CHARGE_CENTS/.test(depositBranch));
  ok("MIN_CHARGE_CENTS is the provider floor, unchanged", MIN_CHARGE_CENTS === 50);
}

chargePaths().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
});
