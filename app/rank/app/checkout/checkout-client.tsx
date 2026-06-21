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
        j.error === "billing_unavailable" ? "Billing is temporarily unavailable. Try again later."
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
      <div className="card" style={{ borderColor: "var(--line-2)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Checkout couldn&apos;t start</div>
        <p style={{ color: "var(--fg-3)", fontSize: 14, margin: 0 }}>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn--ghost" style={{ marginTop: 14 }}>Try again</button>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", minHeight: 200 }}>
      {!ready && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="skel" style={{ height: 46 }} />
          <div className="skel" style={{ height: 46 }} />
          <div className="skel" style={{ height: 46, width: "72%" }} />
          <p style={{ color: "var(--fg-4)", fontSize: 12.5, marginTop: 2, fontFamily: "var(--font-code)" }}>Loading secure checkout…</p>
        </div>
      )}
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
