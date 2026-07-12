import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PLAN_CATALOG } from "@/lib/v-plans";
import { TOPUP_MIN_DOLLARS, topupMaxDollars } from "@/lib/v-entitlements";
import { passPricingEnabled, PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { CheckoutClient, PlanPrice } from "./checkout-client";
import { PlanPriceV1, V1RenewalTerms, v1Blurb, v1Included } from "./checkout-v1";

export const metadata: Metadata = { title: "Checkout" };

// Value-first "what's included" per plan: the credits that fund Production Passes + what each pass returns.
const PLAN_VALUE: Record<string, string[]> = {
  starter: [
    "150 credits every month",
    "Production Passes with a launch decision",
    "Screenshots and repro steps on every blocker",
    "Reruns that verify your repairs",
    "Shareable pass reports",
    "Cancel anytime, no lock-in",
  ],
  creator: [
    "500 credits every month",
    "Full pass reports: decision, blockers, evidence",
    "Issue history across runs",
    "Shareable reports + JSON / CSV exports",
    "Reruns that verify your repairs",
    "Cancel anytime, no lock-in",
  ],
  pro: [
    "2,000 credits every month",
    "Client-ready pass reports",
    "Exports + webhooks to automate your workflow",
    "API run triggers (early access)",
    "Priority routing",
    "Cancel anytime, no lock-in",
  ],
  scale: [
    "7,500 credits every month",
    "Many applications, one workspace",
    "Webhooks + developer usage analytics",
    "Schema-versioned JSON / CSV exports",
    "Priority support",
    "Cancel anytime, no lock-in",
  ],
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ amount?: string; plan?: string; cycle?: string }> }) {
  const sp = await searchParams;
  // _v1 plan keys (pricing cutover step 11) are recognized ONLY behind VRAELIS_PASS_PRICING — with the
  // flag off they stay unknown and take today's redirect-to-/credits path. Legacy plans and top-ups are
  // untouched either way.
  const v1Plan = passPricingEnabled() && sp.plan ? PLAN_CATALOG_V1.find((p) => p.key === sp.plan) ?? null : null;
  const planKey = v1Plan ? v1Plan.key : (sp.plan && PLAN_CATALOG.some((p) => p.plan === sp.plan) ? sp.plan : "");
  const cycle: "monthly" | "yearly" = sp.cycle === "yearly" ? "yearly" : "monthly";
  if (!planKey && !sp.amount) redirect("/credits");
  const amount = Math.max(TOPUP_MIN_DOLLARS, Math.min(topupMaxDollars(), parseInt(sp.amount || "0", 10) || 0));

  const session = await auth();
  if (!session?.user?.email) {
    const back = planKey ? `/checkout?plan=${planKey}&cycle=${cycle}` : `/checkout?amount=${amount}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const plan = v1Plan ? undefined : PLAN_CATALOG.find((p) => p.plan === planKey);
  const title = v1Plan ? `${v1Plan.name} plan` : plan ? `${plan.name} plan` : `${(amount * 10).toLocaleString()} credits`;
  const backHref = plan || v1Plan ? "/plans" : "/credits";
  const included: string[] = v1Plan
    ? v1Included(v1Plan, cycle)
    : plan
    ? PLAN_VALUE[plan.plan] ?? [`${plan.monthlyCredits.toLocaleString()} credits every month`, "Credits refresh each billing cycle", "Cancel anytime, no lock-in"]
    : ["Your balance funds Production Passes during early access", "Nothing ran, nothing charged: unused holds refund automatically", "Balance keeps its full purchase value as per-pass pricing rolls out"];

  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(20px, 3vw, 40px)", paddingBottom: "clamp(56px, 7vw, 96px)" }}>
      <div className="wrap" style={{ maxWidth: 960 }}>
        <a href={backHref} style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 22 }}>← Back</a>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1.18fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
          {/* order summary */}
          <div>
            <p className="eyebrow">Checkout</p>
            <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)" }}>{title}</h1>
            {plan ? <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{plan.blurb} Run your AI-built app like production and get a launch decision with the exact blockers to fix, with evidence you can act on, share, and export.</p> : null}
            {v1Plan ? <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{v1Blurb(v1Plan)} Run your AI-built app like production and get a launch decision with the exact blockers to fix, with evidence you can act on and share.</p> : null}
            {plan ? <PlanPrice plan={plan.plan} cycle={cycle} /> : null}
            {v1Plan ? <PlanPriceV1 plan={v1Plan} cycle={cycle} /> : null}

            <div className="card" style={{ marginTop: 22, padding: 20 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>{plan || v1Plan ? "What's included" : "How your balance works"}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {included.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--fg-2)", alignItems: "flex-start", lineHeight: 1.4 }}>
                    <span style={{ width: 17, height: 17, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 10 }}>✓</span>{x}
                  </li>
                ))}
              </ul>
            </div>

            {/* Native review screen (V1.1 S1): renewal + cancellation behavior in plain words BEFORE payment. */}
            {v1Plan ? <V1RenewalTerms plan={v1Plan} cycle={cycle} /> : null}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12.5, color: "var(--fg-4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Secure checkout, powered by Stripe
            </div>
          </div>

          {/* payment */}
          <div className="card" style={{ padding: "clamp(16px, 2vw, 22px)" }}>
            {/* PayPal is suppressed for _v1 plans: only the six Stripe prices exist for them (PayPal
                _v1 plans are not provisioned), so the button would always fail. */}
            {planKey ? <CheckoutClient plan={planKey} cycle={cycle} paypal={!v1Plan} /> : <CheckoutClient amount={amount} />}
          </div>
        </div>
      </div>
    </section>
  );
}
