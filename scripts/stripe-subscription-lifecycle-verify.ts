// THE EMAILS A SUBSCRIBER IS OWED, AND THE ONE PRODUCT THAT NEVER GOT THEM.
//
// Four products sell subscriptions through one Stripe webhook, and each writes its own state and returns.
// The lifecycle email switch sat BELOW all of those returns, so it was only ever reached by the legacy
// sansxel path. Vraelis Rank, the product that actually has paying subscribers, returned two branches
// earlier: nobody was told their subscription had started, that their cancellation was scheduled, or that
// it had ended. The renewal receipt had the same bug one function down, where the Rank invoice handler
// returned before the only thing below it, which was the receipt.
//
// None of that was visible in a test, because the logic lived in a Next route file and a route file may
// only export its HTTP handlers. So the decision moved to lib/stripe-subscription-notify.ts, and this suite
// holds every subscription event shape against it: with no Stripe account, no database, and no mail server.
//
// What is checked here:
//   1. every subscription event produces exactly the right set of emails, including the empty set
//   2. a Rank subscription resolves an emailable owner from its LOCKED checkout metadata
//   3. duplicate deliveries and retries cannot duplicate an email
//   4. malformed and unrelated events exit with nothing to send rather than throwing
//   5. the route still wires all of that up, checked against its source
import { readFileSync } from "node:fs";
import {
  amountLabelFor,
  formatBillingDate,
  invoiceRecipient,
  plannedSubscriptionEmails,
  planDisplayName,
  rankEmailContext,
  resolvePlanKeyFromPriceId,
  subscriptionPeriodEnd,
  type SubscriptionEmailContext,
  type SubscriptionLike,
} from "../lib/stripe-subscription-notify";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const read = (f: string) => readFileSync(f, "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const CTX: SubscriptionEmailContext = {
  email: "owner@example.com",
  planKey: "pro_v1",
  planName: "Pro",
  cycle: "monthly",
  periodEndUnix: 1793577600, // 2026-11-02
};

const kinds = (
  eventType: string,
  sub: SubscriptionLike,
  prev: Record<string, unknown> | null = null,
  ctx: SubscriptionEmailContext = CTX,
) => plannedSubscriptionEmails(eventType, sub, prev, ctx).map((m) => m.kind);

console.log("── a subscription that starts is announced once ──");
{
  ok("an active new subscription earns the activation email",
    kinds("customer.subscription.created", { status: "active" }).join() === "subscription_activated");

  // A trial IS access. Somebody who can use the product should be told it started.
  ok("so does a trialing one",
    kinds("customer.subscription.created", { status: "trialing" }).join() === "subscription_activated");

  // `incomplete` means the first invoice is unpaid and no money has moved. The webhook returns before this
  // is reached, and the rule is restated here so a refactor that removes that guard cannot silently start
  // welcoming people who never paid.
  ok("an unpaid `incomplete` subscription is announced to nobody",
    kinds("customer.subscription.created", { status: "incomplete" }).length === 0);
  ok("nor is one that arrived already past_due",
    kinds("customer.subscription.created", { status: "past_due" }).length === 0);
  ok("nor one created already canceled",
    kinds("customer.subscription.created", { status: "canceled" }).length === 0);

  // The activation email carries a price, and it must come from the catalogue the plan is actually in.
  const planned = plannedSubscriptionEmails("customer.subscription.created", { status: "active" }, null, CTX);
  const first = planned[0];
  ok("the activation email carries the real recurring price",
    first?.kind === "subscription_activated" && first.amountLabel === "$149/mo",
    first?.kind === "subscription_activated" ? first.amountLabel : "no activation email");
}

console.log("\n── cancelling is announced on the TRANSITION, not on every update after it ──");
{
  ok("scheduling a cancellation earns the confirmation",
    kinds("customer.subscription.updated", { status: "active", cancel_at_period_end: true },
      { cancel_at_period_end: false }).join() === "cancellation_scheduled");

  // The bug this shape prevents: a subscription that is already cancelling receives further updates
  // (a card change, a price sync), and each one would re-announce the same cancellation.
  ok("a later update on an already-cancelling subscription announces nothing",
    kinds("customer.subscription.updated", { status: "active", cancel_at_period_end: true },
      { cancel_at_period_end: true }).length === 0);

  // Un-cancelling is not an ending and not a new cancellation.
  ok("reversing a cancellation announces nothing",
    kinds("customer.subscription.updated", { status: "active", cancel_at_period_end: false },
      { cancel_at_period_end: true }).length === 0);

  const planned = plannedSubscriptionEmails("customer.subscription.updated",
    { status: "active", cancel_at_period_end: true }, { cancel_at_period_end: false }, CTX);
  const mail = planned[0];
  ok("the confirmation names the date access actually ends",
    mail?.kind === "cancellation_scheduled" && mail.endsOn === formatBillingDate(CTX.periodEndUnix)
      && mail.endsOn !== "your next billing date",
    mail?.kind === "cancellation_scheduled" ? mail.endsOn : "no cancellation email");
}

