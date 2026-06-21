import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PLAN_CATALOG } from "@/lib/v-plans";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ amount?: string; plan?: string; cycle?: string }> }) {
  const sp = await searchParams;
  const planKey = sp.plan && PLAN_CATALOG.some((p) => p.plan === sp.plan) ? sp.plan : "";
  const cycle: "monthly" | "yearly" = sp.cycle === "yearly" ? "yearly" : "monthly";
  if (!planKey && !sp.amount) redirect("/app/credits");
  const amount = Math.max(5, Math.min(99999, parseInt(sp.amount || "0", 10) || 0));

  const session = await auth();
  if (!session?.user?.email) {
    const back = planKey ? `/app/checkout?plan=${planKey}&cycle=${cycle}` : `/app/checkout?amount=${amount}`;
    redirect(`/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const plan = PLAN_CATALOG.find((p) => p.plan === planKey);
  const title = plan ? `${plan.name} plan` : `${(amount * 10).toLocaleString()} credits`;
  const backHref = plan ? "/app/plans" : "/app/credits";
  const included: string[] = plan
    ? [`${plan.monthlyCredits.toLocaleString()} credits every month`, "Credits refresh each billing cycle", "Cancel anytime, no lock-in"]
    : ["1 credit = 1 valid human judgment", "Credits are held when you launch a test", "Invalid votes are filtered out", "Unused credits are refunded", "Credits never expire"];

  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(20px, 3vw, 40px)" }}>
      <div className="wrap" style={{ maxWidth: 960 }}>
        <a href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5, color: "var(--fg-3)", textDecoration: "none", marginBottom: 22 }}>← Back</a>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1.18fr)", gap: "clamp(24px, 4vw, 48px)", alignItems: "start" }} className="cols-stack">
          {/* order summary */}
          <div>
            <p className="eyebrow">Checkout</p>
            <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)" }}>{title}</h1>

            <div className="card" style={{ marginTop: 22, padding: 20 }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>{plan ? "What's included" : "How credits work"}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {included.map((x) => (
                  <li key={x} style={{ display: "flex", gap: 10, fontSize: 13.5, color: "var(--fg-2)", alignItems: "flex-start", lineHeight: 1.4 }}>
                    <span style={{ width: 17, height: 17, flex: "none", marginTop: 1, borderRadius: "50%", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", color: "var(--acc-deep)", display: "grid", placeItems: "center", fontSize: 10 }}>✓</span>{x}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 12.5, color: "var(--fg-4)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Secure checkout, powered by Stripe
            </div>
          </div>

          {/* payment */}
          <div className="card" style={{ padding: "clamp(16px, 2vw, 22px)" }}>
            {plan ? <CheckoutClient plan={planKey} cycle={cycle} /> : <CheckoutClient amount={amount} />}
          </div>
        </div>
      </div>
    </section>
  );
}
