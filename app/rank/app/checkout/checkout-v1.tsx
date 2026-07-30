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
  pro_v1: "For teams launching continuously across systems.",
  scale_v1: "For agencies and platforms verifying at volume.",
};

export function v1Blurb(plan: PlanV1): string {
  return BLURBS[plan.key];
}

export function v1Included(plan: PlanV1, cycle: V1Cycle): string[] {
  return [
    `Validate ${plan.passesPerMonth} launches a month (${plan.passesPerMonth} verifications)`,
    `Up to ${plan.flowsPerPass} flows verified per run`,
    plan.maxApplications === null ? "No cap on connected systems" : `${plan.maxApplications} connected systems`,
    "Real-browser evidence with screenshots on every verification",
    "Linked repair verification",
    "Targeted reruns spend only the selected flows",
    "Unused monthly allowance resets each subscription month",
    ...(cycle === "yearly" ? ["Charged up front, usage released monthly"] : []),
    "Cancel anytime, no lock-in",
  ];
}

// Renewal + cancellation terms shown BEFORE payment (V1.1 S1 native review screen): the buyer reads
// exactly what recurs, when, and how cancellation behaves in our own words before the Stripe panel is
// even mounted. Nothing here may promise an unimplemented behavior (verdict ruling 10).
export function V1RenewalTerms({ plan, cycle }: { plan: PlanV1; cycle: V1Cycle }) {
  const amt = usdFromCents(cycle === "yearly" ? plan.yearlyCents : plan.monthlyCents);
  const lines: string[] = [
    cycle === "yearly"
      ? `Renews every 12 months until cancelled. ${amt} is charged up front for the year, and your usage is released in monthly buckets, never all at once.`
      : `Renews monthly until cancelled. ${amt} is charged at the start of each subscription month.`,
    "Cancel anytime from Billing. Cancellation takes effect at the end of the period you have paid for, so your access and remaining allowance continue until then. No clawback.",
    "No overage charges: when a month's allowance is used up we refuse the run and say so, we never bill extra on top of your plan.",
  ];
  return (
    <div className="card" style={{ marginTop: 14, padding: 20 }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Renewal and cancellation</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {lines.map((x) => (
          <li key={x} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--fg-3)", alignItems: "flex-start", lineHeight: 1.5 }}>
            <span style={{ width: 5, height: 5, flex: "none", marginTop: 7, borderRadius: "50%", background: "var(--acc-deep)" }} />{x}
          </li>
        ))}
      </ul>
    </div>
  );
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
