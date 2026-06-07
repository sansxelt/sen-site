import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isCycle, isPlanKey, type Cycle, type PlanKey } from "@/lib/vraelis-plans";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = {
  title: "Checkout — Vraelis",
  robots: { index: false, follow: false },
};

const NAMES: Record<PlanKey, string> = { solo: "Solo", growth: "Growth" };
const PRICE: Record<PlanKey, Record<Cycle, string>> = {
  solo: { monthly: "$39 / month", yearly: "$390 / year", lifetime: "$590 one-time" },
  growth: { monthly: "$89 / month", yearly: "$890 / year", lifetime: "$1,490 one-time" },
};

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const plan = String(Array.isArray(params.plan) ? params.plan[0] : params.plan ?? "");
  const cycle = String(Array.isArray(params.cycle) ? params.cycle[0] : params.cycle ?? "");

  if (!isPlanKey(plan) || !isCycle(cycle)) redirect("/pricing");

  const session = await auth();
  if (!session?.user?.email) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/v/checkout?plan=${plan}&cycle=${cycle}`)}`);
  }

  return (
    <section className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 520 }}>
        <div style={{ marginBottom: 24 }}>
          <p className="eyebrow">Checkout</p>
          <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)", marginBottom: 8 }}>
            Vraelis <span className="em">{NAMES[plan as PlanKey]}</span>
          </h1>
          <p className="lead-copy">{PRICE[plan as PlanKey][cycle as Cycle]}</p>
        </div>
        <CheckoutClient plan={plan as PlanKey} cycle={cycle as Cycle} priceLabel={PRICE[plan as PlanKey][cycle as Cycle]} />
      </div>
    </section>
  );
}
