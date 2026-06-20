import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout — Vraelis" };

const PACK_LABEL: Record<string, string> = {
  pack_100: "100 credits", pack_500: "500 credits", pack_1000: "1,000 credits",
  pack_5000: "5,000 credits", pack_10000: "10,000 credits",
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ sku?: string }> }) {
  const sp = await searchParams;
  const sku = sp.sku || "pack_500";
  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/app/checkout?sku=${sku}`)}`);
  }
  return (
    <section className="section" style={{ borderBottom: "none", paddingTop: "clamp(24px, 3vw, 44px)" }}>
      <div className="wrap" style={{ maxWidth: 680 }}>
        <p className="eyebrow">Checkout</p>
        <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 6 }}>{PACK_LABEL[sku] || "Add credits"}</h1>
        <p style={{ color: "var(--fg-3)", fontSize: 14, marginBottom: 24 }}>Secure checkout, right here on Vraelis. Powered by Stripe.</p>
        <CheckoutClient sku={sku} />
      </div>
    </section>
  );
}
