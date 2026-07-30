// THE ONE FEATURE THAT MOVES MONEY WITH NOBODY PRESENT.
//
// Every other charge in this product happens because a person clicked. This one happens because a number
// fell, which means the rules ARE the safety, and a rule that is only described in a comment is not one.
// decide() is pure so every branch can be exercised without a card, a customer or a network, and that is
// the whole reason it is shaped that way.
//
// The failures these assertions exist to prevent, in the order they would hurt:
//
//   CHARGING WITHOUT AGREEMENT. A stored card is not consent. A charge that cannot point at a recorded
//   agreement is one the customer will dispute and win, and should.
//   AN UNBOUNDED LOOP. Trigger plus target alone is bounded only by how fast spend empties the balance.
//   A runaway integration would empty a card in small increments that each look reasonable.
//   A LOOP THAT LOOKS LIKE A BUG. A target at or barely above the trigger tops up to the threshold and
//   charges again on the next run.
//   DOUBLE CHARGING. Two settlements finishing together both see a low balance.
//   RETRYING A DECLINE FOREVER. That is how a bank starts treating the merchant as fraudulent.
import { readFileSync } from "node:fs";
import {
  decide, validateSettings, REFUSAL_TEXT,
  MAX_CONSECUTIVE_FAILURES, MIN_TOPUP_MARGIN_CENTS, MAX_MONTHLY_CAP_CENTS,
  CENTS_PER_CREDIT, creditsToCents, centsToCredits,
  type AutoRechargeSettings,
} from "../lib/preflight/auto-recharge";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const NOW = Date.parse("2026-07-27T12:00:00.000Z");

// A fully enrolled, healthy account. Every test below breaks exactly one thing about it.
const READY: AutoRechargeSettings = {
  enabled: true, triggerCents: 500, targetCents: 5000, monthlyCapCents: 20_000,
  stripeCustomerId: "cus_x", stripePaymentMethod: "pm_x", consentAt: "2026-07-01T00:00:00.000Z",
  consecutiveFailures: 0, disabledReason: null, lastChargeAt: null,
};
const call = (over: Partial<AutoRechargeSettings>, balanceCents: number, chargedThisMonthCents = 0, lastAttemptAtMs: number | null = null) =>
  decide({ settings: { ...READY, ...over }, balanceCents, chargedThisMonthCents, nowMs: NOW, lastAttemptAtMs });

console.log("── nothing is charged without an explicit agreement ──");
{
  ok("off by default: a blank account never charges",
    call({ enabled: false }, 0).charge === false);
  const noConsent = call({ consentAt: null }, 0);
  ok("a saved card with no recorded consent never charges",
    noConsent.charge === false && noConsent.reason === "no_consent");
  const noPm = call({ stripePaymentMethod: null }, 0);
  ok("consent with no saved card never charges",
    noPm.charge === false && noPm.reason === "no_payment_method");
  // Consent is checked FIRST so a half-written enrolment cannot charge on the strength of the card alone.
  ok("consent is checked before the card, so a partial write cannot charge",
    call({ consentAt: null, stripePaymentMethod: null }, 0).charge === false
    && (call({ consentAt: null, stripePaymentMethod: null }, 0) as { reason: string }).reason === "no_consent");
  ok("amounts unset means not configured, not a guess",
    (call({ triggerCents: null }, 0) as { reason: string }).reason === "not_configured");
}

console.log("\n── it fires when the customer said it should, and not before ──");
{
  const fires = call({}, 400);
  ok("below the trigger it charges", fires.charge === true);
  ok("and tops up to the target, not by a fixed amount",
    fires.charge === true && fires.amountCents === 4600, JSON.stringify(fires));
  // "top up when I get to $5" means AT $5.
  ok("exactly at the trigger counts as reaching it", call({}, 500).charge === true);
  ok("one cent above the trigger does not", call({}, 501).charge === false);
  ok("a negative balance still tops up to the target only",
    (call({}, -300) as { amountCents: number }).amountCents === 5000);
}

console.log("\n── the monthly ceiling is a stop, not a target ──");
{
  // 4600 needed, 16000 already used against a 20000 cap: 20600 > 20000, so it must refuse.
  const over = call({}, 400, 16_000);
  ok("a top-up that would cross the cap is refused, not trimmed",
    over.charge === false && over.reason === "monthly_cap_reached", JSON.stringify(over));
  ok("and says how much of the cap is gone",
    over.charge === false && /\$160\.00 of \$200\.00/.test(over.detail ?? ""), over.charge === false ? over.detail : "");
  ok("a top-up that fits is allowed", call({}, 400, 15_000).charge === true);
  // Landing exactly on the cap is within it; a limit is a ceiling, not a wall one cent short of it.
  ok("landing exactly on the cap is allowed", call({}, 400, 15_400).charge === true);
  ok("one cent over is not", call({}, 400, 15_401).charge === false);
}

