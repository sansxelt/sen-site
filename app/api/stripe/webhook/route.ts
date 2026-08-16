import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "../../../../lib/stripe";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";
import {
  sendPaymentFailedEmail,
  sendRenewalSucceededEmail,
  sendRenewalUpcomingEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancellationScheduledEmail,
  sendSubscriptionEndedEmail,
} from "../../../../lib/email";
import { type BillingAddonKey, isOneTimeBoost } from "../../../../lib/pricing";
import { getUserProfileByEmail } from "../../../../lib/user-profile";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { addCredits, CREDITS_PER_DOLLAR } from "../../../../lib/credits";
import { invalidateAddonsCache } from "../../../../lib/active-addons";
import { markPaymentCanceledBySession, setWorkspacePlan } from "../../../../lib/vraelis-db";
import { isCycle, isPlanKey } from "../../../../lib/vraelis-plans";
import { maybeProvisionAgentNumber, releaseAgentNumber } from "../../../../lib/vraelis-sms";
import { notifyOwnerPlanLapse } from "../../../../lib/vraelis-notify";
import { settlePaidSession } from "../../../../lib/vraelis-payment-settle";
import { setFlipPlan } from "../../../../lib/flip-db";
import { isTeamSeatPriceId } from "../../../../lib/v-team-billing";
import { claimStripeEvent, markStripeEventResult, releaseStripeEvent, freezeBillingAccess, recordDisputeEvent, claimNotification } from "../../../../lib/preflight/billing-freeze";
import {
  invoiceRecipient,
  plannedSubscriptionEmails,
  planDisplayName,
  rankEmailContext,
  resolvePlanFromPriceId,
  resolvePlanKeyFromPriceId,
  subscriptionPeriodEnd,
  type SubscriptionEmailContext,
} from "../../../../lib/stripe-subscription-notify";

// Vraelis runs in this same Stripe account. Vraelis checkout sessions +
// subscriptions carry metadata { owner_email, plan, cycle }. When an
// event is a vraelis one, record the plan on the vraelis workspace and
// return true so the sansxel handlers skip it.
async function recordVraelisPlan(
  meta: Stripe.Metadata | null | undefined,
  status: "active" | "past_due" | "canceled",
  extra?: { subscriptionId?: string | null; periodEndISO?: string | null },
): Promise<boolean> {
  const owner = meta?.owner_email ?? "";
  const plan = meta?.plan ?? "";
  const cycle = meta?.cycle ?? "";
  if (!owner || !isPlanKey(plan) || !isCycle(cycle)) return false;
  try {
    const { statusChanged } = await setWorkspacePlan(owner, {
      plan,
      cycle,
      status,
      provider: "stripe",
      subscriptionId: extra?.subscriptionId,
      periodEndISO: extra?.periodEndISO,
    });
    if (status === "active") {
      // Paid plan active → assign the agent's phone number (idempotent + gated:
      // no-ops if free, not onboarded, or already assigned). Fire-and-forget so
      // a slow Twilio call can't delay the webhook; internals are self-catching.
      void maybeProvisionAgentNumber(owner).catch(() => {});
    } else if (status === "canceled") {
      // Plan ended → reap the agent's Twilio number so it stops billing and is
      // freed. Fire-and-forget; the daily reap cron is the backstop if this
      // fails. (past_due keeps the number through the short grace window.)
      void releaseAgentNumber(owner).catch(() => {});
    }
    // Email the owner ONCE on a real transition into a lapse state (statusChanged
    // guards against redelivered webhooks re-sending the same notice).
    if (statusChanged && (status === "canceled" || status === "past_due")) {
      void notifyOwnerPlanLapse(owner, status).catch(() => {});
    }
  } catch (err) {
    console.error("[stripe webhook] vraelis plan record failed:", err);
  }
  return true;
}

// Vraelis on-platform payment (Stripe Connect destination charge). The cut
// was already taken as the application fee — here we just record it as paid
// and advance the lead. The settle logic lives in lib/vraelis-payment-settle
// so the reconcile paths (buyer return + cron) share it; markPaymentPaid is
// the idempotency gate, so duplicate deliveries are no-ops.
async function handleVraelisPayment(session: Stripe.Checkout.Session): Promise<void> {
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const result = await settlePaidSession(session.id, paymentIntent, session.customer_details?.email ?? null);
  if (result.settled) {
    // Revalidate both the clean (browser) and internal (rewritten) paths so the
    // owner's dashboard / lead view is fresh on next load regardless of which
    // cache key is hit (see proxy.ts rewrite of /account -> /v/account).
    revalidatePath("/v/account", "layout");
    revalidatePath("/account");
    if (result.payment.lead_id) {
      revalidatePath(`/v/account/leads/${result.payment.lead_id}`, "layout");
      revalidatePath(`/account/leads/${result.payment.lead_id}`);
    }
  }
}

/**
 * Look up the customer's display name so every billing email greets
 * them by name.  Missing profiles (deleted / guest customers) fall
 * back to "" which renders as a plain "Hi," in the templates.
 */
async function displayNameFor(email: string): Promise<string> {
  try {
    const profile = await getUserProfileByEmail(email);
    return profile?.display_name ?? "";
  } catch {
    return "";
  }
}

