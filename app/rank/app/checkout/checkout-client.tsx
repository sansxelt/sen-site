"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

// Shows the live (rounded) plan price + which billing cycle the user picked, so
// the order is unambiguous before they pay. Same source + rounding as /pricing;
// the exact charge is confirmed in the Stripe panel.
export function PlanPrice({ plan, cycle }: { plan: string; cycle: "monthly" | "yearly" }) {
  const [amt, setAmt] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/v/plans").then((r) => r.json()).then((j) => {
      const cell = j.plans?.[plan]?.[cycle];
      if (cell?.available && cell.amount != null) setAmt(Math.round(cell.amount));
    }).catch(() => {});
  }, [plan, cycle]);
  const per = cycle === "yearly" ? "/yr" : "/mo";
  const label = cycle === "yearly" ? "Billed yearly · one charge every 12 months" : "Billed monthly · renews each month";
  return (
    <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>
        {amt != null ? `$${amt.toLocaleString()}` : "—"}<span style={{ fontSize: 15, color: "var(--fg-4)", fontWeight: 500 }}>{per}</span>
      </span>
      <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{cycle === "yearly" ? "Yearly" : "Monthly"}</span>
      <span style={{ fontSize: 12.5, color: "var(--fg-4)", width: "100%" }}>{label}</span>
    </div>
  );
}

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
    // No overflow:hidden / fixed height here — Stripe sets the iframe height
    // dynamically, and clipping it cuts off the bottom of the checkout.
    <div className="checkout-pay" style={{ minHeight: 200 }}>
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
