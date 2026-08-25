import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { getSubscription, listRecentLedger } from "@/lib/v-db";
import { balance } from "@/lib/v-credits";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { passPricingEnabled, planV1 } from "@/lib/preflight/pass-pricing";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { liveV1Subscription, listCustomerInvoices } from "@/lib/v-billing";
import { resolveWorkspaceSelection, ownedWorkspaceForBilling, isBillingAdminMember } from "@/lib/v-workspace";
import { teamSeatState } from "@/lib/v-team-billing";
import { BillingActions, PaymentMethodButton } from "./billing-actions";
import { TeamBillingPanel } from "./team-billing-panel";
import { TechnicalDetails } from "./technical-details";
import { I, Ic, EmptyIcon } from "@/app/rank/_components/icons";

export const metadata: Metadata = { title: "Billing" };

const REASON: Record<string, string> = { signup: "Welcome credits", monthly_reset: "Monthly plan credits", topup: "Credit top-up", pack: "Credit pack", hold: "Verification launch", refund: "Unfilled refund", reward: "Participation reward" };

const INVOICE_STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: "Paid", color: "var(--acc-deep)" },
  open: { label: "Open", color: "var(--money)" },
  void: { label: "Void", color: "var(--fg-4)" },
  uncollectible: { label: "Uncollectible", color: "var(--err)" },
};