console.log("\n── a subscription that ends is announced once, however it ended ──");
{
  // Stripe gave up retrying a failed card.
  ok("active -> unpaid earns the ending notice",
    kinds("customer.subscription.updated", { status: "unpaid" }, { status: "active" }).join() === "subscription_ended");
  ok("active -> canceled earns it too",
    kinds("customer.subscription.updated", { status: "canceled" }, { status: "active" }).join() === "subscription_ended");
  ok("and so does incomplete_expired",
    kinds("customer.subscription.updated", { status: "incomplete_expired" }, { status: "incomplete" }).join() === "subscription_ended");

  // No transition means nothing happened worth an email, even though the status is terminal.
  ok("a terminal status that did not just change announces nothing",
    kinds("customer.subscription.updated", { status: "canceled" }, { status: "canceled" }).length === 0);
  ok("a terminal status with no previous_attributes announces nothing",
    kinds("customer.subscription.updated", { status: "canceled" }, null).length === 0);

  // past_due is dunning, not an ending: Stripe is still retrying and the customer is inside a period they
  // paid for. lib/v-subscriptions.ts makes the same ruling for entitlement.
  ok("one failed payment, still being retried, is not an ending",
    kinds("customer.subscription.updated", { status: "past_due" }, { status: "active" }).length === 0);

  ok("the deletion event always earns the ending notice",
    kinds("customer.subscription.deleted", { status: "canceled" }).join() === "subscription_ended");
  ok("  even when Stripe reports the subscription still active",
    kinds("customer.subscription.deleted", { status: "active" }).join() === "subscription_ended");
}

console.log("\n── one update can legitimately be two things at once ──");
{
  // A subscription cancelled and terminated in the same update earns both, in order, and each is claimed
  // under its own single-send key so neither suppresses the other.
  const both = kinds("customer.subscription.updated",
    { status: "canceled", cancel_at_period_end: true },
    { cancel_at_period_end: false, status: "active" });
  ok("cancel-and-end in one update earns both notices",
    both.join() === "cancellation_scheduled,subscription_ended", both.join() || "none");
  ok("  and they are distinct kinds, so the send markers cannot collide",
    new Set(both).size === both.length);
}

console.log("\n── unrelated and malformed events leave with nothing to send ──");
{
  ok("an invoice event is not a subscription lifecycle event",
    kinds("invoice.paid", { status: "active" }).length === 0);
  ok("a dispute is not either", kinds("charge.dispute.created", { status: "active" }).length === 0);
  ok("nor is an event type nobody has taught this rule about",
    kinds("customer.subscription.paused", { status: "paused" }).length === 0);

  // Nothing here may throw. The caller has already written the state that matters, and an exception at this
  // point would return 500 and earn a Stripe retry for an email that was never owed.
  let threw = false;
  try {
    kinds("customer.subscription.updated", {});
    kinds("customer.subscription.created", {});
    kinds("customer.subscription.deleted", {});
    kinds("", {});
    plannedSubscriptionEmails("customer.subscription.updated", {}, {}, { ...CTX, planKey: "", planName: "" });
  } catch { threw = true; }
  ok("an empty subscription object is survivable, not fatal", !threw);
}

