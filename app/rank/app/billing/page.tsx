import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSubscription, listRecentLedger } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { BillingActions } from "./billing-actions";

export const metadata: Metadata = { title: "Billing — Vraelis" };

const REASON: Record<string, string> = { signup: "Welcome credits", monthly_reset: "Monthly plan credits", topup: "Credit top-up", pack: "Credit pack", hold: "Test launch", refund: "Unfilled refund", reward: "Vote reward" };

export default async function BillingPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fbilling");

  const [sub, bal, ledger] = await Promise.all([getSubscription(email), balance(email), listRecentLedger(email, 12)]);
  const plan = sub && sub.status === "active" ? sub.plan : "free";
  const planName = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);

  // Live Stripe state for accurate cancel/renewal (no off-site redirect needed).
  let cancelAtEnd = false;
  let periodEnd: string | null = sub?.current_period_end ?? null;
  let liveStatus: string = sub?.status ?? "free";
  if (sub?.stripe_subscription_id && isStripeConfigured()) {
    try {
      const s = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id);
      cancelAtEnd = !!(s as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end;
      const pe = (s as unknown as { current_period_end?: number }).current_period_end;
      if (pe) periodEnd = new Date(pe * 1000).toISOString();
      liveStatus = s.status;
    } catch { /* fall back to stored state */ }
  }
  const periodLabel = periodEnd ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const hasSub = !!sub?.stripe_subscription_id && plan !== "free";

  const statusLine = plan === "free" ? "You're on the Free plan — no subscription."
    : cancelAtEnd ? `Cancels on ${periodLabel ?? "period end"} — active until then.`
    : liveStatus === "past_due" ? "Payment past due — update your card to keep your plan."
    : periodLabel ? `Renews ${periodLabel}.` : "Active.";

  return (
    <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">Account</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 4 }}>Billing</h1>
      <p className="lead-copy" style={{ marginBottom: 24 }}>{email}</p>

      <div className="cols-2" style={{ gap: 14, marginBottom: 18 }}>
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Plan</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{planName}{plan !== "free" && sub?.cycle ? <span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>{sub.cycle}</span> : null}</div>
          <p style={{ fontSize: 13.5, color: cancelAtEnd ? "var(--money)" : "var(--fg-3)", marginTop: 6 }}>{statusLine}</p>
        </div>
        <div className="card">
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Credit balance</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{bal.toLocaleString()}<span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>credits</span></div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 6 }}><a href="/app/credits" style={{ color: "var(--acc-deep)" }}>Top up →</a></p>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}><BillingActions canceling={cancelAtEnd} hasSub={hasSub} /></div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Recent credit activity</div>
      {ledger.length === 0 ? <p style={{ color: "var(--fg-4)", fontSize: 14 }}>No activity yet.</p> : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: 12, overflow: "hidden", background: "var(--bg-1)" }}>
          {ledger.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <div><div style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{REASON[l.reason] ?? l.reason}</div><div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: l.delta >= 0 ? "var(--acc-deep)" : "var(--fg-3)" }}>{l.delta >= 0 ? "+" : ""}{l.delta}</div>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 16 }}>Plan changes, cancel and resume all happen here on Vraelis. Card details &amp; invoices are managed via Stripe&apos;s secure portal (PCI).</p>
    </div>
  );
}