function fmtUsd(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function BillingPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect(`/signin?callbackUrl=${encodeURIComponent("/billing")}`);

  const [sub, bal, ledger] = await Promise.all([getSubscription(email), balance(email), listRecentLedger(email, 12)]);

  // _v1 plan state (pricing cutover): stored plan from v_profiles, live renewal/cancellation from the
  // Stripe subscription resolved server-side by locked metadata (lib/v-billing.ts). Reads degrade to
  // null so the page always renders.
  const v1State = passPricingEnabled() ? await getPlanV1State(email.toLowerCase()) : null;
  const v1Plan = v1State ? planV1(v1State.plan) : null;
  const [liveV1, invoices] = await Promise.all([
    v1Plan ? liveV1Subscription(email, v1Plan.key) : Promise.resolve(null),
    listCustomerInvoices(email, 12),
  ]);

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
  const planName = v1Plan ? v1Plan.name : plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);

  // Live Stripe state for accurate cancel/renewal (no off-site redirect needed). _v1 plans come from
  // liveV1Subscription; legacy plans from the stored subscription id.
  let cancelAtEnd = false;
  let periodEnd: string | null = sub?.current_period_end ?? null;
  let liveStatus: string = sub?.status ?? "free";
  if (v1Plan) {
    cancelAtEnd = Boolean(liveV1?.cancelAtPeriodEnd);
    periodEnd = liveV1?.currentPeriodEndIso ?? null;
    liveStatus = liveV1?.status ?? "active";
  } else if (sub?.stripe_subscription_id && isStripeConfigured()) {
    try {
      const s = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id);
      cancelAtEnd = !!(s as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end;
      const pe = (s as unknown as { current_period_end?: number }).current_period_end;
      if (pe) periodEnd = new Date(pe * 1000).toISOString();
      liveStatus = s.status;
    } catch { /* fall back to stored state */ }
  }
  const periodLabel = periodEnd ? new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const hasSub = v1Plan ? true : !!sub?.stripe_subscription_id && plan !== "free";
  const displayCycle = v1Plan ? liveV1?.cycle ?? v1State?.cycle ?? null : plan !== "free" ? sub?.cycle ?? null : null;
  const pastDue = liveStatus === "past_due";

  const statusLine = !hasSub ? "You're on the Free plan."
    : cancelAtEnd ? `Cancels on ${periodLabel ?? "period end"}. Active until then.`
    : pastDue ? "Payment past due. Update your card to keep your plan."
    : periodLabel ? `Renews ${periodLabel}.` : "Active.";

  return (
    <div className="wrap" style={{ maxWidth: 820, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="display">Billing</h1>
          <p>{email}</p>
        </div>
        <Link href="/plans" className="btn btn--ghost">Change plan</Link>
      </div>

      {/* Failed-payment banner: shown whenever the subscription is in Stripe dunning. */}
      {pastDue && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--err)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ color: "var(--err)" }}><Ic d={I.alert} size={17} /></span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Your last payment failed</span>
          </div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 12px", lineHeight: 1.6, maxWidth: 620 }}>
            Stripe retries the charge automatically over the next few days, and your access continues during
            the retry window. To fix it now, update your payment method below; the retry then usually
            succeeds within a day. <Link href="/billing/payment-failed" style={{ color: "var(--acc-deep)" }}>What usually causes this</Link>
          </p>
          <PaymentMethodButton />
        </div>
      )}

      <div className="tile-grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Plan</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{planName}</span>
            {displayCycle ? <span className="badge-now">{displayCycle}</span> : null}
          </div>
          <p style={{ fontSize: 13.5, color: cancelAtEnd ? "var(--money)" : pastDue ? "var(--err)" : "var(--fg-3)", marginTop: 4, marginBottom: 0 }}>{statusLine}</p>
          {v1Plan ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>
              Includes {v1Plan.passesPerMonth} verifications a month, up to {v1Plan.flowsPerPass} flows verified per run{v1Plan.maxApplications === null ? "" : `, ${v1Plan.maxApplications} connected systems`}.
            </p>
          ) : null}
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Credit balance</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--fg-1)" }}>{bal.toLocaleString()}<span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>credits</span></div>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 4 }}><Link href="/credits" style={{ color: "var(--acc-deep)" }}>Top up →</Link></p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Payment method</div>
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 14px", maxWidth: 540 }}>Keep a payment method on file for plan renewals and credit top-ups, and view your invoices. Payments are securely processed by Stripe, we never see your card details, and your complete billing state stays here in Vraelis.</p>
        <PaymentMethodButton />
      </div>

      <div className="card" style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Subscription</div>
        {/* Builder/Pro/Scale (v1Plan) has no row in v_subscriptions, so /api/v/cancel 404s "no_subscription"
            for it — hasSub stayed true here only for the status line above. The button is scoped to the
            legacy path it actually works against; v1 cancels through the portal via Change plan instead. */}
        <BillingActions canceling={cancelAtEnd} hasSub={hasSub && !v1Plan} />
        <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 16, marginBottom: 0, lineHeight: 1.6 }}>
          {v1Plan
            ? "Cancelling or resuming a Builder, Pro or Scale plan opens the secure billing portal — use Change plan above."
            : "Plan changes, cancellations, and resumptions happen here in Vraelis."}
        </p>
      </div>

      {/* Native payment history: Stripe invoices rendered in-app; the hosted invoice page is only the
          line-item detail fallback. */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Payment history</div>
      {invoices.length === 0 ? (
        <div className="empty" style={{ marginBottom: 28 }}><EmptyIcon d={I.card} /><h3>No payments yet</h3><p>Plan invoices and their receipts will appear here after your first charge.</p></div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", boxShadow: "var(--shadow-sm)", marginBottom: 28 }}>
          {invoices.map((inv, i) => {
            const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, color: "var(--fg-4)" };
            return (
              <div key={inv.id || i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 500 }}>{fmtUsd(inv.amountCents, inv.currency)}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 2 }}>
                    {new Date(inv.createdIso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{inv.number ? ` | ${inv.number}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontFamily: "var(--font-code)", fontSize: 11.5, fontWeight: 600, color: st.color }}>{st.label}</span>
                  {inv.hostedInvoiceUrl ? (
                    <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none", whiteSpace: "nowrap" }}>View invoice →</a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
        <div className="empty"><EmptyIcon d={I.clock} /><h3>No activity yet</h3><p>Credit grants, holds, refunds and rewards will show up here once you start testing.</p></div>
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

      {/* Raw provider identifiers live ONLY inside this collapsed disclosure. */}
      <TechnicalDetails items={[
        ["Plan key", v1State?.plan ?? (plan !== "free" ? plan : "")],
        ["Stripe subscription", liveV1?.subscriptionId ?? sub?.stripe_subscription_id ?? ""],
        ["Stripe customer", liveV1?.customerId ?? ""],
      ]} />
    </div>
  );
}
