// Canonical Stripe-portal return route (V1.1 S1): app.vraelis.com/billing/portal-return.
// Re-fetches subscription state fresh (stored plan + live Stripe status) so whatever the user just did
// in the portal (cancel, resume, card change) is reflected natively, with no raw provider IDs.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSubscription } from "@/lib/v-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { passPricingEnabled, planV1 } from "@/lib/preflight/pass-pricing";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { liveV1Subscription } from "@/lib/v-billing";
import { I, Ic } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Back from the billing portal" };

function fmtDate(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
}

export default async function PortalReturnPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent("/billing/portal-return")}`);

  // Fresh reads on every visit: the portal may have just changed everything below.
  const v1State = passPricingEnabled() ? await getPlanV1State(email.toLowerCase()) : null;
  const v1Plan = v1State ? planV1(v1State.plan) : null;
  const live = v1Plan ? await liveV1Subscription(email, v1Plan.key) : null;

  // Legacy subscription fallback for accounts without a _v1 plan.
  let planName = "Free";
  let cycle: string | null = null;
  let statusLine = "You're on the Free plan.";
  if (v1Plan) {
    planName = v1Plan.name;
    cycle = live?.cycle ?? v1State?.cycle ?? null;
    const renews = fmtDate(live?.currentPeriodEndIso ?? null);
    statusLine = live?.cancelAtPeriodEnd
      ? `Cancellation is scheduled. Your plan stays active until ${renews ?? "the end of the paid period"}.`
      : live?.status === "past_due"
      ? "Payment is past due. Update your card to keep your plan."
      : renews ? `Active. Renews ${renews}.` : "Active.";
  } else {
    const sub = await getSubscription(email);
    if (sub && (sub.status === "active" || sub.status === "past_due") && sub.plan !== "free") {
      planName = sub.plan.charAt(0).toUpperCase() + sub.plan.slice(1);
      cycle = sub.cycle ?? null;
      let cancelAtEnd = false;
      let periodEnd: string | null = sub.current_period_end ?? null;
      if (sub.stripe_subscription_id && isStripeConfigured()) {
        try {
          const s = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id);
          cancelAtEnd = Boolean((s as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end);
          const pe = (s as unknown as { current_period_end?: number }).current_period_end;
          if (pe) periodEnd = new Date(pe * 1000).toISOString();
        } catch { /* stored state stands */ }
      }
      const when = fmtDate(periodEnd);
      statusLine = cancelAtEnd
        ? `Cancellation is scheduled. Your plan stays active until ${when ?? "the end of the paid period"}.`
        : sub.status === "past_due"
        ? "Payment is past due. Update your card to keep your plan."
        : when ? `Active. Renews ${when}.` : "Active.";
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Billing</p>
          <h1 className="display">You&apos;re back in Vraelis</h1>
          <p>{email}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Current plan</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{planName}</span>
          {cycle ? <span className="badge-now">{cycle}</span> : null}
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0 }}>{statusLine}</p>
      </div>

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ color: "var(--acc-deep)" }}><Ic d={I.card} size={17} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Changes from the portal</span>
        </div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 16px", lineHeight: 1.6, maxWidth: 560 }}>
          Card updates, cancellations, and resumptions made in the Stripe portal are confirmed back to us
          within a few seconds. If something you just changed is not reflected above yet, refresh this page
          or check the billing page in a moment.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/billing" className="btn">Go to billing</Link>
          <Link href="/plans" className="btn btn--ghost">Change plan</Link>
        </div>
      </div>
    </div>
  );
}
