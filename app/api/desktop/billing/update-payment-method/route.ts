import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { sendPaymentMethodUpdatedEmail } from "../../../../../lib/email";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getStripe,
} from "../../../../../lib/stripe";

export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
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
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email.toLowerCase());

    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
    } catch (err) {
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
        metadata: { ...subscription.metadata, surface: "desktop" },
      });
    }

    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (paymentMethod.card) {
        sendPaymentMethodUpdatedEmail({
          email,
          name: "",
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("[desktop update-payment-method] could not fetch card for email:", err);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[desktop update-payment-method] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
