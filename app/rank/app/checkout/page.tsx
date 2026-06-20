import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout — Vraelis" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ amount?: string }> }) {
  const sp = await searchParams;
  const amount = Math.max(5, Math.min(9999, parseInt(sp.amount || "0", 10) || 0));
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/app/checkout?amount=${amount}`)}`);
  }
  const credits = amount * 10;
  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(24px, 3vw, 44px)" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <p className="eyebrow">Checkout</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 6 }}>{credits.toLocaleString()} credits — ${amount}</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 24 }}>Secure checkout, right here on Vraelis. Powered by Stripe.</p>
        <CheckoutClient amount={amount} />
      </div>
    </section>
  );
}
