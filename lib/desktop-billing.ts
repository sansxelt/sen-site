import type Stripe from "stripe";

export function extractBillingErrorMessage(err: unknown): string {
  if (!err) return "Unknown error.";
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.raw === "object" && obj.raw !== null) {
      const raw = obj.raw as Record<string, unknown>;
      if (typeof raw.message === "string") return raw.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return "Unknown error.";
    }
  }
  return String(err);
}

export function extractClientSecret(subscription: Stripe.Subscription): string | null {
  const invoice = subscription.latest_invoice as Stripe.Invoice | string | null;
  if (!invoice || typeof invoice === "string") return null;
  const raw = invoice as {
    confirmation_secret?: { client_secret?: string } | null;
    payment_intent?: { client_secret?: string } | string | null;
  };
  if (raw.confirmation_secret?.client_secret) return raw.confirmation_secret.client_secret;
  if (
    raw.payment_intent &&
    typeof raw.payment_intent === "object" &&
    raw.payment_intent.client_secret
  ) {
    return raw.payment_intent.client_secret;
  }
  return null;
}

export function buildBillingPaymentSettings(): Stripe.SubscriptionCreateParams.PaymentSettings {
  return {
    save_default_payment_method: "on_subscription",
    payment_method_types: ["card", "link", "cashapp"],
  };
}
