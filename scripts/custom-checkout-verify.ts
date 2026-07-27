// In-app checkout: the safety properties, asserted structurally.
//
// This exists because the change it guards is not a change of appearance. Moving payment onto our own page
// means the SUBSCRIPTION IS CREATED BEFORE ANY MONEY MOVES, which is the opposite of how Stripe Checkout
// behaves, and every entitlement guard in the webhook was written under the old assumption.
//
// THE HOLE THIS CLOSES. Each guard tested for "canceled | unpaid | incomplete_expired" and treated
// anything else as entitled. A subscription sitting at `incomplete` therefore fell through to the GRANT
// branch in all four product paths (team, rank/_v1, flip, vraelis). It was unreachable while Checkout was
// the only way to subscribe, because Checkout does not create the subscription until payment succeeds. The
// moment anything creates one with payment_behavior "default_incomplete", opening the checkout screen and
// never paying would hand out a paid plan. That is the bug this file is here to keep closed.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const webhook = readFileSync("app/api/stripe/webhook/route.ts", "utf8");
const intent = readFileSync("app/api/v/subscribe/intent/route.ts", "utf8");
const flag = readFileSync("lib/custom-checkout.ts", "utf8");
const panel = readFileSync("app/rank/app/checkout/checkout-own.tsx", "utf8");
const page = readFileSync("app/rank/app/checkout/page.tsx", "utf8");
const topup = readFileSync("app/api/v/checkout/intent/route.ts", "utf8");
const topupSession = readFileSync("app/api/v/checkout/route.ts", "utf8");
const subs = readFileSync("lib/v-subscriptions.ts", "utf8");
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── an unpaid subscription grants nothing, and revokes nothing ──");
{
  const body = code(webhook);
  // The guard has to sit at the TOP of the single subscription entry point, before any product dispatch,
  // or a path added later inherits the old behaviour by default.
  const entry = body.indexOf("async function handleSubscriptionChange");
  const guard = body.indexOf('subscription.status === "incomplete"', entry);
  const firstDispatch = body.indexOf('subscription.metadata?.type === "team_seats"', entry);
  ok("the webhook has a single subscription entry point", entry !== -1);
  ok("it returns early on an unpaid subscription", guard !== -1 && /return;/.test(body.slice(guard, guard + 260)));
  ok("that guard runs BEFORE any product dispatch", guard !== -1 && firstDispatch !== -1 && guard < firstDispatch);
  // `incomplete_expired` is deliberately NOT short-circuited. It is terminal: Stripe has given up and the
  // subscription will never be paid, and the legacy path resets plan_key to "free" for any non-active
  // subscription. Returning early on it looked safer and left rows permanently marked as a PAID plan for
  // someone who never paid. The reason it was first included, an abandoned upgrade clearing a live plan,
  // is fixed where it belongs, in the sibling check in lib/v-subscriptions.
  ok("a terminal state is allowed to terminate", !/incomplete_expired/.test(body.slice(guard, guard + 200)));
  // The old dispatch is only safe with the guard above it; prove it is still the shape that needs one.
  ok("the downstream guards still treat anything non-terminal as entitled (which is why the early return matters)",
    /\["canceled", "unpaid", "incomplete_expired"\]/.test(body));
}