// The plan catalogues, the date shapes, and the decision about which lifecycle emails an event earns all
// live in lib/stripe-subscription-notify.ts now. They were here, which meant they could not be imported by
// a test: a Next route file may only export its HTTP handlers. See that file's header for why billing
// decisions in particular had to move somewhere testable.

function pickPlanItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | null {
  const items = subscription.items.data;
  if (items.length === 0) return null;
  // v0.1.12 \u2014 memory_boost / api_boost / key_pack removed (no Stripe
  // products were ever created). Empty set kept so the structure is
  // ready if real addon SKUs land later.
  const addonKeys = new Set<string>();
  for (const item of items) {
    const resolved = resolvePlanFromPriceId(item.price.id);
    if (resolved && !addonKeys.has(resolved.planKey)) return item;
  }
  return items[0] ?? null;
}

// ── Resolve email + plan context from a subscription ──────────────────────
async function resolveContext(subscription: Stripe.Subscription): Promise<SubscriptionEmailContext | null> {
  let email = subscription.metadata?.userEmail ?? "";
  if (!email) {
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) return null;
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted || !customer.email) return null;
    email = customer.email;
  }

  const planItem = pickPlanItem(subscription);
  const resolved = planItem ? resolvePlanKeyFromPriceId(planItem.price.id) : null;
  const planKey  = resolved?.planKey ?? subscription.metadata?.planKey ?? "free";
  const cycle    = (resolved?.cycle ?? subscription.metadata?.cycle ?? "monthly") as "monthly" | "yearly";

  // Falls back to the raw key rather than to a generic word: here the key is known (it came off the
  // subscription or its metadata), so printing it is more informative than "subscription".
  const planName = planDisplayName(planKey) ?? planKey;

  return { email, planKey, planName, cycle, periodEndUnix: subscriptionPeriodEnd(subscription) };
}

/**
 * THE LIFECYCLE EMAILS, FOR WHICHEVER PRODUCT THE SUBSCRIPTION BELONGS TO.
 *
 * The decision about what to send is pure and lives in lib/stripe-subscription-notify.ts. This is the half
 * that talks to the world: it resolves the display name once, then claims a single-send marker per email
 * before sending it.
 *
 * claimNotification is keyed on (event id, kind, recipient) and inserts ATOMICALLY, so the same email can
 * never go twice for one event. That covers both ways a handler runs more than once: Stripe redelivering a
 * duplicate, and this webhook returning 500 on a later state failure so Stripe retries. On a retry the
 * state writes re-run, which is safe because they are idempotent, and the already-sent email is skipped.
 *
 * Marking BEFORE the send is deliberate. The worst case becomes a rare MISSED email (a crash between the
 * mark and the send) rather than a duplicate, which is the correct direction for a secondary effect.
 */
async function sendSubscriptionEmails(
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  ctx: SubscriptionEmailContext,
): Promise<void> {
  const prev = (event.data as unknown as { previous_attributes?: Record<string, unknown> }).previous_attributes;
  const planned = plannedSubscriptionEmails(event.type, subscription as unknown as Parameters<typeof plannedSubscriptionEmails>[1], prev, ctx);
  if (planned.length === 0) return;

  const name = await displayNameFor(ctx.email);
  for (const mail of planned) {
    if (!(await claimNotification(event.id, mail.kind, ctx.email))) continue;
    switch (mail.kind) {
      case "subscription_activated":
        await sendSubscriptionActivatedEmail({
          email: ctx.email, name, planName: mail.planName, cycle: mail.cycle, amountLabel: mail.amountLabel,
        });
        break;
      case "cancellation_scheduled":
        await sendSubscriptionCancellationScheduledEmail({
          email: ctx.email, name, planName: mail.planName, endsOn: mail.endsOn,
        });
        break;
      case "subscription_ended":
        await sendSubscriptionEndedEmail({ email: ctx.email, name, planName: mail.planName });
        break;
    }
  }
}

