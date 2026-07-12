// Canonical payment-failed return route (V1.1 S1): app.vraelis.com/billing/payment-failed.
// Used by dunning links and failed-checkout recoveries. Says exactly what happened, what was NOT
// changed, and gives the two real fixes: retry the checkout, or fix the card on file.

import type { Metadata } from "next";
import Link from "next/link";
import { I, Ic } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Payment failed" };

const GUIDANCE: [string, string][] = [
  ["Card declined", "The most common cause. Your bank blocked the charge, often for online or recurring payments. A quick call to the number on the back of the card usually clears it."],
  ["Card details or expiry", "Check the number, expiry date, and security code. An expired or reissued card fails silently on renewals."],
  ["Spending limit", "Corporate and prepaid cards can sit below the plan amount. Try a different card, or ask your admin to raise the limit."],
];

export default function PaymentFailedPage() {
  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Billing</p>
          <h1 className="display">Payment failed</h1>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ color: "var(--err)" }}><Ic d={I.alert} size={18} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>What happened</span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 580 }}>
          A payment did not go through. Nothing new was activated by the failed attempt, and if this was a
          renewal your plan is not cancelled: Stripe retries automatically over the next days, and your
          access continues through the period you have already paid for.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/plans" className="btn">Retry checkout</Link>
          <Link href="/billing" className="btn btn--ghost">Update payment method</Link>
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Common causes</div>
      <div className="tile-grid cols-3" style={{ marginBottom: 18 }}>
        {GUIDANCE.map(([t, d]) => (
          <div key={t} className="acard" style={{ gap: 6 }}>
            <div className="acard__t" style={{ fontSize: 14.5 }}>{t}</div>
            <div className="acard__d">{d}</div>
          </div>
        ))}
      </div>

      <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", margin: 0, lineHeight: 1.6 }}>
        Charged anyway, or stuck in a retry loop? Email{" "}
        <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a> with the
        approximate time of the attempt and we will sort it out.
      </p>
    </div>
  );
}
