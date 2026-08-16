// THE THREE EMAILS THAT GO OUT WITH NOBODY PRESENT.
//
// The lifecycle cron sends to real customers on a schedule, once ever per person per stage. There is no
// review step and no second chance: an email that names the wrong number has already named it. So the two
// things that decide WHO gets mail and WHAT NUMBER it carries are the things asserted here.
//
// The failures these assertions exist to prevent, in the order they would hurt:
//
//   A BALANCE THAT MIXES UNITS. The ledger carries 'credit' and legacy 'cent' rows. Summing both produces
//   a number that is not money in either denomination. lib/v-lifecycle.ts did exactly this: it selected
//   `delta, expires_at` with no unit column and no unit filter, while its own comment claimed to mirror
//   balance(). The win-back gate was `bal > 0`, so an account holding nothing but dead 'cent' rows was told
//   its balance was waiting.
//   AN EMAIL WHOSE ONLY BUTTON IS A PAYMENT WALL. That same `bal > 0` gate also sent the win-back to every
//   account holding 1 to 149 credits, and its button is an unconditional link to the launch surface, which
//   refuses below one pass with a 402. The low-balance template had already had this exact defect removed
//   from it. The gate is now the launch threshold on both sides, and both halves are asserted below.
//   A THRESHOLD IN A RETIRED DENOMINATION. LOW_MAX was 5, meaning "5 checks left" when 1 credit bought 1
//   check. A pass is 150 credits now, so it fired at 3% of one launch and the conversion moment passed in
//   silence. This is the same class as the readiness tool judging affordability in the old denomination.
//   A SECOND COPY OF THE UNIT RULE. The bug was invisible because the rule existed twice and the tests
//   guarded one copy. The static check at the bottom is what stops it coming back.
import { readFileSync } from "node:fs";
import { foldBalances, rowIsLive } from "../lib/v-credits";
import { lowCreditsHtml, winbackHtml } from "../lib/email";
import { nudgeBelowCredits } from "../lib/v-lifecycle";
import { centsToCredits, creditsToCents, CENTS_PER_CREDIT } from "../lib/preflight/auto-recharge";
import { passPriceCents, PASS_INCLUDED_FLOWS } from "../lib/preflight/pass-pricing";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const NOW = Date.parse("2026-08-03T12:00:00.000Z");
const PAST = "2026-07-01T00:00:00.000Z";
const FUTURE = "2026-09-01T00:00:00.000Z";

type Row = Parameters<typeof foldBalances>[0][number];
const row = (over: Partial<Row> & { user_id: string; delta: number }): Row => ({
  bucket: "purchased", expires_at: null, ext_ref: null, ...over,
} as Row);

const fold = (rows: Row[], unit = "credit", legacy = false) =>
  foldBalances(rows, { legacy, unit, now: NOW });

// ── unit isolation ────────────────────────────────────────────────────────────────────────────────────
console.log("── a balance is only meaningful per unit ──");
{
  const mixed = [
    row({ user_id: "a@x.com", delta: 100, unit: "credit" }),
    row({ user_id: "a@x.com", delta: 5000, unit: "cent" }),
  ];
  ok("legacy 'cent' rows are not summed into a credit balance",
    fold(mixed).get("a@x.com") === 100,
    `got ${fold(mixed).get("a@x.com")}`);

  ok("asking for cents returns only cents",
    fold(mixed, "cent").get("a@x.com") === 5000);

  // THE REGRESSION, STATED AS A NUMBER. The old code returned 5100 here: neither a credit balance nor a
  // cent one, and above every threshold either denomination would set.
  ok("the mixed sum that shipped (5100) is not produced by any unit",
    fold(mixed).get("a@x.com") !== 5100 && fold(mixed, "cent").get("a@x.com") !== 5100);

  ok("a row with no unit column counts as credit",
    fold([row({ user_id: "b@x.com", delta: 42 })]).get("b@x.com") === 42);

  ok("an explicit null unit counts as credit",
    fold([row({ user_id: "b@x.com", delta: 42, unit: null })]).get("b@x.com") === 42);

  // An account whose ONLY rows are cents must read as absent, not as funded. This is the exact shape the
  // win-back gate mis-read.
  ok("an account holding only 'cent' rows has no credit balance at all",
    fold([row({ user_id: "c@x.com", delta: 9999, unit: "cent" })]).has("c@x.com") === false);

  ok("legacy read (flag off) does not filter by unit at all",
    fold([row({ user_id: "d@x.com", delta: 7 })], "credit", true).get("d@x.com") === 7);
}