async function handleSubscriptionChange(event: Stripe.Event, subscription: Stripe.Subscription) {
  // ── A SUBSCRIPTION THAT HAS NEVER BEEN PAID FOR GRANTS NOTHING ──────────────────────────────────────
  //
  // `incomplete` means the first invoice is unpaid and Stripe is still waiting. No money has moved, so the
  // correct effect on entitlement is NONE.
  //
  // Every guard below tested for "canceled | unpaid | incomplete_expired" and treated anything else as
  // entitled, so a subscription at `incomplete` fell through to the GRANT branch in all four product paths.
  // That is reachable: app/api/stripe/payment-intent/route.ts already creates default_incomplete
  // subscriptions, and an in-app Payment Element must. Without this line, starting a checkout and never
  // paying hands out a paid plan.
  //
  // `incomplete_expired` IS NOT INCLUDED, and that is a deliberate correction. It is terminal: Stripe has
  // given up and the subscription will never be paid. Returning early on it looked safer, and was not: the
  // legacy path resets plan_key to "free" for any non-active subscription (lib/subscriptions.ts), and
  // skipping that leaves a row permanently marked as a PAID plan for someone who never paid. A terminal
  // state has to be allowed to terminate.
  //
  // The reason it was wrongly included is real and is fixed at its source instead: clearing was not scoped
  // to the subscription that granted the plan, so an abandoned upgrade expiring could clear the plan of a
  // customer still paying on a different subscription. See handleRankSubChange in lib/v-subscriptions.ts,
  // which now refuses to clear while another live subscription exists for the same owner.
  if (subscription.status === "incomplete") {
    return;
  }

  // Team-seat subscription? Sync v_workspace_billing (real-time) and stop BEFORE any
  // personal/plan handling — a team sub must never be recorded as a personal plan.
  if (subscription.metadata?.type === "team_seats") {
    const { handleTeamSubscriptionEvent } = await import("../../../../lib/v-team-billing");
    await handleTeamSubscriptionEvent(event.type, subscription as unknown as Parameters<typeof handleTeamSubscriptionEvent>[1]);
    return;
  }

  // ── VRAELIS RANK: THE PRODUCT THAT IS ACTUALLY BEING SOLD ───────────────────────────────────────────
  //
  // Plan and status go to v_subscriptions / plan_v1, and then the customer is TOLD. This branch used to
  // return here, two branches above the lifecycle email switch, so a real paying customer was never sent
  // the activation, the cancellation confirmation, or the ending notice. Three templates existed, were
  // correct, had tests, and could not be reached by the only product with subscribers.
  //
  // The state write goes first and the email second, on purpose. If handleRankSubChange throws, the webhook
  // returns 500, Stripe retries, and nothing has been claimed yet, so the notice still goes out on the
  // retry. The reverse order could announce a plan change that never got written.
  //
  // Only the notification is shared with the legacy path below. The state writes stay separate, and this
  // must NOT fall through to them: upsertActiveSubscription and invalidateAddonsCache belong to the retired
  // catalogue and would record a Rank subscription as a legacy personal plan.
  if (subscription.metadata?.type === "v_plan") {
    const { handleRankSubChange } = await import("../../../../lib/v-subscriptions");
    await handleRankSubChange(event, subscription);
    const rankCtx = rankEmailContext(subscription as unknown as Parameters<typeof rankEmailContext>[0]);
    if (rankCtx) await sendSubscriptionEmails(event, subscription, rankCtx);
    else console.warn("[stripe webhook] v_plan subscription carried no emailable owner:", subscription.id);
    return;
  }

  // Flip Engine subscription? Flip the flip_accounts plan and stop — separate
  // product from Vraelis, separate table.
  if (subscription.metadata?.flip === "1") {
    const flipCanceled =
      event.type === "customer.subscription.deleted" ||
      ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
    await setFlipPlan({
      userId: subscription.metadata.user_id ?? null,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      plan: flipCanceled ? "free" : "pro",
      planStatus: flipCanceled ? "canceled" : "active",
    });
    return;
  }

  // Vraelis subscription? Record plan status on the vraelis workspace and
  // stop — the sansxel billing logic below doesn't apply to it. Map Stripe's
  // status to our 3-way plan_status: terminal endings → canceled, a failed
  // renewal still retrying → past_due (short grace), everything else → active.
  const canceled =
    event.type === "customer.subscription.deleted" ||
    ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
  const pastDue = !canceled && subscription.status === "past_due";
  const vraelisStatus = canceled ? "canceled" : pastDue ? "past_due" : "active";
  const periodEndRaw = (subscription as unknown as Record<string, unknown>)["current_period_end"];
  const periodEndISO = typeof periodEndRaw === "number" ? new Date(periodEndRaw * 1000).toISOString() : null;
  if (
    await recordVraelisPlan(subscription.metadata, vraelisStatus, {
      subscriptionId: subscription.id,
      periodEndISO,
    })
  ) {
    return;
  }

  const ctx = await resolveContext(subscription);
  if (!ctx) {
    console.warn("[stripe webhook] missing email context, skipping");
    return;
  }

  // Keep the Supabase snapshot in sync.
  await upsertActiveSubscription({
    email:            ctx.email,
    planKey:          ctx.planKey,
    billingCycle:     ctx.cycle,
    currentPeriodEnd: ctx.periodEndUnix,
    stripeStatus:     subscription.status,
  });

  // Drop the cached addon set for this user, the subscription changed
  // (item added / removed / cancelled), so the cap-lift logic needs to
  // re-resolve from Stripe on the next request rather than serving a
  // stale cached set. Covers admin actions in the Stripe dashboard,
  // not just buys via our own routes.
  invalidateAddonsCache(ctx.email);

  // ── Email side effects ─────────────────────────────────────────
  // Which events earn which emails is decided in lib/stripe-subscription-notify.ts, and the same function
  // decides it for the Rank branch above. It was written out here as a switch, which is how the Rank
  // customers ended up with no notices at all: the code that knew what to send sat below the return that
  // meant it was never reached.
  await sendSubscriptionEmails(event, subscription, ctx);
}

/**
 * Dig the price id out of an invoice line item.  Stripe deprecated
 * `line.price` at the type level in the API version we pin (moved under
 * `pricing`) but still returns it in the wire response, narrow cast
 * keeps runtime correct while satisfying TS.
 */
function priceIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const lineItem = invoice.lines?.data?.[0];
  return (lineItem as unknown as { price?: { id?: string } | null } | undefined)
    ?.price?.id ?? null;
}

/**
 * Best-effort plan name lookup for invoice-triggered emails.  Falls back
 * to a generic label so the subject line never reads "$12, undefined".
 *
 * The fallback was the word "your", which was written to sit inside "your ${planName} plan" and produced
 * "your your plan renews next week" the moment the lookup missed, which under the retired catalogue was
 * every single time. It is now a noun that stands on its own, because three templates interpolate this
 * and a fallback written to fit one of their sentences will read wrong in the other two.
 */