console.log("\n── a declining card is not retried forever ──");
{
  ok(`${MAX_CONSECUTIVE_FAILURES} consecutive failures stops it`,
    call({ consecutiveFailures: MAX_CONSECUTIVE_FAILURES }, 0).charge === false);
  ok("one fewer does not", call({ consecutiveFailures: MAX_CONSECUTIVE_FAILURES - 1 }, 400).charge === true);
  ok("the reason survives to the customer",
    (call({ consecutiveFailures: MAX_CONSECUTIVE_FAILURES, disabledReason: "card_declined" }, 0) as { detail?: string }).detail === "card_declined");
}

console.log("\n── two settlements at once produce one charge ──");
{
  // DIFFERENT TIMESTAMPS, a few hundred milliseconds apart, which is what "two settlements at once"
  // actually looks like. An earlier version called decide() twice with the SAME nowMs and asserted the keys
  // matched, which is true of any pure function and proved nothing: mutation replaced the whole time bucket
  // with the raw millisecond and the test stayed green.
  const a = decide({ settings: READY, balanceCents: 400, chargedThisMonthCents: 0, nowMs: NOW, lastAttemptAtMs: null });
  const b = decide({ settings: READY, balanceCents: 400, chargedThisMonthCents: 0, nowMs: NOW + 800, lastAttemptAtMs: null });
  ok("two settlements 800ms apart produce the SAME idempotency key, so the log rejects the second",
    a.charge === true && b.charge === true && a.idempotencyKey === b.idempotencyKey,
    `${a.charge === true ? a.idempotencyKey : "?"} vs ${b.charge === true ? b.idempotencyKey : "?"}`);
  // A minute later is a different bucket, so a genuine second top-up is not blocked by the first.
  const later = decide({ settings: READY, balanceCents: 400, chargedThisMonthCents: 0, nowMs: NOW + 61_000, lastAttemptAtMs: null });
  ok("a genuinely later top-up gets a different key",
    later.charge === true && later.idempotencyKey !== (a.charge === true ? a.idempotencyKey : ""));
  ok("an attempt moments ago is refused before it reaches the card",
    call({}, 400, 0, NOW - 5_000).charge === false);
  ok("an attempt long ago is not held against it", call({}, 400, 0, NOW - 3_600_000).charge === true);
}

console.log("\n── settings a customer could not have meant ──");
{
  const okSettings = { triggerCents: 500, targetCents: 5000, monthlyCapCents: 20_000 };
  ok("a sane configuration validates", validateSettings(okSettings).length === 0, validateSettings(okSettings).join(" | "));
  // A target at or near the trigger tops up to the threshold and immediately qualifies again.
  ok("a target equal to the trigger is refused",
    validateSettings({ ...okSettings, targetCents: 500 }).some((p) => /above the trigger/.test(p)));
  ok(`a target less than $${MIN_TOPUP_MARGIN_CENTS / 100} above the trigger is refused`,
    validateSettings({ ...okSettings, targetCents: 500 + MIN_TOPUP_MARGIN_CENTS - 1 }).some((p) => /above the trigger/.test(p)));
  ok("a cap smaller than one top-up is refused rather than silently never firing",
    validateSettings({ ...okSettings, monthlyCapCents: 100 }).some((p) => /nothing would ever be charged/.test(p)));
  ok("a zero or negative cap is refused", validateSettings({ ...okSettings, monthlyCapCents: 0 }).length > 0);
  ok("an absurd cap is refused", validateSettings({ ...okSettings, monthlyCapCents: MAX_MONTHLY_CAP_CENTS + 1 }).length > 0);
  ok("fractional cents are refused", validateSettings({ ...okSettings, targetCents: 5000.5 }).length > 0);
  ok("every refusal has wording for the customer",
    (Object.keys(REFUSAL_TEXT) as (keyof typeof REFUSAL_TEXT)[]).every((k) => REFUSAL_TEXT[k].length > 10));
}

