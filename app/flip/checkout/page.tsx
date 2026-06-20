import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout — Vraelis" };

const PLAN_LABEL: Record<string, string> = { seller: "Seller", growth: "Growth", operator: "Operator" };
const CYCLE_LABEL: Record<string, string> = { monthly: "monthly", yearly: "yearly", lifetime: "lifetime" };

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; cycle?: string }>;
}) {
  const sp = await searchParams;
  const plan = sp.plan || "seller";
  const cycle = sp.cycle || "monthly";

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/flip/checkout?plan=${plan}&cycle=${cycle}`)}`);
  }

  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <p className="eyebrow">Checkout</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.4rem)", marginBottom: 6 }}>
          {PLAN_LABEL[plan] || "Pro"} — <span className="em">{CYCLE_LABEL[cycle] || cycle}</span>
        </h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 24 }}>Secure checkout, right here on Vraelis. Powered by Stripe.</p>
        <CheckoutClient plan={plan} cycle={cycle} />
      </div>
    </section>
  );
}
