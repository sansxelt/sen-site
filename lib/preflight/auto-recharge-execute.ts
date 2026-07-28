// THE CHARGE ITSELF. Kept apart from auto-recharge.ts on purpose.
//
// That file is the rules, and it is pure so the rules can be exercised without money. This one is the part
// that touches Stripe, and it is written to do as little thinking as possible: it asks decide() whether to
// charge, and if the answer is no it records why and stops. Every judgement lives in the pure module; this
// is the hands.
//
// THE ORDER OF OPERATIONS IS THE SAFETY, and it is the opposite of what feels natural:
//
//   1. Decide.
//   2. CLAIM the idempotency key by writing the event row FIRST, before any money moves.
//   3. Only then charge.
//
// Writing the log after the charge would mean two concurrent settlements both pass decide(), both charge,
// and the second insert then fails on the unique index having already taken the customer's money. Claiming
// first makes the loser of that race lose before it can spend anything. The row is corrected to reflect
// the outcome afterwards.
//
// A CHARGE THAT SUCCEEDS BUT WHOSE GRANT FAILS IS THE WORST CASE, so the grant does not depend on this code
// path at all: the existing payment_intent.succeeded webhook grants credits for any credit_topup intent,
// and this creates exactly that shape. If this function dies immediately after charging, the webhook still
// credits the customer.
import { getStripe, isStripeConfigured } from "../stripe";
import {
  decide, getSettings, record, saveSettings, chargedThisMonthCents,
  MAX_CONSECUTIVE_FAILURES, REFUSAL_TEXT, type RechargeDecision,
} from "./auto-recharge";

export type ExecuteResult =
  | { charged: true; amountCents: number; paymentIntentId: string }
  | { charged: false; reason: string; detail?: string };

/**
 * Consider topping up this owner, and do it if the rules say so.
 *
 * Safe to call often and from anywhere: it is cheap when switched off (one indexed read that returns the
 * OFF state), and every path that could charge is guarded by decide() plus the unique index.
 *
 * `balanceCents` is passed IN rather than read here, because the caller has just settled a run and knows
 * the balance it produced. Re-reading would race with its own write.
 */
export async function maybeTopUp(owner: string, balanceCents: number, nowMs = Date.now()): Promise<ExecuteResult> {
  if (!owner) return { charged: false, reason: "disabled" };

  const settings = await getSettings(owner);
  // The cheapest possible exit, and the common one. Nothing else is read for an account that never turned
  // this on, which is every account until someone does.
  if (!settings.enabled) return { charged: false, reason: "disabled" };

  const month = await chargedThisMonthCents(owner, nowMs);
  const d: RechargeDecision = decide({
    settings,
    balanceCents,
    chargedThisMonthCents: month,
    nowMs,
    lastAttemptAtMs: settings.lastAttemptAt ? Date.parse(settings.lastAttemptAt) : null,
  });

  if (!d.charge) {
    // Refusals worth remembering are the ones a customer would otherwise experience as an unexplained gap.
    // "Balance is fine" and "we just tried" happen constantly and would bury everything else.
    if (d.reason !== "balance_above_trigger" && d.reason !== "cooling_off" && d.reason !== "disabled") {
      await record(owner, { kind: "refused", balanceBeforeCents: balanceCents, reason: REFUSAL_TEXT[d.reason] + (d.detail ? ` (${d.detail})` : "") });
    }
    return { charged: false, reason: d.reason, detail: d.detail };
  }

  if (!isStripeConfigured()) {
    await record(owner, { kind: "refused", balanceBeforeCents: balanceCents, reason: "Billing is not configured." });
    return { charged: false, reason: "not_configured" };
  }

  // ── CLAIM THE KEY BEFORE SPENDING ANYTHING ───────────────────────────────────────────────────────────
  // The unique index decides who proceeds. A duplicate here means another settlement is already topping
  // this account up, and losing that race must cost nothing.
  const claim = await record(owner, {
    kind: "charged", amountCents: d.amountCents, balanceBeforeCents: balanceCents,
    idempotencyKey: d.idempotencyKey, reason: "in progress",
  });
  if (!claim.ok) {
    if (claim.duplicate) return { charged: false, reason: "cooling_off", detail: "another top-up is already in progress" };
    // Could not write the log at all. Refuse: a charge nobody can account for is worse than a refusal.
    return { charged: false, reason: "not_configured", detail: "the top-up log could not be written" };
  }

  await saveSettings(owner, { lastAttemptAt: new Date(nowMs).toISOString() });

  try {
    const stripe = getStripe();
    const credits = Math.round((d.amountCents / 100) * 10); // same 10-credits-per-dollar rate as /credits

    const intent = await stripe.paymentIntents.create(
      {
        customer: settings.stripeCustomerId!,
        payment_method: settings.stripePaymentMethod!,
        amount: d.amountCents,
        currency: "usd",
        // The whole point: no browser, no customer, no chance to authenticate. A card that now requires
        // authentication fails here rather than hanging, which is the correct outcome and is why the
        // failure counter exists.
        off_session: true,
        confirm: true,
        description: `${credits.toLocaleString()} Vraelis credits (automatic top-up)`,
        // EXACTLY THE SHAPE THE EXISTING WEBHOOK GRANTS ON. The credits are not granted by this function;
        // payment_intent.succeeded does it, idempotent on the intent id, exactly as for a manual top-up.
        // So a crash here still leaves the customer credited for what they paid.
        metadata: {
          type: "credit_topup",
          source: "in_app",
          credits: String(credits),
          amountDollars: String(d.amountCents / 100),
          user_id: owner,
          auto: "1",
        },
      },
      // Stripe's own idempotency, on the same key the log claimed. Belt and braces: even a retry of this
      // exact call cannot produce a second charge.
      { idempotencyKey: `auto_${owner}_${d.idempotencyKey}` },
    );

    await record(owner, {
      kind: "charged", amountCents: d.amountCents, balanceBeforeCents: balanceCents,
      stripePaymentIntent: intent.id, reason: null,
    });
    await saveSettings(owner, { consecutiveFailures: 0, disabledReason: null, lastChargeAt: new Date(nowMs).toISOString() });
    return { charged: true, amountCents: d.amountCents, paymentIntentId: intent.id };
  } catch (e) {
    // A decline, or a card that now needs the customer present. Both are the same thing from here: this
    // attempt did not work and the count moves toward switching the whole feature off.
    const code = (e as { code?: string; message?: string })?.code ?? "charge_failed";
    const failures = settings.consecutiveFailures + 1;
    await record(owner, {
      kind: "failed", amountCents: d.amountCents, balanceBeforeCents: balanceCents, reason: String(code),
    });
    await saveSettings(owner, {
      consecutiveFailures: failures,
      ...(failures >= MAX_CONSECUTIVE_FAILURES ? { disabledReason: String(code) } : {}),
    });
    return { charged: false, reason: "charge_failed", detail: String(code) };
  }
}
