"use client";

import { useCallback, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export function CheckoutClient({ amount, plan, cycle }: { amount?: number; plan?: string; cycle?: string }) {
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const fetchClientSecret = useCallback(async () => {
    const url = plan ? "/api/v/subscribe" : "/api/v/checkout";
    const payload = plan ? { plan, cycle } : { amountDollars: amount };
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.clientSecret) {
      setError(
        j.error === "billing_unavailable" ? "Billing is temporarily unavailable — please try again later."
        : j.error === "plan_unavailable" ? "This plan isn't available right now. Try another, or contact us."
        : j.error === "signin_required" ? "Please sign in to continue."
        : "Couldn't start checkout. Please try again.",
      );
      throw new Error(j.error || "checkout_failed");
    }
    setReady(true);
    return j.clientSecret as string;
  }, [amount, plan, cycle]);

  if (error) {
    return (
      <div className="card">
        <p style={{ color: "var(--fg-2)", fontSize: 14, margin: 0 }}>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn--ghost" style={{ marginTop: 14 }}>Try again</button>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: "var(--r-sm)", overflow: "hidden", minHeight: 180 }}>
      {!ready && <p style={{ color: "var(--fg-4)", fontSize: 14, padding: "20px 2px" }}>Loading secure checkout…</p>}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