function planNameFromInvoice(invoice: Stripe.Invoice): string {
  const resolved = resolvePlanKeyFromPriceId(priceIdFromInvoice(invoice));
  return (resolved && planDisplayName(resolved.planKey)) || "subscription";
}

function formatInvoiceAmount(invoice: Stripe.Invoice): string {
  const amount = invoice.amount_paid || invoice.amount_due || invoice.total;
  const currency = (invoice.currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency,
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
  // Team-seat invoices (monthly OR yearly) are reflected via subscription webhooks
  // (past_due/canceled) — skip the personal "payment failed" email path.
  if (isTeamSeatPriceId(priceIdFromInvoice(invoice))) return;
  const email = invoiceRecipient(invoice as unknown as Parameters<typeof invoiceRecipient>[0]);
  if (!email) return;
  // The event-id dedupe above this is the first line of defence, but it falls through when the DB is
  // unavailable, and this send had no second one: the other four billing emails all claim a single-send
  // marker and this one did not. Telling somebody twice that their card was declined is the last message
  // to duplicate.
  if (!(await claimNotification(eventId, "payment_failed", email))) return;
  await sendPaymentFailedEmail({
    email,
    name:     await displayNameFor(email),
    planName: planNameFromInvoice(invoice),
  });
}

/**
 * invoice.paid, fires on successful renewal charges AND on the initial
 * subscription charge.  We dedupe against the initial case by only
 * emailing when billing_reason === "subscription_cycle" (scheduled
 * renewal).  Initial checkouts are already covered by the welcome email
 * from customer.subscription.created.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string) {
  // ── THE RANK INVOICE IS HANDLED, AND THEN THE CUSTOMER IS STILL TOLD ────────────────────────────────
  //
  // This granted the credits (or set the metered plan state) and then RETURNED, and the only thing below
  // this point is the renewal receipt. So the one product with paying subscribers was the one product
  // whose customers were charged every month and never sent a word about it.
  //
  // The boolean is deliberately not read any more. It meant "this was a Rank invoice, no other handler
  // needs it", which was true of the credit path and was never true of the notice. Everything below is
  // gated on its own facts: not a team seat, has a recipient, and billing_reason is a scheduled renewal.
  // That last gate is what keeps the FIRST charge silent here, because an activation email covers it.
  //
  // Credit behaviour is untouched: handleRankInvoicePaid is idempotent per invoice id and still runs first,
  // so a replay cannot double-grant and a failure here cannot lose a grant that already landed.
  {
    const { handleRankInvoicePaid } = await import("../../../../lib/v-subscriptions");
    await handleRankInvoicePaid(invoice);
  }
  // Team-seat invoices (monthly OR yearly) are reflected via subscription webhooks —
  // don't credit or send a personal renewal email for them.
  if (isTeamSeatPriceId(priceIdFromInvoice(invoice))) return;
  const email = invoiceRecipient(invoice as unknown as Parameters<typeof invoiceRecipient>[0]);
  if (!email) return;
  const reason = (invoice as unknown as { billing_reason?: string }).billing_reason;
  if (reason !== "subscription_cycle") return;

  const periodEndUnix = (invoice as unknown as { period_end?: number }).period_end;
  const nextPeriod = typeof periodEndUnix === "number"
    ? new Date(periodEndUnix * 1000).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "your next billing date";

  // Retry-safe: the renewal email is not idempotent and the event may be retried (500 on a later state
  // failure). Single-send marker keyed by (event, type, recipient) — a retry re-runs the credit grant
  // (itself idempotent per invoice id) but skips the already-sent email.
  if (await claimNotification(eventId, "renewal_succeeded", email)) {
    await sendRenewalSucceededEmail({
      email,
      name:        await displayNameFor(email),
      planName:    planNameFromInvoice(invoice),
      amountLabel: formatInvoiceAmount(invoice),
      periodEnd:   nextPeriod,
      invoiceUrl:  invoice.hosted_invoice_url ?? null,
    });
  }
}

/**
 * invoice.upcoming, Stripe sends this roughly 7 days before a renewal.
 * Pure heads-up: gives the user a window to cancel / downgrade / swap
 * cards before money moves.
 */
async function handleInvoiceUpcoming(invoice: Stripe.Invoice, eventId: string) {
  const email = invoiceRecipient(invoice as unknown as Parameters<typeof invoiceRecipient>[0]);
  if (!email) return;
  // Single-send marker, for the same reason as the payment-failed notice: the event-id dedupe falls
  // through when the DB is unavailable, and a duplicate "you are about to be charged" reads as two charges.
  if (!(await claimNotification(eventId, "renewal_upcoming", email))) return;

  // Stripe sends this with `next_payment_attempt` or `period_end` as
  // the target date depending on configuration.
  const anyInvoice = invoice as unknown as {
    next_payment_attempt?: number | null;
    period_end?: number;
  };
  const chargeAt = anyInvoice.next_payment_attempt ?? anyInvoice.period_end ?? null;
  const chargeDate = chargeAt
    ? new Date(chargeAt * 1000).toLocaleDateString("en-US", {
        month: "long", day: "numeric", year: "numeric",
      })
    : "your next billing date";

  await sendRenewalUpcomingEmail({
    email,
    name:        await displayNameFor(email),
    planName:    planNameFromInvoice(invoice),
    amountLabel: formatInvoiceAmount(invoice),
    chargeDate,
  });
}

// ───────────────────────────────────────────────────────────────────
// v0.1.8, payment_intent.succeeded → boost_credits ledger
// ───────────────────────────────────────────────────────────────────
//
// One-time boost top-ups (session_boost, weekly_boost, voice_minute_pack,
// image_credit_pack, copilot_time_pack) are charged via PaymentIntent
// in app/api/desktop/billing/payment-intent/route.ts. The intent's
// metadata carries { addonKey, purchaseKind: "one_time_boost",
// userEmail }. This handler turns a successful charge into a row in
// boost_credits so the gating layer in lib/plan-limits.ts can let the
// user past the plan cap.
//
// Idempotent: the table's stripe_payment_intent column is unique, so a
// retried webhook is a no-op (we swallow the unique-violation error).
/**
 * An automatic top-up that failed AFTER we stopped watching.
 *
 * Only touches intents this system created (metadata.auto === "1"), so a customer's own failed checkout is
 * none of this function's business and must not count against their automatic top-up.
 *
 * The counter it moves is the one that switches the whole feature off after three consecutive failures.
 * That protection exists so a payment method which keeps bouncing stops being retried, and it was only
 * ever reachable by card-shaped failures until this branch existed.
 */
async function handleAutoTopUpFailed(intent: Stripe.PaymentIntent) {
  const meta = (intent.metadata ?? {}) as Record<string, string | undefined>;
  if (meta.type !== "credit_topup" || meta.auto !== "1") return;
  const owner = meta.user_id;
  if (!owner) return;

  try {
    const { getSettings, saveSettings, record, MAX_CONSECUTIVE_FAILURES } = await import("../../../../lib/preflight/auto-recharge");
    const reason = intent.last_payment_error?.code
      ?? intent.last_payment_error?.decline_code
      ?? intent.last_payment_error?.message
      ?? "payment_failed";

    const settings = await getSettings(owner);
    const failures = settings.consecutiveFailures + 1;
    await record(owner, { kind: "failed", amountCents: intent.amount, reason: String(reason) });
    await saveSettings(owner, {
      consecutiveFailures: failures,
      ...(failures >= MAX_CONSECUTIVE_FAILURES ? { disabledReason: String(reason) } : {}),
    });
  } catch (e) {
    console.warn("[stripe webhook] could not record an automatic top-up failure:", intent.id, e);
  }
}

async function handlePaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const meta = intent.metadata ?? {};

  // ── Vraelis credit top-up bought WITHOUT a Checkout session ──────────────────────────────────────────
  //
  // The in-app checkout charges a PaymentIntent directly, so there is no checkout.session.completed to
  // carry the grant. Without this branch that flow takes the money and grants nothing, which is the worst
  // failure this system has: the customer is charged and has no credits and no record.
  //
  // THE SOURCE MARKER IS LICENSING TO GRANT, and it is why this cannot double-grant. A Checkout session
  // does NOT copy its metadata onto the PaymentIntent unless payment_intent_data.metadata is set, and
  // /api/v/checkout deliberately does not set it, so today only the session handler fires for that flow.
  // Requiring source === "in_app" means that stays true even if someone later copies metadata onto the
  // intent: the session grant and this one can never both apply to the same purchase.
  //
  // Idempotency is the ledger's, keyed on the PaymentIntent id, so a webhook replay or a Stripe retry
  // cannot grant twice. grant() returns false when the ext_ref has been seen, and only a fresh grant
  // writes the audit row.
  if (meta.type === "credit_topup" && meta.source === "in_app") {
    const userId = meta.user_id ?? null;
    const credits = parseInt(meta.credits || "0", 10);
    if (!userId || !(credits > 0)) {
      console.warn("[stripe webhook] in-app topup intent missing metadata:", intent.id);
      return;
    }
    const { recordPackPurchase } = await import("../../../../lib/v-db");
    const { grant } = await import("../../../../lib/v-credits");
    if (await grant(userId, credits, "topup", { bucket: "purchased", extRef: intent.id })) {
      await recordPackPurchase(userId, "credit_topup", credits, intent.id);
    }

    // ── THE CARD, IF AND ONLY IF THE CUSTOMER ASKED US TO KEEP IT ────────────────────────────────────
    //
    // Deliberately AFTER the grant and never able to affect it. This is a convenience for a future
    // top-up; the credits the customer just paid for are the thing that must not be at risk, so a failure
    // here is swallowed rather than allowed to bubble into a webhook error and a Stripe retry.
    //
    // Runs outside the grant's idempotency check on purpose. grant() returns false on a replay, and a
    // replay is exactly when we might be re-storing a card that a previous delivery already stored. That
    // is an upsert of identical values, which is harmless, whereas skipping it would mean a replayed
    // webhook silently drops the card.
    //
    // WHAT IS WRITTEN, AND WHAT IS NOT. The customer and payment method, nothing else. Not enabled, not
    // consent_at, not any amount. Ticking "save my card" is not agreeing to be charged automatically:
    // that is a separate act on /credits, and decide() refuses without both.
    if (meta.save_card === "1") {
      try {
        const pm = typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id ?? null;
        const cust = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
        if (pm && cust) {
          const { saveSettings } = await import("../../../../lib/preflight/auto-recharge");
          await saveSettings(userId, { stripeCustomerId: cust, stripePaymentMethod: pm });
        } else {
          console.warn("[stripe webhook] save_card requested but intent carried no payment method:", intent.id);
        }
      } catch (e) {
        console.warn("[stripe webhook] could not store the saved card:", intent.id, e);
      }
    }
    return;
  }

  // ── v0.1.9, credits top-up ────────────────────────────────────────
  // metadata.kind === "credits" means the desktop billing panel asked
  // /api/desktop/billing/credits to mint a PaymentIntent for $N. On
  // success we credit the user's running balance (1 USD = 100 credits)
  // via the addCredits journal, idempotent on the payment_intent id.
  const kind = meta.kind ?? "";
  if (kind === "credits") {
    const userEmail = (meta.email ?? meta.userEmail ?? meta.user_email) as string | undefined;
    const dollarsRaw = meta.dollars ?? "";
    const dollars = Math.floor(Number(dollarsRaw));
    if (!userEmail || !Number.isFinite(dollars) || dollars <= 0) {
      console.warn("[stripe webhook] credits intent missing metadata:", intent.id);
      return;
    }
    try {
      await addCredits(
        userEmail,
        dollars * CREDITS_PER_DOLLAR,
        "purchase",
        intent.id,
      );
    } catch (err) {
      console.error("[stripe webhook] addCredits failed:", err);
    }
    return;
  }

  // ── v0.1.8 legacy one-time boost top-ups ───────────────────────────
  // session_boost / weekly_boost still flow through boost_credits so
  // the existing gating layer keeps working. The other v0.1.8 keys
  // (voice_minute_pack, image_credit_pack, copilot_time_pack) were
  // dropped in v0.1.9, credits cover those features now.
  const purchaseKind = meta.purchaseKind ?? meta.purchase_kind;
  if (purchaseKind !== "one_time_boost") return; // Not a boost charge.

  const addonKey = (meta.addonKey ?? meta.addon_key) as string | undefined;
  const userEmail = (meta.userEmail ?? meta.user_email) as string | undefined;
  if (!addonKey || !userEmail) {
    console.warn("[stripe webhook] one_time_boost intent missing metadata:", intent.id);
    return;
  }
  if (!isOneTimeBoost(addonKey)) {
    console.warn("[stripe webhook] one_time_boost intent has unknown addonKey:", addonKey);
    return;
  }
  if (!isDatabaseConfigured()) {
    console.warn("[stripe webhook] boost credit dropped, Supabase not configured.");
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("boost_credits" as never)
    .insert([
      {
        email: userEmail.toLowerCase(),
        addon_key: addonKey as BillingAddonKey,
        stripe_payment_intent: intent.id,
        consumed: false,
      },
    ] as never);
  if (error) {
    // Postgres unique_violation = "23505". Treat as success: the
    // credit was already inserted by an earlier delivery of the same
    // event. Anything else, log and swallow, we still want to 200.
    if ((error as { code?: string }).code === "23505") return;
    console.error("[stripe webhook] boost_credits insert failed:", error.message);
    return;
  }
  // One-time boosts don't lift caps via getActiveAddonKeys (that's
  // only for recurring addons), but invalidating is harmless and
  // keeps the cache honest if the schema later grows.
  invalidateAddonsCache(userEmail);
}

// ── Dispute / chargeback / refund ────────────────────────────────────────────
// Resolve the owner behind a disputed/refunded charge. A charge does not carry our metadata, but its
// invoice / subscription does. Walk charge -> invoice -> subscription metadata.user_id (our locked
// checkout identity). Returns null when unattributable (still recorded, just not auto-frozen).
async function ownerForCharge(charge: Stripe.Charge): Promise<string | null> {
  // Fast path: some charges carry our metadata directly.
  const metaOwner = charge.metadata?.user_id || charge.metadata?.userEmail || charge.metadata?.owner_email;
  if (metaOwner) return metaOwner;
  try {
    // charge.invoice is present on the wire but not in the pinned type (like other narrow-casts here).
    const chargeInvoice = (charge as unknown as { invoice?: string | { id?: string } | null }).invoice;
    const invoiceId = typeof chargeInvoice === "string" ? chargeInvoice : chargeInvoice?.id ?? null;
    if (invoiceId) {
      const invoice = await getStripe().invoices.retrieve(invoiceId);
      const inv = invoice as unknown as {
        parent?: { subscription_details?: { metadata?: Record<string, string> } };
        subscription_details?: { metadata?: Record<string, string> };
        customer_email?: string | null;
      };
      const m = inv.parent?.subscription_details?.metadata ?? inv.subscription_details?.metadata ?? null;
      if (m?.user_id) return m.user_id;
      if (inv.customer_email) return inv.customer_email;
    }
  } catch (err) {
    console.error("[stripe webhook] ownerForCharge lookup failed:", err);
  }
  // Last resort: the customer's email.
  try {
    const custId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id ?? null;
    if (custId) {
      const cust = await getStripe().customers.retrieve(custId);
      if (!cust.deleted && cust.email) return cust.email;
    }
  } catch { /* unattributable */ }
  return null;
}

// charge.dispute.created — a customer opened a dispute/chargeback. Stripe has already pulled the funds.
// FREEZE execution access immediately (non-destructive: plan_v1 preserved, previous_plan_v1 snapshotted),
// so the disputer cannot keep consuming during the weeks-long resolution. Restore is MANUAL after a won
// dispute. Records the event for the operator regardless of attribution.
async function handleDisputeCreated(dispute: Stripe.Dispute, eventId: string): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  // Resolve the owner. A Stripe API failure here MUST propagate (throw), not be swallowed: the outer
  // webhook catch releases the event claim so Stripe's retry re-runs this handler and the freeze finally
  // lands. Silently continuing with owner=null would record 'processed' and permanently drop the freeze.
  const owner = chargeId ? await ownerForCharge(await getStripe().charges.retrieve(chargeId)) : null;
  const froze = owner ? await freezeBillingAccess(owner, `dispute ${dispute.id} (${dispute.status ?? "created"})`) : false;
  // Record the audit row FIRST-effort (best-effort inside), then, if we could not freeze an attributable
  // charge, THROW so the event is retried rather than deduped away as a silent dropped freeze.
  await recordDisputeEvent({
    owner, disputeId: dispute.id, chargeId, eventId, kind: "dispute_created",
    status: dispute.status ?? null, amountCents: typeof dispute.amount === "number" ? dispute.amount : null, frozeAccess: froze,
  });
  if (owner && froze) {
    console.error(`[stripe webhook] DISPUTE opened for ${owner} — FROZE execution; dispute=${dispute.id} amount=${dispute.amount}`);
    return;
  }
  if (owner && !froze) {
    // Owner resolved but the freeze write did not confirm a transition. freezeBillingAccess returns false
    // when it errored OR when the owner was already frozen. Re-check: if already frozen, this is fine
    // (idempotent redelivery). Otherwise the write failed -> throw to retry.
    const { isBillingFrozen } = await import("../../../../lib/preflight/billing-freeze");
    if (await isBillingFrozen(owner)) {
      console.error(`[stripe webhook] DISPUTE ${dispute.id}: owner ${owner} already frozen (idempotent).`);
      return;
    }
    throw new Error(`dispute ${dispute.id}: freeze write for ${owner} did not confirm — retrying`);
  }
  // Unattributable: the freeze could not land on any owner. This is a real, revenue-critical failure —
  // throw so Stripe retries (attribution may succeed once the invoice/charge is fully propagated).
  throw new Error(`dispute ${dispute.id}: could not attribute charge ${chargeId} to an owner — retrying to freeze`);
}

