import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PLAN_CATALOG } from "@/lib/v-plans";
import { TOPUP_MIN_DOLLARS, topupMaxDollars } from "@/lib/v-entitlements";
import { passPricingEnabled, PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { CheckoutClient, PlanPrice } from "./checkout-client";
import { OwnPaymentPanel } from "./checkout-own";
import { customCheckoutEnabled } from "@/lib/custom-checkout";
import { billingReturnUrls, stripeReturnUrl, topupReturnUrl } from "@/lib/return-urls";
import { PlanPriceV1, V1RenewalTerms, v1Blurb, v1Included } from "./checkout-v1";

export const metadata: Metadata = { title: "Checkout" };

// Value-first "what's included" per plan: the credits that fund Production Passes + what each pass returns.
const PLAN_VALUE: Record<string, string[]> = {
  starter: [
    "150 credits every month",
    "Verifications with a decision and the evidence behind it",
    "Screenshots and repro steps on every failure",
    "Reruns that verify your repairs",
    "Shareable verification reports",
    "Cancel anytime, no lock-in",
  ],
  creator: [
    "500 credits every month",
    "Full verification reports: decision, failures, evidence",
    "Issue history across runs",
    "Shareable reports + JSON / CSV exports",
    "Reruns that verify your repairs",
    "Cancel anytime, no lock-in",
  ],
  pro: [
    "2,000 credits every month",
    "Client-ready verification reports",
    "Exports + webhooks to automate your workflow",
    "API run triggers (early access)",
    "Priority routing",
    "Cancel anytime, no lock-in",
  ],
  scale: [
    "7,500 credits every month",
    "Many systems, one workspace",
    "Webhooks + developer usage analytics",
    "Schema-versioned JSON / CSV exports",
    "Priority support",
    "Cancel anytime, no lock-in",
  ],
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ amount?: string; plan?: string; cycle?: string; save?: string }> }) {
  const sp = await searchParams;
  // _v1 plan keys (pricing cutover step 11) are recognized ONLY behind VRAELIS_PASS_PRICING — with the
  // flag off they stay unknown and take today's redirect-to-/credits path. Legacy plans and top-ups are
  // untouched either way.
  const v1Plan = passPricingEnabled() && sp.plan ? PLAN_CATALOG_V1.find((p) => p.key === sp.plan) ?? null : null;
  const planKey = v1Plan ? v1Plan.key : (sp.plan && PLAN_CATALOG.some((p) => p.plan === sp.plan) ? sp.plan : "");
  const cycle: "monthly" | "yearly" = sp.cycle === "yearly" ? "yearly" : "monthly";
  if (!planKey && !sp.amount) redirect("/credits");
  const amount = Math.max(TOPUP_MIN_DOLLARS, Math.min(topupMaxDollars(), parseInt(sp.amount || "0", 10) || 0));

  const ownCheckout = customCheckoutEnabled();
  const session = await auth();
  if (!session?.user?.email) {
    const back = planKey ? `/checkout?plan=${planKey}&cycle=${cycle}` : `/checkout?amount=${amount}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const plan = v1Plan ? undefined : PLAN_CATALOG.find((p) => p.plan === planKey);
  // The heading says the price, not only what the price buys. A page headed "50 credits" with the amount
  // hidden inside the pay button asks the customer to reconcile two numbers on the screen where they are
  // about to be charged, which is the one screen that should never require arithmetic.
  const title = v1Plan ? `${v1Plan.name} plan` : plan ? `${plan.name} plan` : `${(amount * 10).toLocaleString()} credits for $${amount.toLocaleString()}`;
  const backHref = plan || v1Plan ? "/plans" : "/credits";
  const included: string[] = v1Plan
    ? v1Included(v1Plan, cycle)
    : plan
    ? PLAN_VALUE[plan.plan] ?? [`${plan.monthlyCredits.toLocaleString()} credits every month`, "Credits refresh each billing cycle", "Cancel anytime, no lock-in"]
    // NOT "during early access", and not "as per-verification pricing rolls out". Per-verification pricing
    // is what production charges today: every launch path calls passPriceCents with no options, and nothing
    // anywhere asks for the early-access base. Describing the live model as forthcoming told a customer at
    // the moment of payment that the thing they were paying into had not started yet.
    : ["Your balance funds verifications", "Nothing ran, nothing charged: unused holds refund automatically", "Balance keeps its full purchase value"];

  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(20px, 3vw, 40px)", paddingBottom: "clamp(56px, 7vw, 96px)" }}>
      <style>{`
.vra-back{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 16px;margin-bottom:22px;
  border:1px solid var(--line-2);border-radius:99px;background:var(--bg-1);color:var(--fg-2);
  font-size:13.5px;font-weight:500;text-decoration:none;width:fit-content;
  transition:border-color 140ms ease,color 140ms ease,background 140ms ease}
.vra-back:hover{border-color:var(--line-3);color:var(--fg-1);background:var(--bg-2)}
.vra-back:focus-visible{outline:2px solid var(--fg-1);outline-offset:2px}
      `}</style>
      <div className="wrap" style={{ maxWidth: 960 }}>
        {/* A PILL, NOT A WHISPER. This was 13.5px of --fg-3 with no shape: on a payment screen, the one
            control that is not "give us money" was the faintest thing on the page, and it sat directly
            above a heading many times its size. A bordered pill gives it an edge to aim at and a real
            touch target, and it stays a quiet outline rather than a filled button, because the primary
            action here is the payment and there must be no doubt which is which. */}
        <a href={backHref} className="vra-back">
          <span aria-hidden>←</span> Back
        </a>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1.18fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
          {/* order summary */}
          <div>
            <p className="eyebrow">Checkout</p>
            <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)" }}>{title}</h1>
            {plan ? <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{plan.blurb} Independently verify the outcome your system has to deliver, and get a decision with the exact failures to fix, with evidence you can act on, share, and export.</p> : null}
            {v1Plan ? <p style={{ fontSize: 14.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0, lineHeight: 1.5 }}>{v1Blurb(v1Plan)} Independently verify the outcome your system has to deliver, and get a decision with the exact failures to fix, with evidence you can act on and share.</p> : null}
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
            {/* IN-APP PAYMENT, BEHIND A FLAG, FOR SUBSCRIPTION PLANS ONLY.
                With VRAELIS_CUSTOM_CHECKOUT on, a _v1 plan renders a Payment Element on this page instead
                of Stripe's embedded Checkout, so the purchase never leaves the product. Everything else,
                legacy plans and credit top-ups, keeps the Checkout path: those flows are known-good and
                there is no reason to move all of them at once.

                The flag is read HERE, on the server, and the panel is simply not rendered when it is off.
                A client-side check would let the page and the endpoint disagree about whether the surface
                exists. Off, this file behaves exactly as it did. */}
            {ownCheckout && v1Plan ? (
              <OwnPaymentPanel
                purchase={{ kind: "plan", plan: v1Plan.key, cycle }}
                returnUrl={stripeReturnUrl(billingReturnUrls().success)}
              />
            ) : ownCheckout && !planKey ? (
              // The redirect proves nothing; the page waits for the ledger. It is handed the credits it
              // should expect so it can wait for THAT number rather than poll blindly.
              <OwnPaymentPanel
                purchase={{ kind: "credits", amountDollars: amount, saveCard: sp.save === "1" }}
                returnUrl={stripeReturnUrl(topupReturnUrl(amount * 10))}
              />
            ) : planKey ? <CheckoutClient plan={planKey} cycle={cycle} paypal={!v1Plan} /> : <CheckoutClient amount={amount} />}
          </div>
        </div>
      </div>
    </section>
  );
}
