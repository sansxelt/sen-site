// Stripe Connect — the payment rail that makes the revenue cut structural.
//
// Each workspace connects an Express account once. When a lead pays (a
// deposit to lock a booking, or the full amount once a deal's agreed), we
// create a Checkout Session as a DESTINATION CHARGE on the platform:
//   payment_intent_data.transfer_data.destination = <connected account>
//   payment_intent_data.application_fee_amount     = <Vraelis cut>
// Stripe splits the money at capture time — the owner receives amount−fee,
// Vraelis keeps the fee. Nothing is self-reported and the cut can't be
// skipped, because the platform takes it before the owner ever sees the money.

import { getStripe } from "./stripe";
import { createPayment, getWorkspaceOffer, type VraelisWorkspace } from "./vraelis-db";
import { cutRateFor } from "./vraelis-plans";

const ORIGIN = "https://vraelis.com";

// Create a new Express connected account for an owner. Called once; the id
// is stored on the workspace.
export async function createConnectAccount(email: string): Promise<string> {
  const stripe = getStripe();
  const acct = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_profile: {
      product_description: "Services booked and paid through Vraelis.",
    },
    metadata: { owner_email: email, platform: "vraelis" },
  });
  return acct.id;
}

// Hosted onboarding link (KYC, bank details). Stripe sends the user back to
// return_url when done, or refresh_url if the link expired.
export async function createAccountLink(accountId: string, base: string): Promise<string> {
  const stripe = getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/vraelis/connect/start`,
    return_url: `${base}/v/account?connect=done`,
    type: "account_onboarding",
  });
  return link.url;
}

// Express dashboard login link (so a connected owner can see payouts).
export async function createDashboardLink(accountId: string): Promise<string | null> {
  try {
    const stripe = getStripe();
    const link = await stripe.accounts.createLoginLink(accountId);
    return link.url;
  } catch {
    return null;
  }
}

export type ConnectStatus = {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
};

export async function getAccountStatus(accountId: string): Promise<ConnectStatus> {
  const stripe = getStripe();
  const a = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: Boolean(a.charges_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
    payoutsEnabled: Boolean(a.payouts_enabled),
  };
}

// Expire a Checkout Session so an unrecorded link can't be paid (used when
// the ledger write fails after the session was created).
export async function expireCheckout(sessionId: string): Promise<void> {
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch (e) {
    console.error("expireCheckout failed:", e);
  }
}

// Decide whether it's safe to REPLACE an old checkout session with a fresh
// one (the recovery cron's core question). Returns:
//   "superseded" — the old session was open and is now expired/dead, so the
//                  old link can no longer be paid → safe to mint a new link
//                  and overwrite stripe_session_id.
//   "paid"       — the old session is already complete/paid (a webhook is in
//                  flight or was missed); the caller must NOT mint a competing
//                  link or overwrite the session id, and should let the
//                  webhook/reconcile settle the original payment.
//   "unknown"    — couldn't determine (Stripe error). Caller should be
//                  conservative and skip this round rather than orphan a link.
export async function supersedeCheckoutSession(
  sessionId: string,
): Promise<"superseded" | "paid" | "unknown"> {
  if (!sessionId) return "superseded"; // nothing to orphan
  let stripe;
  try {
    stripe = getStripe();
  } catch {
    return "unknown"; // no Stripe config → be conservative, skip this round
  }
  try {
    // expire() succeeds only for an OPEN session — that's exactly the case
    // where replacing is safe (the buyer hadn't paid it).
    await stripe.checkout.sessions.expire(sessionId);
    return "superseded";
  } catch {
    // expire() throws for an already-paid or already-expired session. Retrieve
    // to tell them apart: paid → don't replace; already-expired → safe.
    try {
      const cs = await stripe.checkout.sessions.retrieve(sessionId);
      if (cs.payment_status === "paid" || cs.status === "complete") return "paid";
      if (cs.status === "expired") return "superseded"; // already dead, safe to replace
      return "unknown";
    } catch {
      return "unknown";
    }
  }
}

// Fully refund a destination charge (returns the application fee + reverses
// the transfer to the connected account). Used when a paid deposit can't be
// honored (e.g. the slot was taken by a concurrent booking).
export async function refundPayment(paymentIntent: string): Promise<void> {
  try {
    await getStripe().refunds.create({
      payment_intent: paymentIntent,
      refund_application_fee: true,
      reverse_transfer: true,
    });
  } catch (e) {
    console.error("refundPayment failed:", e);
  }
}

// Create a hosted payment page (destination charge + application fee).
export async function createPaymentCheckout(input: {
  accountId: string;
  amountCents: number;
  feeCents: number;
  currency?: string;
  productName: string;
  description?: string | null;
  customerEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency ?? "usd",
          unit_amount: input.amountCents,
          product_data: {
            name: input.productName,
            ...(input.description ? { description: input.description } : {}),
          },
        },
      },
    ],
    payment_intent_data: {
      // application_fee_amount = Vraelis's plan cut, taken whole.
      // on_behalf_of makes the connected account the settlement merchant, so
      // STRIPE'S processing fee (~2.9% + 30¢) is borne by the merchant — it
      // does NOT eat into our platform cut. Merchant nets: total − our cut −
      // Stripe fee. We keep the full application fee.
      application_fee_amount: input.feeCents,
      on_behalf_of: input.accountId,
      transfer_data: { destination: input.accountId },
    },
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: input.metadata,
  });
  return { url: session.url, sessionId: session.id };
}

// One-call payment for a workspace: gate on Connect, compute the plan cut,
// raise the destination charge, record the ledger row (expiring the session
// if that write fails). Returns a payable URL or a reason it didn't. Shared
// by the in-chat AI flow (and reusable elsewhere) so the guards stay in one place.
export async function startWorkspacePayment(
  ws: VraelisWorkspace,
  input: {
    leadId?: string | null;
    kind: "deposit" | "full";
    amountCents: number;
    description?: string | null;
    customerEmail?: string | null;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<{ ok: boolean; url?: string; reason?: string }> {
  if (!ws.connect_account_id || ws.connect_status !== "active") return { ok: false, reason: "connect_required" };
  if (!Number.isFinite(input.amountCents) || input.amountCents < 50) return { ok: false, reason: "amount_too_small" };

  const feeCents = Math.round(input.amountCents * cutRateFor(ws.plan, ws.plan_cycle));
  // Buyer sees the OFFER as the Stripe product (what they're buying), not the
  // business brand. Fail-soft: offer_name may be unmigrated → fall back to brand.
  const offer = await getWorkspaceOffer(ws.owner_email);
  const productName = offer.offerName || ws.business_name || "Vraelis";
  try {
    const { url, sessionId } = await createPaymentCheckout({
      accountId: ws.connect_account_id,
      amountCents: input.amountCents,
      feeCents,
      productName,
      description: input.description ?? (input.kind === "deposit" ? "Deposit" : "Payment"),
      customerEmail: input.customerEmail ?? null,
      successUrl: input.successUrl ?? `${ORIGIN}/pay/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: input.cancelUrl ?? `${ORIGIN}/pay/thanks?canceled=1`,
      metadata: { kind: "vraelis_payment", owner_email: ws.owner_email, lead_id: input.leadId ?? "", pay_kind: input.kind },
    });
    const paymentId = await createPayment({
      ownerEmail: ws.owner_email,
      leadId: input.leadId ?? null,
      kind: input.kind,
      description: input.description ?? null,
      amountCents: input.amountCents,
      feeCents,
      sessionId,
    });
    if (!paymentId) {
      await expireCheckout(sessionId);
      return { ok: false, reason: "record_failed" };
    }
    return { ok: true, url: url ?? undefined };
  } catch (e) {
    console.error("startWorkspacePayment failed:", e);
    return { ok: false, reason: "stripe_error" };
  }
}
