"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");
const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";

// Minimal typing for the PayPal JS SDK button we render for credit top-ups.
type PaypalButtons = (config: {
  style?: Record<string, unknown>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError?: (err: unknown) => void;
}) => { render: (el: HTMLElement) => void };
// window.paypal is already globally typed (old integration); narrow it at the use site.
const paypalSdk = (): { Buttons: PaypalButtons } | null =>
  (window as unknown as { paypal?: { Buttons?: PaypalButtons } | null }).paypal?.Buttons
    ? ((window as unknown as { paypal: { Buttons: PaypalButtons } }).paypal)
    : null;

// PayPal option for CREDIT top-ups only (one-time). Hidden entirely unless
// NEXT_PUBLIC_PAYPAL_CLIENT_ID is set, so it's inert until PayPal is configured.
// create-order + capture-order grant credits through the same idempotent ledger as Stripe.
function PaypalCredits({ amount }: { amount: number }) {
  const box = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [phase, setPhase] = useState<"load" | "ready" | "paying" | "error">("load");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!PAYPAL_CLIENT_ID || rendered.current) return;
    let cancelled = false;

    const mount = () => {
      const pp = paypalSdk();
      if (cancelled || rendered.current || !pp || !box.current) return;
      rendered.current = true;
      setPhase("ready");
      pp.Buttons({
        style: { layout: "horizontal", color: "gold", shape: "rect", height: 46, tagline: false },
        createOrder: async () => {
          const r = await fetch("/api/v/paypal/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountDollars: amount }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || !j.orderId) throw new Error(j.error || "create_failed");
          return j.orderId as string;
        },
        onApprove: async (data) => {
          setPhase("paying"); setMsg("");
          const r = await fetch("/api/v/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderID }) });
          const j = await r.json().catch(() => ({}));
          if (r.ok && j.status === "credited") { window.location.href = "/app/credits?paypal=1"; return; }
          setPhase("error"); setMsg(j.message || "Payment went through but we couldn't add the credits. Email help@vraelis.com and we'll fix it fast.");
        },
        onError: () => { setPhase("error"); setMsg("PayPal ran into a problem. Try again, or pay by card below."); },
      }).render(box.current);
    };

    if (window.paypal) { mount(); return; }
    const existing = document.getElementById("paypal-sdk") as HTMLScriptElement | null;
    if (existing) { existing.addEventListener("load", mount); return () => existing.removeEventListener("load", mount); }
    const s = document.createElement("script");
    s.id = "paypal-sdk";
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL_CLIENT_ID)}&currency=USD&intent=capture&disable-funding=card,credit,paylater`;
    s.onload = mount;
    s.onerror = () => { if (!cancelled) { setPhase("error"); setMsg("Couldn't load PayPal. Pay by card below."); } };
    document.body.appendChild(s);
    return () => { cancelled = true; };
  }, [amount]);

  if (!PAYPAL_CLIENT_ID) return null;

  return (
    <div style={{ marginBottom: 4 }}>
      <div ref={box} style={{ minHeight: phase === "load" ? 0 : undefined }} />
      {phase === "load" && <div className="skel" style={{ height: 46 }} />}
      {phase === "paying" && <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 8, fontFamily: "var(--font-code)" }}>Confirming your PayPal payment…</p>}
      {msg && <p style={{ fontSize: 13, color: "var(--err)", marginTop: 8 }}>{msg}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 6px" }}>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>or pay by card / wallet</span>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
      </div>
    </div>
  );
}

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
  const label = cycle === "yearly" ? "Billed yearly | one charge every 12 months" : "Billed monthly | renews each month";
  return (
    <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>
        {amt != null ? `$${amt.toLocaleString()}` : "-"}<span style={{ fontSize: 15, color: "var(--fg-4)", fontWeight: 500 }}>{per}</span>
      </span>
      <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{cycle === "yearly" ? "Yearly" : "Monthly"}</span>
      <span style={{ fontSize: 12.5, color: "var(--fg-4)", width: "100%" }}>{label}</span>
    </div>
  );
}

// PayPal option for PLAN subscriptions. Redirect flow (not the SDK buttons): create the
// subscription server-side, then send the user to PayPal to approve. Hidden unless configured.
function PaypalSubscribe({ plan, cycle }: { plan: string; cycle: "monthly" | "yearly" }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!PAYPAL_CLIENT_ID) return null;

  async function go() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/v/paypal/create-subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, cycle }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.approveUrl) { window.location.href = j.approveUrl as string; return; }
      setMsg(j.error === "plan_unavailable" ? "PayPal isn't set up for this plan yet. Pay by card below." : "Couldn't start PayPal. Pay by card below.");
      setBusy(false);
    } catch { setMsg("Couldn't reach PayPal. Pay by card below."); setBusy(false); }
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <button type="button" onClick={go} disabled={busy} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#ffc439", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "13px 16px", fontSize: 15, fontWeight: 700, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Redirecting to PayPal…" : "Subscribe with PayPal"}
      </button>
      {msg && <p style={{ fontSize: 13, color: "var(--err)", marginTop: 8 }}>{msg}</p>}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "16px 0 6px" }}>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
        <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>or pay by card / wallet</span>
        <span style={{ flex: 1, height: 1, background: "var(--line-1)" }} />
      </div>
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
    // No overflow:hidden / fixed height here, Stripe sets the iframe height
    // dynamically, and clipping it cuts off the bottom of the checkout.
    <div className="checkout-pay" style={{ minHeight: 200 }}>
      {/* PayPal above Stripe; hidden unless configured. Credits = SDK buttons, plans = redirect. */}
      {!plan && typeof amount === "number" && amount > 0 ? <PaypalCredits amount={amount} /> : null}
      {plan ? <PaypalSubscribe plan={plan} cycle={cycle === "yearly" ? "yearly" : "monthly"} /> : null}
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