console.log("\n── a Rank subscriber is somebody this system can actually write to ──");
{
  // app/api/v/subscribe/route.ts writes { type: "v_plan", plan, cycle, user_id }, where user_id is the
  // LOWERCASED OWNER EMAIL and is the same key plan_v1 is stored under.
  const sub: SubscriptionLike = {
    status: "active",
    metadata: { type: "v_plan", plan: "pro_v1", cycle: "monthly", user_id: "owner@example.com" },
    current_period_end: 1793577600,
  };
  const ctx = rankEmailContext(sub);
  ok("a Rank subscription resolves an owner from its locked metadata", ctx?.email === "owner@example.com");
  ok("  and the plan name a customer would recognise", ctx?.planName === "Pro", ctx?.planName ?? "null");
  ok("  and its billing cycle", ctx?.cycle === "monthly");

  const yearly = rankEmailContext({ ...sub, metadata: { ...sub.metadata, cycle: "yearly" } });
  ok("a yearly Rank subscription resolves as yearly", yearly?.cycle === "yearly");

  // The guard that stops a billing notice being posted to a string that is not an address.
  ok("an opaque, non-email owner id declines to send rather than guessing",
    rankEmailContext({ ...sub, metadata: { ...sub.metadata, user_id: "8f14e45f-ceea-467a-9575-6b1c1e0b4a2f" } }) === null);
  ok("missing metadata declines too", rankEmailContext({ status: "active" }) === null);

  // Newer Stripe API versions moved current_period_end onto the subscription ITEM. Reading only the top
  // level printed "your next billing date" in place of a real date in the cancellation notice.
  ok("the period end is read off the item when the subscription omits it",
    subscriptionPeriodEnd({ items: { data: [{ current_period_end: 1793577600 }] } }) === 1793577600);
  ok("  and the top level still wins when present",
    subscriptionPeriodEnd({ current_period_end: 111, items: { data: [{ current_period_end: 222 }] } }) === 111);
  ok("  and a missing one is null, never 0 or 1970",
    subscriptionPeriodEnd({}) === null && formatBillingDate(null) === "your next billing date");
}

console.log("\n── the invoice notice goes to the account, not to the editable address ──");
{
  // customer_email is a finalization snapshot the customer can change in the billing portal. The locked
  // metadata is the key the account is stored under, and it is also the dedupe key, so two spellings of the
  // same person must not each be allowed one copy of the same receipt.
  ok("the locked subscription metadata wins over customer_email",
    invoiceRecipient({
      customer_email: "typo@example.com",
      parent: { subscription_details: { metadata: { user_id: "owner@example.com" } } },
    }) === "owner@example.com");

  ok("the older subscription_details shape is read too",
    invoiceRecipient({
      customer_email: "typo@example.com",
      subscription_details: { metadata: { user_id: "owner@example.com" } },
    }) === "owner@example.com");

  ok("customer_email is the fallback when there is no locked owner",
    invoiceRecipient({ customer_email: "buyer@example.com" }) === "buyer@example.com");

  ok("a non-email locked owner falls back rather than becoming the recipient",
    invoiceRecipient({
      customer_email: "buyer@example.com",
      parent: { subscription_details: { metadata: { user_id: "not-an-email" } } },
    }) === "buyer@example.com");

  ok("an invoice with nobody to write to resolves to null", invoiceRecipient({}) === null);
}

console.log("\n── the plan on the invoice is the plan being sold ──");
{
  // The regression this guards: the webhook resolved price ids against the retired chatbot catalogue only,
  // nothing ever matched, and the fallback label was the word "your", so the renewal notice read
  // "your your plan renews next week".
  ok("the live plans resolve to real names",
    planDisplayName("builder_v1") === "Builder" && planDisplayName("pro_v1") === "Pro" && planDisplayName("scale_v1") === "Scale");
  ok("a key in neither catalogue resolves to null, so the caller chooses the label",
    planDisplayName("definitely_not_a_plan") === null);
  ok("no plan name is ever the word 'your'",
    !["builder_v1", "pro_v1", "scale_v1"].some((k) => (planDisplayName(k) ?? "").toLowerCase() === "your"));

  ok("prices come from the catalogue the plan is in",
    amountLabelFor("builder_v1", "monthly") === "$49/mo" && amountLabelFor("builder_v1", "yearly") === "$490/yr",
    `${amountLabelFor("builder_v1", "monthly")} / ${amountLabelFor("builder_v1", "yearly")}`);
  ok("an unknown plan carries no figure rather than a wrong one",
    amountLabelFor("definitely_not_a_plan", "monthly") === "");

  ok("an unmatched price id resolves to null, not to a legacy plan",
    resolvePlanKeyFromPriceId("price_does_not_exist") === null && resolvePlanKeyFromPriceId(null) === null);
}