console.log("\n── credits are not cents, and the difference charges people ──");
{
  // THE BUG THIS EXISTS TO PREVENT, caught during wiring and before it shipped. balance() returns CREDITS.
  // Every threshold in the module is CENTS. Passing one as the other under-reads the balance tenfold, and
  // an under-read balance looks like an empty one, so an account sitting at $50 would be topped up as if
  // it were at $5. The dangerous direction: it charges people who did not need charging.
  ok("one credit is ten cents", CENTS_PER_CREDIT === 10);
  ok("a 500 credit balance is $50, not $5", creditsToCents(500) === 5000);
  ok("the conversion is exact at the trigger boundary", creditsToCents(50) === 500);
  ok("it rounds rather than drifting on a fractional balance", creditsToCents(0.5) === 5);

  // ── The INVERSE, which is now on the money path ─────────────────────────────────────────────────────
  // PAYG is priced in cents and escrowed in credits: the hold converts here. It used to hold unit='cent'
  // while every purchase mints unit='credit', so a paying customer's balance was invisible to it and the
  // 402 could never be cleared by paying. These assertions guard the conversion that replaced that.
  ok("the two real PAYG prices convert exactly", centsToCredits(1500) === 150 && centsToCredits(300) === 30);
  ok("round-trips at every price on the grid", [100, 300, 1500, 5000].every((c) => creditsToCents(centsToCredits(c)) === c));
  // CEILING, not round: rounding to nearest lets an off-grid price debit LESS than the customer was quoted.
  // Over-charging by at most 9 cents is a support conversation; under-charging is a hole in the ledger.
  ok("an off-grid price rounds UP so a launch can never debit less than its price",
    centsToCredits(1505) === 151 && centsToCredits(1501) === 151 && creditsToCents(centsToCredits(1505)) >= 1505);
  ok("zero and negative never mint a debit", centsToCredits(0) === 0 && centsToCredits(-10) <= 0);

  // THE RATE MUST AGREE WITH WHAT CHECKOUT ACTUALLY SELLS. If someone changes the price of a credit and
  // not this constant, every trigger silently means something else.
  const checkout = readFileSync("app/api/v/checkout/intent/route.ts", "utf8");
  const sold = /const CREDITS_PER_DOLLAR = (\d+);/.exec(checkout)?.[1];
  ok("the checkout route still states its own rate", !!sold, "could not find CREDITS_PER_DOLLAR");
  ok("and this module's cents-per-credit is its exact inverse",
    !!sold && Number(sold) * CENTS_PER_CREDIT === 100, `checkout sells ${sold}/dollar, this says ${CENTS_PER_CREDIT} cents each`);

  // The call site must convert. Passing balance() straight in is the whole bug.
  const accept = readFileSync("lib/preflight/acceptance/accept-run.ts", "utf8");
  ok("the run path converts before deciding, rather than passing credits as cents",
    /maybeTopUp\(owner, creditsToCents\(await balance\(owner\)\)\)/.test(accept));
}

