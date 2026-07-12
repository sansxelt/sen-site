// Checkout copy + price display for the _v1 plans (pricing cutover step 11). Server-rendered: prices
// come straight from PLAN_CATALOG_V1 cents (lib/preflight/pass-pricing.ts), the same source the
// subscribe route's Stripe price ids were created from, so the order summary can never drift from the
// approved ladder. Only IMPLEMENTED entitlements may be listed here (verdict ruling 10) — never
// retention tiers, priority queues, API access, higher concurrency, or advanced usage controls.
// scripts/pricing-v1-ui-verify.ts checks this file for forbidden phrases and hardcoded dollars.

import type { PlanV1 } from "@/lib/preflight/pass-pricing";
import { usdFromCents, effectiveMonthlyUsd } from "@/lib/preflight/pass-pricing-format";

export type V1Cycle = "monthly" | "yearly";

const BLURBS: Record<PlanV1["key"], string> = {
  builder_v1: "For one product moving steadily toward launch.",
  pro_v1: "For teams launching continuously across applications.",
  scale_v1: "For agencies and platforms verifying at volume.",
};

export function v1Blurb(plan: PlanV1): string {
  return BLURBS[plan.key];
}

export function v1Included(plan: PlanV1, cycle: V1Cycle): string[] {
  return [
    `${plan.passesPerMonth} Production Passes per month`,
    `Up to ${plan.flowsPerPass} flows per pass`,
    plan.maxApplications === null ? "No cap on connected applications" : `${plan.maxApplications} connected applications`,
    "Real-browser evidence with screenshots on every pass",
    "Linked repair verification",
    "Targeted reruns spend only the selected flows",
    "Unused monthly allowance resets each subscription month",
    ...(cycle === "yearly" ? ["Charged up front, usage released monthly"] : []),
    "Cancel anytime, no lock-in",
  ];
}

// Mirrors the visual shape of PlanPrice (checkout-client.tsx) but is fully server-rendered from catalog
// cents — no fetch, because the _v1 amounts are authoritative in code, not read back from Stripe.
export function PlanPriceV1({ plan, cycle }: { plan: PlanV1; cycle: V1Cycle }) {
  const amt = usdFromCents(cycle === "yearly" ? plan.yearlyCents : plan.monthlyCents);
  const per = cycle === "yearly" ? "/yr" : "/mo";
  const label = cycle === "yearly"
    ? `Billed yearly | one charge every 12 months, ${effectiveMonthlyUsd(plan.yearlyCents)}/mo effective, usage released monthly`
    : "Billed monthly | renews each month";
  return (
    <div style={{ marginTop: 14, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, color: "var(--fg-1)", letterSpacing: "-0.02em" }}>
        {amt}<span style={{ fontSize: 15, color: "var(--fg-4)", fontWeight: 500 }}>{per}</span>
      </span>
      <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>{cycle === "yearly" ? "Yearly" : "Monthly"}</span>
      <span style={{ fontSize: 12.5, color: "var(--fg-4)", width: "100%" }}>{label}</span>
    </div>
  );
}
