"use client";

import { useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

// loadStripe is called once at module scope (recommended). The publishable key
// is a NEXT_PUBLIC_ var so it's available client-side.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export function CheckoutClient({ plan, cycle }: { plan: string; cycle: string }) {
  // EmbeddedCheckoutProvider calls this to create the session and get its
  // client_secret — the embedded form then renders on this page (no redirect).
  const fetchClientSecret = useCallback(async () => {
    const r = await fetch("/api/flip/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, cycle }),
    });
    const j = await r.json();
    return (j.clientSecret as string) || "";
  }, [plan, cycle]);

  return (
    <div style={{ borderRadius: "var(--r-sm)", overflow: "hidden" }}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