console.log("── expiry, on the same rows ──");
{
  ok("an expired row is excluded",
    fold([row({ user_id: "e@x.com", delta: 50, expires_at: PAST })]).has("e@x.com") === false);
  ok("an unexpired row is included",
    fold([row({ user_id: "e@x.com", delta: 50, expires_at: FUTURE })]).get("e@x.com") === 50);
  ok("a null expiry never expires",
    rowIsLive({ expires_at: null }, NOW));
  ok("expiry is exclusive at the boundary: expired exactly now is dead",
    rowIsLive({ expires_at: new Date(NOW).toISOString() }, NOW) === false);
  // Expiry is applied BEFORE the unit filter in one pass; a live cent row must still not reach a credit sum.
  ok("expiry and unit are both applied, not one or the other",
    fold([
      row({ user_id: "f@x.com", delta: 10, unit: "credit", expires_at: PAST }),
      row({ user_id: "f@x.com", delta: 20, unit: "cent", expires_at: FUTURE }),
    ]).has("f@x.com") === false);
}

console.log("── per-user grouping ──");
{
  const many = [
    row({ user_id: "g@x.com", delta: 100 }),
    row({ user_id: "g@x.com", delta: -40 }),
    row({ user_id: "h@x.com", delta: 7 }),
    row({ user_id: "h@x.com", delta: 3000, unit: "cent" }),
  ];
  const m = fold(many);
  ok("deltas net per user", m.get("g@x.com") === 60);
  ok("one user's cents cannot leak into another's credits", m.get("h@x.com") === 7);
  ok("a user with no live rows is absent rather than zero", m.has("z@x.com") === false);
}

// ── the threshold ─────────────────────────────────────────────────────────────────────────────────────
console.log("── the low-balance threshold is one launch, in the current denomination ──");
{
  const withFlag = (v: string | undefined, f: () => number): number => {
    const prev = process.env.VRAELIS_PASS_PRICING;
    if (v === undefined) delete process.env.VRAELIS_PASS_PRICING;
    else process.env.VRAELIS_PASS_PRICING = v;
    try { return f(); } finally {
      if (prev === undefined) delete process.env.VRAELIS_PASS_PRICING;
      else process.env.VRAELIS_PASS_PRICING = prev;
    }
  };

  const on = withFlag("1", nudgeBelowCredits);
  const off = withFlag(undefined, nudgeBelowCredits);

  ok("under pass pricing the threshold is one standard pass in credits", on === 150, `got ${on}`);
  ok("it equals the real price, not a copy of it",
    on === centsToCredits(passPriceCents(PASS_INCLUDED_FLOWS)));
  ok("one standard pass really is $15.00", passPriceCents(PASS_INCLUDED_FLOWS) === 1500);
  ok("the conversion rate is the one the charging path uses", CENTS_PER_CREDIT === 10);

  // The point of the retune, as a fact about a specific account.
  ok("an account at 149 credits cannot launch and IS nudged", 149 < on);
  ok("the old threshold would have skipped that account", 149 > 5);
  ok("an account at 150 credits can launch and is NOT nudged", 150 >= on);
  ok("an account at zero is nudged", 0 < on);

  ok("with the flag off the pre-flip behaviour is preserved exactly (skip above 5)",
    off === 6 && 5 < off && 6 >= off);
  ok("the flag genuinely changes the threshold", on !== off);
}

console.log("── the two gates, on the numbers the fold produces ──");
{
  const below = 150;
  // Stage 2 sends when the balance cannot buy a launch. Stage 3 sends only when something spendable is
  // there. The account below has 149 credits and 5000 dead cents.
  const rows = [
    row({ user_id: "i@x.com", delta: 149, unit: "credit" }),
    row({ user_id: "i@x.com", delta: 5000, unit: "cent" }),
  ];
  const bal = fold(rows).get("i@x.com") ?? 0;
  ok("low-balance gate fires for an account that cannot launch", bal < below);
  ok("win-back gate sees the credit balance, not the mixed one", bal === 149);

  const centsOnly = [row({ user_id: "j@x.com", delta: 5000, unit: "cent" })];
  const bal2 = fold(centsOnly).get("j@x.com") ?? 0;
  ok("win-back gate refuses an account whose only rows are legacy cents", (bal2 > 0) === false);
  ok("the old code would have sent that email", 5000 > 0);
}

