"use client";

import { useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export function CheckoutClient({ amount }: { amount: number }) {
  const fetchClientSecret = useCallback(async () => {
    const r = await fetch("/api/v/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountDollars: amount }),
    });
    const j = await r.json();
    return (j.clientSecret as string) || "";
  }, [amount]);

  return (
    <div style={{ borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
