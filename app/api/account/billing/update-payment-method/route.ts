import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { sendPaymentMethodUpdatedEmail } from "../../../../../lib/email";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getStripe,
} from "../../../../../lib/stripe";

/**
 * POST /api/account/billing/update-payment-method
 * Body: { paymentMethodId }
 *
 * Called after the browser confirms a SetupIntent.  Sets the new payment
 * method as default on both the customer and their active subscription.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    paymentMethodId?: string;
  };

  const paymentMethodId = payload.paymentMethodId?.trim() ?? "";
  if (!paymentMethodId) {
    return NextResponse.json({ error: "Missing payment method." }, { status: 400 });
  }

  try {
    const stripe   = getStripe();
    const customer = await getOrCreateCustomer(session.user.email.toLowerCase());

    // Attach if not already attached.
    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    } catch (err) {
      // Likely already attached to this customer — Stripe throws if so.
      const code = (err as { code?: string }).code;
      if (code !== "resource_already_exists") throw err;
    }

    await stripe.customers.update(customer.id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await findUsableSubscription(customer.id);
    if (subscription) {
      await stripe.subscriptions.update(subscription.id, {
        default_payment_method: paymentMethodId,
      });
    }

    // Confirmation email — read back the card brand + last4 from the
    // payment method we just attached so the copy is accurate.
    try {
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (pm.card) {
        sendPaymentMethodUpdatedEmail({
          email: session.user.email,
          name:  session.user.name ?? "",
          brand: pm.card.brand,
          last4: pm.card.last4,
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[update-payment-method] could not fetch card for email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[update-payment-method] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