console.log("\n── every payment method Stripe offers, not just cards ──");
{
  const intent = readFileSync("app/api/v/checkout/intent/route.ts", "utf8");
  const exec = readFileSync("lib/preflight/auto-recharge-execute.ts", "utf8");
  const hook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
  const panel = readFileSync("app/rank/app/credits/auto-recharge-panel.tsx", "utf8");
  const api = readFileSync("app/api/v/auto-recharge/route.ts", "utf8");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // The method list is Stripe's, from the dashboard, not a hardcoded one here. Naming types in code is how
  // a product ends up card-only by accident.
  ok("checkout offers whatever the account has enabled, rather than a hardcoded list",
    /automatic_payment_methods: \{ enabled: true \}/.test(strip(intent))
    && !/payment_method_types:\s*\[/.test(strip(intent)));
  // setup_future_usage is also what makes Stripe show only the methods that CAN be reused off-session, so
  // a customer can never save something that would then fail every automatic charge.
  ok("saving asks for off-session reuse, which is what filters the list to reusable methods",
    /setup_future_usage: "off_session"/.test(strip(intent)));
  ok("the executor charges a saved payment method generically, with no card-specific branch",
    /payment_method: settings\.stripePaymentMethod/.test(strip(exec))
    && !/\bcard\b/i.test(strip(exec)));

  // A BANK DEBIT DOES NOT SETTLE WHILE YOU WAIT. Treating "did not throw" as charged tells a customer
  // their balance is topped up while the money has not moved.
  ok("a payment that has not settled yet is not reported as charged",
    /intent\.status === "succeeded"/.test(strip(exec)) && /pending settlement/.test(strip(exec)));
  ok("and the failure counter is only cleared by a payment that actually landed",
    /settled\s*\n?\s*\?\s*\{ consecutiveFailures: 0/.test(strip(exec)));
  ok("the panel says pending rather than charged for one",
    /pending/.test(panel));

  // A bounced debit arrives days later as a webhook. Without this the failure limit is unreachable for
  // bank payments and the protection only ever fires for cards.
  ok("a failure that arrives days later still counts against the limit",
    /case "payment_intent\.payment_failed"/.test(strip(hook)) && /handleAutoTopUpFailed/.test(strip(hook)));
  ok("and only for top-ups this system started, never a customer's own failed checkout",
    /meta\.auto !== "1"/.test(strip(hook)));

  // Calling a PayPal account "your card" is a small lie with a real consequence.
  ok("the saved method is named from Stripe rather than assumed to be a card",
    /paymentMethods\.retrieve/.test(strip(api)) && /paypal/.test(strip(api)) && /us_bank_account/.test(strip(api)));
  ok("a detached method reports as none, so nobody enables against something that is gone",
    /hasPaymentMethod: [^\n]*&& !!method/.test(strip(api)));
  ok("no customer-facing copy calls it a card",
    !/saved card|your card will|Save this card/i.test(panel));
}

console.log("\n── it fails closed ──");
{
  const src = readFileSync("lib/preflight/auto-recharge.ts", "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // A missing table, or a log that cannot be read, must mean "do not charge" and never "unknown".
  ok("a missing settings row reads as OFF, not as unknown", /return off;/.test(code));
  ok("an unreadable event log reports the cap as reached rather than charging blind",
    (code.match(/Number\.MAX_SAFE_INTEGER/g) ?? []).length >= 2);
  ok("the month total is derived from the log, never from a stored counter",
    /kind", "charged"/.test(code) && !/charged_this_month_cents/.test(code));
  // The unique index is what actually stops a double charge; the code must notice it rather than swallow it.
  ok("a unique-violation on the log is reported as a duplicate, not as a plain failure",
    /duplicate:[^;]*23505/.test(code));

  const sql = readFileSync("sql/vraelis-preflight-25-auto-recharge.sql", "utf8");
  ok("the migration is additive: it alters no existing table",
    !/alter table (?!public\.v_auto_recharge)/.test(sql));
  ok("enabled defaults to false in the schema itself", /enabled\s+boolean\s+not null default false/.test(sql));
  ok("the amounts have NO default, so we never pick when someone is charged",
    /trigger_cents\s+integer,/.test(sql) && !/trigger_cents[^,]*default/.test(sql));
  ok("the idempotency index exists, or nothing stops a double charge",
    /create unique index[\s\S]{0,160}idempotency_key/.test(sql));
  ok("refusals are logged too, so an unexplained gap can be explained",
    /refused/.test(sql) && /reason/.test(sql));
}


console.log("\n── the route enforces what a browser cannot be trusted to ──");
{
  const route = readFileSync("app/api/v/auto-recharge/route.ts", "utf8");
  const rcode = route.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const panel = readFileSync("app/rank/app/credits/auto-recharge-panel.tsx", "utf8");

  ok("the row is keyed by the session, never by anything in the request body",
    /const owner = email\.toLowerCase\(\)/.test(rcode) && !/body\.(userId|owner|email)/.test(rcode));
  // A client can post enabled:true with consent:false. The server must not take the checkbox on trust.
  ok("enabling without consent is refused server-side, not just unclickable",
    /body\.consent !== true/.test(rcode));
  ok("a saved card is required before it can be turned on",
    /stripePaymentMethod \|\| !current\.stripeCustomerId/.test(rcode));
  ok("the amounts are validated on the server too", /validateSettings\(nums\)/.test(rcode));

  // TURNING IT OFF MUST NEVER DEPEND ON PASSING VALIDATION. Otherwise a customer whose stored settings this
  // route would now reject cannot switch off a recurring charge.
  const offBranch = rcode.slice(rcode.indexOf("if (!enabled)"), rcode.indexOf("if (body.consent"));
  ok("turning it off is allowed unconditionally, before any validation runs",
    /saveSettings\(owner, \{ enabled: false/.test(offBranch) && !/validateSettings/.test(offBranch));

  // The payment method id is a token. The client needs to know whether one exists, not which one.
  ok("the saved payment method id never leaves the server",
    /hasPaymentMethod: !!s\.stripePaymentMethod/.test(rcode)
    && !/stripePaymentMethod: s\.stripePaymentMethod/.test(rcode) && !/pm_[a-z]/.test(panel));

  ok("the panel offers no default amounts, so we never choose when someone is charged",
    !/useState\("5"\)|useState\("50"\)|defaultValue/.test(panel));
  ok("turning it off is one click and asks for no confirmation",
    /Turn off/.test(panel) && !/confirm\(/.test(panel));
  ok("the panel shows refusals beside charges, so an unexplained gap can be explained",
    /Not charged/.test(panel) && /recent/.test(panel));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