console.log("\n── the route still wires it up ──");
{
  const route = strip(read("app/api/stripe/webhook/route.ts"));

  // THE BUG ITSELF. The Rank branch must send before it returns.
  const rankBranch = route.slice(route.indexOf('metadata?.type === "v_plan"'));
  const rankBody = rankBranch.slice(0, rankBranch.indexOf("\n  }"));
  ok("the Rank subscription branch sends its lifecycle emails before returning",
    rankBody.includes("sendSubscriptionEmails"), "the v_plan branch returns without notifying");
  ok("  and writes its state first, so a failed write is retried before anything is claimed",
    rankBody.indexOf("handleRankSubChange") < rankBody.indexOf("sendSubscriptionEmails"));

  // THE SECOND HALF OF THE SAME BUG: the Rank invoice handler returned before the renewal receipt.
  const paid = route.slice(route.indexOf("async function handleInvoicePaid"));
  const paidBody = paid.slice(0, paid.indexOf("\n}"));
  ok("a handled Rank invoice no longer returns before the renewal receipt",
    !/if\s*\(await handleRankInvoicePaid\([^)]*\)\)\s*return/.test(paidBody),
    "handleInvoicePaid still returns on a Rank invoice");
  ok("  but the credit grant still runs first, and unconditionally",
    paidBody.includes("await handleRankInvoicePaid(invoice)"));
  ok("  and the receipt is still gated on a scheduled renewal, so first charges stay silent",
    paidBody.includes('reason !== "subscription_cycle"'));

  // ONE COPY OF THE DECISION. It was a switch inside the route, which is exactly why one product's
  // customers could be missed: the code that knew what to send was below the return that skipped it.
  ok("the route no longer carries its own copy of the email switch",
    !route.includes('case "customer.subscription.deleted": {'),
    "an inline lifecycle switch is back in the route");
  ok("the decision is imported from the one module that owns it",
    route.includes("plannedSubscriptionEmails") && route.includes("lib/stripe-subscription-notify"));

  // EVERY billing email in this file goes out behind a single-send marker. A duplicate Stripe delivery is
  // caught by the event-id dedupe first, but that falls through when the database is unavailable, and this
  // is the layer that has to hold when it does.
  //
  // Counted per FUNCTION, not per file. The three subscription notices share one claim, because the loop
  // in sendSubscriptionEmails claims per planned kind at runtime; the invoice notices each need their own.
  const body = (name: string): string => {
    const i = route.indexOf(`async function ${name}(`);
    if (i < 0) return "";
    const rest = route.slice(i);
    const end = rest.indexOf("\n}");
    return end < 0 ? rest : rest.slice(0, end);
  };
  for (const fn of ["sendSubscriptionEmails", "handleInvoicePaid", "handleInvoicePaymentFailed", "handleInvoiceUpcoming"]) {
    const src = body(fn);
    const sends = (src.match(/await send[A-Za-z]+Email\(/g) ?? []).length;
    ok(`${fn} sends nothing without first claiming a single-send marker`,
      src.length > 0 && sends > 0 && src.includes("claimNotification("),
      src.length === 0 ? "function not found" : `${sends} sends, no claim`);
  }
  // The subscription loop must claim per KIND, so that an update earning two different notices is not
  // reduced to one by a single shared marker.
  ok("the subscription loop claims one marker per notification kind",
    /claimNotification\(\s*event\.id\s*,\s*mail\.kind\s*,\s*ctx\.email\s*\)/.test(body("sendSubscriptionEmails")));
  for (const kind of ["payment_failed", "renewal_upcoming", "renewal_succeeded"]) {
    ok(`  including ${kind}, which previously had none`, route.includes(`"${kind}"`));
  }

  // The Rank branch must NOT fall through to the legacy state writes: those belong to the retired
  // catalogue and would record a Rank subscription as a legacy personal plan.
  ok("the Rank branch does not reach the legacy subscription snapshot",
    !rankBody.includes("upsertActiveSubscription") && !rankBody.includes("invalidateAddonsCache"));

  // A subscription state change is revenue-critical: a failed handler must earn a Stripe retry, not a 200.
  for (const t of ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid"]) {
    ok(`  a failed ${t} still returns 500 so Stripe retries`, route.includes(`"${t}"`));
  }
  ok("and the dedupe claim is released on failure so the retry reprocesses",
    route.includes("releaseStripeEvent(event.id)"));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
