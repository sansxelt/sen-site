"use client";

import { useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export function CheckoutClient({ amount, plan, cycle }: { amount?: number; plan?: string; cycle?: string }) {
  const fetchClientSecret = useCallback(async () => {
    const url = plan ? "/api/v/subscribe" : "/api/v/checkout";
    const payload = plan ? { plan, cycle } : { amountDollars: amount };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    return (j.clientSecret as string) || "";
  }, [amount, plan, cycle]);

  return (
    <div style={{ borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