// charge.dispute.closed — the dispute resolved (won/lost). Recorded for the operator's restore decision.
// NO auto-restore (founder ruling: manual restore after a won dispute only) — a 'won' status here just
// tells the operator it is safe to restore via the admin action.
async function handleDisputeClosed(dispute: Stripe.Dispute, eventId: string): Promise<void> {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
  let owner: string | null = null;
  if (chargeId) {
    try { owner = await ownerForCharge(await getStripe().charges.retrieve(chargeId)); } catch { /* recorded without owner */ }
  }
  console.error(`[stripe webhook] dispute ${dispute.id} CLOSED status=${dispute.status} owner=${owner ?? "?"} — manual restore required if won.`);
  await recordDisputeEvent({
    owner, disputeId: dispute.id, chargeId, eventId, kind: "dispute_closed",
    status: dispute.status ?? null, amountCents: typeof dispute.amount === "number" ? dispute.amount : null, frozeAccess: false,
  });
}

// charge.refunded — a (possibly partial) refund. Recorded for the audit trail. A full refund of a
// subscription charge is a signal the operator may want to freeze/cancel, but a refund alone is not
// auto-freezing (many refunds are legitimate goodwill). Left as an operator decision + audit row.
async function handleChargeRefunded(charge: Stripe.Charge, eventId: string): Promise<void> {
  const owner = await ownerForCharge(charge);
  await recordDisputeEvent({
    owner, disputeId: null, chargeId: charge.id, eventId, kind: "refunded",
    status: charge.refunded ? "fully_refunded" : "partially_refunded",
    amountCents: typeof charge.amount_refunded === "number" ? charge.amount_refunded : null, frozeAccess: false,
  });
}