console.log("\n── the intent route cannot quietly double-charge ──");
{
  const body = code(intent);
  ok("one subscription per owner (409 rather than a second plan)", /already_subscribed/.test(body) && /getPlanV1State/.test(body));
  ok("an existing unpaid subscription is REUSED, not stacked",
    /sub\.status === "incomplete"/.test(body) && /reused: true/.test(body));
  ok("reuse matches plan AND cycle AND price, so a resumed checkout cannot pay the wrong price",
    /sub\.metadata\?\.plan === plan/.test(body) && /sub\.metadata\?\.cycle === cycle/.test(body)
    && /price\?\.id === price/.test(body));
  ok("create pins an idempotency key, so a racing double POST yields one subscription",
    /idempotencyKey/.test(body) && /subscriptions\.create\(/.test(body));
  ok("a subscription with no usable intent is cancelled rather than left dangling",
    (body.match(/subscriptions\.cancel\(/g) ?? []).length >= 2);
}

console.log("\n== what the adversarial review found, kept closed ==");
{
  const body = code(intent);
  const hook = code(webhook);
  const subsBody = code(subs);

  // 1. THE BLOCKER. lib/stripe pins 2026-03-25.dahlia, where Invoice has no root payment_intent; the field
  // was renamed confirmation_secret. Reading only the old name returns nothing EVERY time, so the route
  // cancels the subscription it just made and no customer can ever pay. A grep is the only static defence
  // against this; the real one is a TEST-MODE run.
  ok("the confirmation secret is read under its CURRENT name first", /confirmation_secret\?\.client_secret/.test(body));
  ok("the old name is still read as a fallback, so a version move either way keeps working",
    /payment_intent[\s\S]{0,80}client_secret/.test(body));
  ok("both names are expanded on create and on retrieve",
    /latest_invoice\.confirmation_secret/.test(body) && /latest_invoice\.payment_intent/.test(body));
  ok("the charge amount comes from the invoice, not a PaymentIntent that may not exist",
    /invoice\.amount_due/.test(body));

  // 2. Two tabs on two plans left two live, confirmable subscriptions.
  ok("every OTHER unpaid subscription is cancelled before a new one is created",
    /for \(const sub of unpaid\)/.test(body) && /subscriptions\.cancel\(sub\.id\)/.test(body));

  // 3. The duplicate guard asked the local row, which is exactly what fails when a webhook is lost.
  ok("Stripe is asked whether the owner is already subscribed, not only the local plan row",
    /status: "all"/.test(body) && /LIVE_STATUSES\.has\(sub\.status\)/.test(body));
  ok("late dunning counts as subscribed, so unpaid is not treated as a free slot", /"unpaid"/.test(body));

  // 4. A fixed daily key replayed Stripe's cached response for a subscription just cancelled.
  ok("the idempotency key never spans a cancel", /cancelled\.length \? `:after:/.test(body));

  // 5. A frozen owner could pay and have the entitlement write silently dropped.
  ok("a billing-frozen owner is refused before any Stripe object is made",
    /isBillingFrozen\(owner\)/.test(body) && /billing_frozen/.test(body));
  ok("the credits route refuses a frozen owner too", /isBillingFrozen\(owner\)/.test(code(topup)));

  // 6. Stripe's customer email filter is case sensitive; the portal looks up lowercased.
  ok("the Stripe customer is looked up by the LOWERCASED owner, or the portal cannot find the subscription",
    /getOrCreateCustomer\(owner\)/.test(body) && !/getOrCreateCustomer\(email\)/.test(body));
  ok("the credits route does the same", /getOrCreateCustomer\(owner\)/.test(code(topup)));

  // 8. A comped first invoice activates immediately; cancelling it revokes what the webhook just granted.
  ok("an already-active subscription is never cancelled for having no secret",
    /created\.status === "active" \|\| created\.status === "trialing"/.test(body) && /activated: true/.test(body));

  // The guard itself. incomplete_expired is TERMINAL and must be allowed to terminate: returning early on
  // it left rows permanently marked as a paid plan for someone who never paid.
  ok("only incomplete returns early; terminal states flow through",
    /subscription\.status === "incomplete"\) \{/.test(hook));
  ok("incomplete_expired is NOT short-circuited", !/incomplete_expired"\) \{[\s\S]{0,40}return;/.test(hook));
  // The reason incomplete_expired was wrongly included, fixed at its source.
  ok("a plan is never cleared while another live subscription is still paying for it",
    /ownerHasAnotherLiveV1Subscription/.test(subsBody));
}

console.log("\n── the webhook is still the only thing that grants a plan ──");
{
  const body = code(intent);
  // The route may create Stripe objects. It may not write entitlement. If it ever does, activation has two
  // authorities and they will disagree the first time a payment fails after the write.
  for (const forbidden of ["setPlanV1(", "setSubscription(", "grantCredits(", "recordVraelisPlan("]) {
    ok(`the intent route never calls ${forbidden}`, !body.includes(forbidden));
  }
  ok("it carries the SAME metadata the webhook dispatches on",
    /type: "v_plan"/.test(body) && /user_id: owner/.test(body));
  ok("the panel does not claim the plan is active on return",
    /only activation authority/.test(panel) || !/plan is (now )?active/i.test(code(panel)));
}

console.log("\n── a credit top-up that charges must also grant ──");
{
  const body = code(topup);
  const hook = code(webhook);
  // The failure this section exists for: a PaymentIntent has no checkout.session.completed, so without a
  // matching webhook branch the in-app top-up takes the money and grants nothing. That is worse than any
  // subscription failure, because there is no subscription object to reconcile from afterwards.
  ok("the webhook grants credits on payment_intent.succeeded for an in-app top-up",
    /meta\.type === "credit_topup" && meta\.source === "in_app"/.test(hook));
  ok("that grant is keyed on the PaymentIntent id, so a replay cannot double-grant",
    /extRef: intent\.id/.test(hook));
  ok("the route stamps exactly the metadata the webhook dispatches on",
    /type: "credit_topup"/.test(body) && /source: "in_app"/.test(body) && /user_id: owner/.test(body));
  // The source marker makes the two grant paths mutually exclusive. If the Checkout route ever starts
  // copying metadata onto the intent, the session grant and the intent grant must still not both fire.
  ok("the Checkout route does NOT put metadata on the intent, so only one grant path can ever apply",
    !/payment_intent_data/.test(code(topupSession)));
  ok("the amount is derived server-side, never taken from the client",
    /TOPUP_MIN_DOLLARS/.test(body) && /topupMaxDollars\(\)/.test(body) && /amountDollars \* 100/.test(body));
  ok("credits are computed from the clamped dollars, not sent by the browser",
    /const credits = amountDollars \* CREDITS_PER_DOLLAR/.test(body));
  ok("both top-up routes agree on the rate",
    /CREDITS_PER_DOLLAR = 10/.test(body) && /CREDITS_PER_DOLLAR = 10/.test(code(topupSession)));
  ok("only an unconfirmed intent is ever reused, never one already paying",
    /requires_payment_method/.test(body));
  ok("reuse matches the amount, so changing it starts a fresh intent", /pi\.amount === amountDollars \* 100/.test(body));
  ok("create pins an idempotency key", /idempotencyKey/.test(body));
  ok("the top-up endpoint 404s while the flag is off", /customCheckoutEnabled\(\)/.test(body) && /not_found/.test(body));
  ok("it never writes the ledger itself", !/grant\(/.test(body) && !/recordPackPurchase\(/.test(body));
}

console.log("\n── card data never reaches us ──");
{
  const body = code(panel);
  ok("payment fields are Stripe's PaymentElement, not our inputs", /<PaymentElement/.test(body));
  ok("no raw card field is rendered anywhere in the panel",
    !/name=["'](cardNumber|cvc|number|exp)/i.test(body) && !/autoComplete=["']cc-/i.test(body));
  ok("confirmation goes through stripe.confirmPayment", /stripe\.confirmPayment\(/.test(body));
  ok("a 3D Secure challenge has somewhere to come back to", /return_url/.test(body));
  // A payment that ends in a terminal non-success used to clear the spinner and say nothing, leaving the
  // customer one tap from having paid, looking at a form that appeared broken.
  ok("a declined or abandoned payment says so rather than silently unbusying the form",
    /was declined/.test(body) && /not completed/.test(body));
}

console.log("\n── it is off, and off means absent ──");
{
  ok("the flag defaults OFF", /=== "1"/.test(code(flag)) && !/!==/.test(code(flag)));
  // code(), not the raw file: lib/custom-checkout.ts explains in prose that it is deliberately not a
  // NEXT_PUBLIC_ variable, and scanning the comment fails the check the comment exists to document.
  ok("the flag is NOT public, so the server is the only authority on which checkout renders",
    !/NEXT_PUBLIC/.test(code(flag)));
  ok("the endpoint 404s while the flag is off", /customCheckoutEnabled\(\)/.test(code(intent)) && /not_found/.test(code(intent)));
  ok("the page reads the flag on the server", /customCheckoutEnabled\(\)/.test(code(page)));
  ok("with the flag off the page still renders the known-good Checkout path", /<CheckoutClient/.test(code(page)));
  // Scope, stated: subscriptions only. Top-ups and legacy plans keep Checkout, so this change cannot
  // affect them at all.
  ok("subscription plans take the new panel", /ownCheckout && v1Plan/.test(code(page)));
  // The old assertion accepted a bare topupReturnUrl(), which is exactly what shipped and exactly what was
  // broken: /credits arms its wait only when the URL says a purchase just happened, and it recognised
  // ?session_id and ?paypal but not the in-app panel. The customer paid and landed on their OLD balance.
  // So the requirement is now that the return URL CARRIES the expected credits.
  ok("credit top-ups take it too, and return with the credits the page must wait for",
    /kind: "credits"/.test(code(page)) && /topupReturnUrl\(amount \* 10\)/.test(code(page)));
  {
    const returns = code(readFileSync("lib/return-urls.ts", "utf8"));
    ok("the top-up return marks the purchase in the URL", /topup=\$\{credits\}/.test(returns));
    const creditsPage = code(readFileSync("app/rank/app/credits/page.tsx", "utf8"));
    ok("the credits page arms its wait on that marker", /params\?\.get\("topup"\)/.test(creditsPage));
    // The wait must end on the LEDGER, not on a timer: eight polls and silence is how a slow webhook left
    // the page showing an old balance under the words "Payment received".
    ok("it waits for the balance to actually reach the target", /b >= target/.test(creditsPage));
    ok("it says so plainly when the grant has not arrived", /setSettle\("slow"\)/.test(creditsPage));
    ok("it only claims credited when the number is really there", /setSettle\("credited"\)/.test(creditsPage));
  }
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