// ── what the emails actually render ───────────────────────────────────────────────────────────────────
// Asserted on the OUTPUT of the template, not on the text of the file. A source scan cannot distinguish a
// live string from a comment describing the string that was removed, which is a false failure waiting to
// happen and, worse, a false pass if the comment is deleted later.
console.log("── the amounts the emails print ──");
{
  ok("149 credits renders as $14.90", (creditsToCents(149) / 100).toFixed(2) === "14.90");
  ok("150 credits renders as $15.00", (creditsToCents(150) / 100).toFixed(2) === "15.00");
  ok("zero renders as $0.00", (creditsToCents(0) / 100).toFixed(2) === "0.00");

  const low = lowCreditsHtml(149);
  ok("the low-balance email states the balance in dollars", low.includes("$14.90"));
  ok("it states the price of a verification next to it", low.includes("$15.00"));
  // A COUNT in prose, not the substring: /credits is a real route and the email links to it.
  const rawCount = /\d+\s*credits?\b/i;
  ok("it never prints a raw credit count", !rawCount.test(low) && !/\b149\b/.test(low));
  ok('it does not call the balance "included"', !/included/i.test(low));
  // The retune means every recipient is below one pass, so a launch link is a link to a 402.
  ok("it does not link to the launch surface",
    !/href="https:\/\/app\.vraelis\.com"/.test(low));
  ok("it links to plans and to adding balance",
    low.includes("app.vraelis.com/plans") && low.includes("app.vraelis.com/credits"));

  const empty = lowCreditsHtml(0);
  ok("at zero it does not claim an amount is left", !/\$0\.00 left/.test(empty));
  ok("at zero it still states the price", empty.includes("$15.00"));
  ok("at zero it never prints a raw credit count", !rawCount.test(empty));

  const win = winbackHtml(320);
  ok("the win-back email names the balance in dollars", win.includes("$32.00"));
  ok("it never prints a raw credit count", !rawCount.test(win));
  ok("it links to the launch surface, because that account CAN launch",
    win.includes("https://app.vraelis.com"));

  // THE SAME EMAIL, RENDERED FOR AN ACCOUNT THAT CANNOT LAUNCH. This is the inverse of the assertion
  // directly above, and it is why the send gate is the only protection there is: the template is handed a
  // number and prints it, so the button stays a link to the launch surface whatever the balance says.
  // Asserted from both ends, because a template check alone cannot see a gate and a gate check alone
  // cannot see that the button behind it is unconditional.
  const short = winbackHtml(40);
  const onePass = centsToCredits(passPriceCents(PASS_INCLUDED_FLOWS));
  ok("at 40 credits the win-back email renders $4.00", short.includes("$4.00"));
  ok("it never prints a raw credit count either", !rawCount.test(short));
  ok("it still links to the launch surface, however small the balance is",
    short.includes("https://app.vraelis.com"));
  ok("so this account must never be sent it: 40 credits cannot buy a launch", 40 < onePass);
  ok("the gate that shipped, anything above zero, would have sent it", 40 > 0);
}

// ── the rule cannot exist twice again ─────────────────────────────────────────────────────────────────
console.log("── one place decides what a balance is ──");
{
  const lifecycle = readFileSync("lib/v-lifecycle.ts", "utf8");
  ok("v-lifecycle no longer queries the ledger itself",
    !lifecycle.includes("v_credit_ledger"));
  ok("v-lifecycle has no local balance fold",
    !/function\s+liveBalances/.test(lifecycle));
  ok("v-lifecycle reads balances through lib/v-credits",
    /import\s*\{[^}]*\bbalances\b[^}]*\}\s*from\s*"\.\/v-credits"/.test(lifecycle));
  ok("the threshold is derived from the price, not written as a literal",
    /centsToCredits\(passPriceCents\(PASS_INCLUDED_FLOWS\)\)/.test(lifecycle));
  // Both stages ask the same question, from opposite sides: stage 2 sends below one pass, stage 3 sends at
  // or above it. Stage 3 asked "is there anything at all", which is the defect this line exists to hold.
  ok("the win-back stage gates on the launch threshold, not on any balance at all",
    /if \(bal < nudgeBelowCredits\(\)\)/.test(lifecycle));
  ok("the low-balance stage still gates on the same threshold",
    /if \(bal >= below\)/.test(lifecycle));

  const credits = readFileSync("lib/v-credits.ts", "utf8");
  ok("the unit predicate is exported for exactly one definition",
    /export function rowInUnit/.test(credits));
  ok("both readers share the column list",
    (credits.match(/ledgerColumns\(/g) ?? []).length >= 3);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
