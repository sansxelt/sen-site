// Canonical checkout-cancelled return route (V1.1 S1): app.vraelis.com/billing/cancelled.
// Static, honest, and calm: nothing was charged, nothing changed, and both paths forward are one click.

import type { Metadata } from "next";
import Link from "next/link";
import { I, Ic } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Checkout cancelled" };

export default function BillingCancelledPage() {
  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Billing</p>
          <h1 className="display">Checkout cancelled</h1>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ color: "var(--fg-3)" }}><Ic d={I.slash} size={18} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>Nothing was charged</span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 560 }}>
          You left checkout before completing the payment. No charge was made, no plan was started, and
          nothing changed on your account. When you are ready, you can pick up exactly where you left off.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/plans" className="btn">Back to plans</Link>
          <Link href="/billing" className="btn btn--ghost">View billing</Link>
        </div>
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
          Stopped because something was unclear about pricing or terms? Email{" "}
          <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a> and we will give you a straight answer.
        </p>
      </div>
    </div>
  );
}
