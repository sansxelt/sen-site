// Single source of truth for settling a paid on-platform payment and
// advancing its lead. Both the Stripe webhook AND the reconciliation paths
// (buyer return page + the reconcile cron) funnel through here, so a missed
// or dropped webhook delivery self-heals instead of silently losing money.
//
// Idempotency: markPaymentPaid only flips a row pending->paid on the FIRST
// call and returns the row; every later call returns null. So settleBySession
// runs the advance-the-lead work at most once per payment, no matter how many
// times (webhook + return + cron) it is invoked.

import { getStripe } from "./stripe";
import {
  markPaymentPaid,
  markLeadsFeeBilled,
  setLeadStatus,
  setLeadOutcome,
  type VraelisPayment,
} from "./vraelis-db";
import { createBooking, slotLabel } from "./vraelis-booking";
import { refundPayment } from "./vraelis-connect";
import { sendBookingConfirmation } from "./vraelis-email";
import { captureError } from "./vraelis-monitor";

export type SettleResult =
  | { settled: false; reason: "already_settled" | "not_paid" | "no_session" | "error" }
  | { settled: true; payment: VraelisPayment };

// Advance a payment that markPaymentPaid has JUST flipped to paid (it is the
// idempotency gate, so this body runs once). Booking + lead transitions are
// best-effort and logged on failure — but note: because the row is already
// paid, getPaymentsSummary/Money tab already reflect the money. A failure
// here means "paid + recorded, lead not yet advanced", which the next
// reconcile pass does NOT retry (the row is no longer pending). So we make
// each step independently safe and capture errors loudly rather than swallow.
async function advanceSettledPayment(
  payment: VraelisPayment,
  customerEmail: string | null,
  paymentIntent: string | null,
): Promise<void> {
  if (payment.kind === "deposit" && payment.booking_slot) {
    const result = await createBooking({
      ownerEmail: payment.owner_email,
      leadId: payment.lead_id,
      slotIso: payment.booking_slot,
      name: payment.booking_name ?? undefined,
      contactEmail: customerEmail ?? undefined,
      contactPhone: payment.booking_phone ?? undefined,
      note: "Deposit paid",
    });
    // Slot taken between checkout and payment → refund instead of charging
    // for a slot we can't honor, and don't send a misleading confirmation.
    if (!result.ok) {
      if (paymentIntent) await refundPayment(paymentIntent);
      console.error(`[settle] deposit slot unavailable (${result.reason}), refunded payment ${payment.id}`);
      return;
    }
    await sendBookingConfirmation({
      businessName: payment.description ?? "",
      slotLabel: slotLabel(payment.booking_slot),
      leadEmail: customerEmail ?? null,
      leadName: payment.booking_name ?? null,
      ownerEmail: payment.owner_email,
    });
    if (payment.lead_id) {
      await setLeadStatus(payment.owner_email, payment.lead_id, "booked");
      await setLeadOutcome(payment.owner_email, payment.lead_id, "paid");
      await markLeadsFeeBilled([payment.lead_id]);
    }
  } else if (payment.lead_id) {
    await setLeadStatus(payment.owner_email, payment.lead_id, "won");
    await setLeadOutcome(payment.owner_email, payment.lead_id, "paid");
    await markLeadsFeeBilled([payment.lead_id]);
  }
}

// Settle from a known-paid checkout session (the webhook path: Stripe already
// told us payment succeeded). Returns the row settled (first time) or a reason.
export async function settlePaidSession(
  sessionId: string,
  paymentIntent: string | null,
  customerEmail: string | null,
): Promise<SettleResult> {
  if (!sessionId) return { settled: false, reason: "no_session" };
  const payment = await markPaymentPaid(sessionId, paymentIntent);
  if (!payment) return { settled: false, reason: "already_settled" };
  try {
    await advanceSettledPayment(payment, customerEmail, paymentIntent);
  } catch (err) {
    // The money is recorded (row is paid); only the lead-advance failed. Log
    // loudly so it's recoverable by hand — do NOT rethrow into the webhook,
    // which would make Stripe retry and re-flip nothing (row no longer
    // pending) while re-running booking is unsafe.
    captureError("stripe", err, { where: "settlePaidSession", session: sessionId, paymentId: payment.id });
  }
  return { settled: true, payment };
}

// Reconciliation entry point: given a checkout session id we are NOT sure is
// paid (buyer return page, or a cron sweeping stale pending rows), ask Stripe
// whether it actually paid, and if so settle it. This is the self-heal for a
// webhook that never arrived. Safe to call repeatedly.
export async function reconcileSessionById(sessionId: string): Promise<SettleResult> {
  if (!sessionId) return { settled: false, reason: "no_session" };
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return { settled: false, reason: "error" };
  }
  try {
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    // Only our on-platform payments — never touch subscription/plan sessions.
    if (cs.metadata?.kind !== "vraelis_payment") return { settled: false, reason: "not_paid" };
    const paid = cs.payment_status === "paid" || cs.status === "complete";
    if (!paid) return { settled: false, reason: "not_paid" };
    const paymentIntent =
      typeof cs.payment_intent === "string" ? cs.payment_intent : cs.payment_intent?.id ?? null;
    const customerEmail = cs.customer_details?.email ?? null;
    return settlePaidSession(sessionId, paymentIntent, customerEmail);
  } catch (err) {
    captureError("stripe", err, { where: "reconcileSessionById", session: sessionId });
    return { settled: false, reason: "error" };
  }
}