// ── Route handler ──────────────────────────────────────────────────────────
//
// Behaviour:
//   • Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET → 503 with a
//     clear error. Lets dev environments breathe, the dashboard test
//     button surfaces the misconfiguration instead of crashing.
//   • Bad signature → 400 (the only case where we want Stripe to give
//     up retrying, the secret is wrong, retries won't fix it).
//   • Anything else (handler errors, DB hiccups) → still 200 so we
//     don't earn ourselves a Stripe retry storm against our own bugs.
export async function POST(request: Request) {
  // Two webhook endpoints point here (the sansxel one + a dedicated
  // Vraelis one), each with its own signing secret — accept either.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_VRAELIS_WEBHOOK_SECRET,
  ].filter((s): s is string => Boolean(s));
  if (!isStripeConfigured() || secrets.length === 0) {
    return NextResponse.json(
      {
        error:
          "Stripe webhook is not configured on this server. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.",
      },
      { status: 503 },
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = getStripe().webhooks.constructEvent(body, sig, secret);
      break;
    } catch {
      /* try the next secret */
    }
  }
  if (!event) {
    console.error("Webhook signature verification failed against all secrets");
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  // Dedupe by the Stripe event id via a DB UNIQUE constraint (Stripe delivers events more than once and
  // out of order). A duplicate delivery returns 200 without reprocessing. "unavailable" (table missing /
  // DB down) falls through — no worse than the pre-table status quo, and every handler is idempotent on
  // its own effects. Claimed BEFORE dispatch so a reprocess can never double-apply a state change.
  {
    const objId = (event.data?.object as { id?: string } | undefined)?.id ?? null;
    const claim = await claimStripeEvent(event.id, event.type, objId);
    if (claim === "duplicate") return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // Vraelis one-time + subscription checkouts land their plan here
        // too (belt-and-suspenders with the success-redirect recording).
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.type === "credit_topup") {
          // Vraelis credit top-up — grant credits once (deduped by session id).
          const userId = s.metadata.user_id ?? s.client_reference_id ?? null;
          const credits = parseInt(s.metadata.credits || "0", 10);
          if (userId && credits > 0) {
            const { recordPackPurchase } = await import("../../../../lib/v-db");
            const { grant } = await import("../../../../lib/v-credits");
            // Grant first, idempotent per session id (ledger ext_ref) so a replay
            // can't double-grant and a transient failure can't permanently lose it;
            // record the payment audit row only on a fresh grant.
            if (await grant(userId, credits, "topup", { bucket: "purchased", extRef: s.id })) {
              await recordPackPurchase(userId, "credit_topup", credits, s.id);
            }
          }
        } else if (s.metadata?.flip === "1") {
          // Flip Engine subscription — separate product, separate table.
          await setFlipPlan({
            userId: s.metadata.user_id ?? s.client_reference_id ?? null,
            stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id ?? null,
            plan: "pro",
            planStatus: "active",
          });
        } else if (s.metadata?.kind === "vraelis_payment") {
          await handleVraelisPayment(s);
        } else if (s.metadata?.type === "team_seats" && s.metadata.workspace_id) {
          // Team-seat checkout completed — sync v_workspace_billing from the session's
          // subscription (belt-and-suspenders with customer.subscription.created). A
          // billing-migration checkout is finalized via the subscription event instead,
          // so the old subscription id isn't overwritten before it can be canceled.
          if (s.metadata.billing_migration !== "true") {
            const { syncTeamCheckout } = await import("../../../../lib/v-team-billing");
            await syncTeamCheckout(s.metadata.workspace_id, s.id);
          }
        } else {
          await recordVraelisPlan(s.metadata, "active");
        }
        break;
      }

      case "checkout.session.expired": {
        // A buyer opened a Vraelis payment/deposit link and let it expire
        // (~24h unpaid). Flip the pending ledger row to 'canceled' so it stops
        // counting as an open payment — otherwise the duplicate-charge guard
        // would block the lead from ever getting a fresh link. Only the
        // CURRENT session id is canceled, so a row that was already superseded
        // by the recovery cron (new session id swapped in) is left untouched.
        const s = event.data.object as Stripe.Checkout.Session;
        if (s.metadata?.kind === "vraelis_payment") {
          await markPaymentCanceledBySession(s.id);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event, event.data.object as Stripe.Subscription);
        break;

      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      // A BOUNCED DEBIT ARRIVES DAYS LATE, and until now nothing was listening.
      //
      // A card fails inside the request that created it, so the executor sees it and counts it. A bank
      // debit does not: ACH and SEPA return `processing`, the customer is told it is pending, and the
      // failure turns up as this event days later. Without this branch a bank account that bounces every
      // single time would never reach the failure limit, because the count only ever moved on card-shaped
      // failures. The protection would look present and never fire.
      case "payment_intent.payment_failed":
        await handleAutoTopUpFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id);
        break;

      // Stripe sends both `invoice.paid` (newer) and
      // `invoice.payment_succeeded` (legacy alias) for the same
      // success, treat them identically so dashboard configs that
      // selected either name still work.
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id);
        break;

      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice, event.id);
        break;

      // Dispute / chargeback: freeze execution access immediately (non-destructive), record for audit.
      case "charge.dispute.created":
        await handleDisputeCreated(event.data.object as Stripe.Dispute, event.id);
        break;
      case "charge.dispute.closed":
        await handleDisputeClosed(event.data.object as Stripe.Dispute, event.id);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object as Stripe.Charge, event.id);
        break;

      default:
        break;
    }
    await markStripeEventResult(event.id, "processed");
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type}:`, err);
    // Release the dedupe claim so a redelivery REPROCESSES this event instead of being permanently
    // deduped away (handlers are idempotent, so a reprocess is safe).
    await releaseStripeEvent(event.id);
    // For revenue-CRITICAL mutating events (disputes / subscription / invoice state), return 500 so
    // Stripe actually RETRIES on its own backoff schedule — combined with the released claim, that retry
    // re-runs the handler and the freeze/plan change finally lands. This is what closes the dropped-freeze
    // hole. For best-effort events (emails, one-time boosts), keep 200 so a cosmetic failure doesn't earn
    // a retry storm. (A 200 here would tell Stripe "delivered" and it would never redeliver.)
    const RETRY_ON_FAILURE = new Set([
      "charge.dispute.created", "charge.dispute.closed", "charge.refunded",
      "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted",
      "invoice.paid", "invoice.payment_succeeded",
    ]);
    if (RETRY_ON_FAILURE.has(event.type)) {
      return NextResponse.json({ error: "handler_failed_retry" }, { status: 500 });
    }
    // Best-effort event: still 200 so Stripe doesn't hammer us on a cosmetic error.
  }

  return NextResponse.json({ received: true });
}
