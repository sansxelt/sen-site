import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSubscription, listRecentLedger } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { resolveWorkspaceSelection, ownedWorkspaceForBilling, isBillingAdminMember } from "@/lib/v-workspace";
import { teamSeatState } from "@/lib/v-team-billing";
import { BillingActions, PaymentMethodButton } from "./billing-actions";
import { TeamBillingPanel } from "./team-billing-panel";

export const metadata: Metadata = { title: "Billing" };

const REASON: Record<string, string> = { signup: "Welcome credits", monthly_reset: "Monthly plan credits", topup: "Credit top-up", pack: "Credit pack", hold: "Test launch", refund: "Unfilled refund", reward: "Participation reward" };

export default async function BillingPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/signin?callbackUrl=%2Fapp%2Fbilling");

  const [sub, bal, ledger] = await Promise.all([getSubscription(email), balance(email), listRecentLedger(email, 12)]);

  // Team seats for the selected workspace. Owner -> full controls; billing admin -> view +
  // portal + invoices (no setup); regular member -> generic copy; client_viewer -> nothing.
  const { selected } = await resolveWorkspaceSelection(email, (await cookies()).get("vws")?.value);
  let teamBilling: Awaited<ReturnType<typeof teamSeatState>> | null = null;
  let teamWsName = "";
  let teamAccess: "owner" | "billing_admin" | "member" | "client" = "member";
  if (!selected || selected.isOwner) {
    const wsB = await ownedWorkspaceForBilling(email, selected?.id);
    if (wsB) { teamBilling = await teamSeatState(wsB.id); teamWsName = wsB.name; teamAccess = "owner"; }
  } else if (await isBillingAdminMember(selected.id, email)) {
    teamBilling = await teamSeatState(selected.id); teamWsName = selected.name; teamAccess = "billing_admin";
  } else if (selected.role === "client_viewer") {
    teamAccess = "client";
  }
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

  const statusLine = plan === "free" ? "You're on the Free plan."
    : cancelAtEnd ? `Cancels on ${periodLabel ?? "period end"}. Active until then.`
    : liveStatus === "past_due" ? "Payment past due. Update your card to keep your plan."
    : periodLabel ? `Renews ${periodLabel}.` : "Active.";

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display">Billing</h1>
          <p>{email}</p>
        </div>
        <Link href="/app/plans" className="btn btn--ghost">Change plan</Link>
      </div>

      <div className="tile-grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Plan</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{planName}</span>
            {plan !== "free" && sub?.cycle ? <span className="badge-now">{sub.cycle}</span> : null}
          </div>
          <p style={{ fontSize: 13.5, color: cancelAtEnd ? "var(--money)" : liveStatus === "past_due" ? "var(--err)" : "var(--fg-3)", marginTop: 4 }}>{statusLine}</p>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Credit balance</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{bal.toLocaleString()}<span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>credits</span></div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 4 }}><Link href="/app/credits" style={{ color: "var(--acc-deep)" }}>Top up →</Link></p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Payment method</div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 14px", maxWidth: 540 }}>Keep a payment method on file for plan renewals and credit top-ups, and view your invoices. Payments are securely processed by Stripe, we never see your card details, and your complete billing state stays here in Vraelis.</p>
        <PaymentMethodButton />
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Subscription</div>
        <BillingActions canceling={cancelAtEnd} hasSub={hasSub} />
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>Plan changes, cancellations, and resumptions happen here in Vraelis.</p>
      </div>

      {/* Team seats (workspace billing, owner / billing-admin detail) */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Team seats</div>
      {(teamAccess === "owner" || teamAccess === "billing_admin") && teamBilling ? (
        <div style={{ marginBottom: 28 }}><TeamBillingPanel workspaceName={teamWsName} billing={teamBilling} canManage={teamAccess === "owner"} /></div>
      ) : teamAccess === "member" ? (
        <div className="card" style={{ marginBottom: 28, background: "var(--bg-2)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{selected?.name ?? "Workspace"}</div>
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Team billing is managed by the workspace owner or billing admin. Client viewers are always free.</p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 28, background: "var(--bg-2)" }}>
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0 }}>Team billing is managed by the workspace owner.</p>
        </div>
      )}

      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Recent credit activity</div>
      {ledger.length === 0 ? (
        <div className="empty"><div className="empty__icon">◷</div><h3>No activity yet</h3><p>Credit grants, holds, refunds and rewards will show up here once you start testing.</p></div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)" }}>
          {ledger.map((l, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <div><div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{REASON[l.reason] ?? l.reason}</div><div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 2 }}>{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div></div>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 14.5, fontWeight: 600, color: l.delta >= 0 ? "var(--acc-deep)" : "var(--fg-3)" }}>{l.delta >= 0 ? "+" : ""}{l.delta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
