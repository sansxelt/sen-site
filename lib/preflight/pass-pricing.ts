// The approved per-pass pricing + entitlement model (docs/pricing-verdict-final.md). PURE money math:
// no DB, no env reads except the feature flag, fully covered by scripts/pass-pricing-verify.ts.
// Everything here is INERT until VRAELIS_PASS_PRICING=1 (the legacy credit path stays authoritative).
//
// Model in one paragraph: PAYG charges dollars per pass ($15 base covering 5 flows, $3 per extra flow;
// early access keeps $10 until the flip). A targeted rerun costs $3 per selected failed flow, CAPPED at
// what the comparable full pass would cost, so a rerun can never exceed a fresh pass. Subscriptions never
// spend cents: their allowance is metered in FLOW UNITS per subscription month (passes_per_month x
// flows_per_pass), so a full pass consumes its selected flow count and a targeted rerun consumes only the
// flows it actually runs (ruling: reruns must not waste a full-pass allowance). The monthly window is
// computed from the subscription anchor at request time, which is what makes ANNUAL billing release usage
// month by month with no scheduler: paying yearly moves the renewal date, not the metering window.

export function passPricingEnabled(): boolean {
  return process.env.VRAELIS_PASS_PRICING === "1";
}

// ── PAYG (no subscription) ──────────────────────────────────────────────────────────────────────────
export const PASS_BASE_CENTS = 1500;               // $15 public price (approved)
export const EARLY_ACCESS_PASS_BASE_CENTS = 1000;  // $10 stays only as the current early-access price
export const PASS_INCLUDED_FLOWS = 5;
export const EXTRA_FLOW_CENTS = 300;               // $3 per additional flow (ruling 1)
export const RERUN_PER_FLOW_CENTS = 300;           // $3 per selected failed flow

export function passPriceCents(selectedFlows: number, opts: { earlyAccess?: boolean } = {}): number {
  const base = opts.earlyAccess ? EARLY_ACCESS_PASS_BASE_CENTS : PASS_BASE_CENTS;
  const extra = Math.max(0, selectedFlows - PASS_INCLUDED_FLOWS) * EXTRA_FLOW_CENTS;
  return base + extra;
}

// A targeted rerun must never cost more than the comparable full pass (approved cap).
export function rerunPriceCents(selectedFlows: number, opts: { earlyAccess?: boolean } = {}): number {
  const n = Math.max(1, selectedFlows);
  return Math.min(n * RERUN_PER_FLOW_CENTS, passPriceCents(n, opts));
}

// ── Versioned plan catalog (fresh keys; legacy starter/creator/pro/scale meanings are NEVER reused) ──
export type PlanV1 = {
  key: "builder_v1" | "pro_v1" | "scale_v1";
  name: string;
  monthlyCents: number; yearlyCents: number;        // yearly = 10x monthly (two months free)
  passesPerMonth: number; flowsPerPass: number;
  maxApplications: number | null;                   // null = no cap surfaced yet
};
export const PLAN_CATALOG_V1: PlanV1[] = [
  { key: "builder_v1", name: "Builder", monthlyCents: 4900, yearlyCents: 49000, passesPerMonth: 10, flowsPerPass: 5, maxApplications: 2 },
  { key: "pro_v1", name: "Pro", monthlyCents: 14900, yearlyCents: 149000, passesPerMonth: 40, flowsPerPass: 10, maxApplications: 10 },
  { key: "scale_v1", name: "Scale", monthlyCents: 39900, yearlyCents: 399000, passesPerMonth: 150, flowsPerPass: 20, maxApplications: null },
];
export const FREE_TIER = { lifetimePasses: 1, flowsPerPass: 3, maxApplications: 1 } as const;

export function planV1(key: string): PlanV1 | null {
  return PLAN_CATALOG_V1.find((p) => p.key === key) ?? null;
}

// The subscription allowance in flow units for one subscription month.
export function flowUnitsPerMonth(plan: PlanV1): number {
  return plan.passesPerMonth * plan.flowsPerPass;
}

// ── Subscription month window (anchor-based; the same function serves monthly AND annual billing) ───
// Returns the [start, end) of the subscription month containing `now`, anchored to the subscription's
// start (billing anchor). Anchor days past a month's end clamp to that month's last day (Jan 31 anchor ->
// Feb window starts Feb 28/29), matching Stripe's own anchor behavior.
export function monthlyWindow(anchorIso: string, nowIso: string): { start: string; end: string } {
  const anchor = new Date(anchorIso);
  const now = new Date(nowIso);
  const anchorDay = anchor.getUTCDate();
  const clamp = (y: number, m: number): Date => {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(anchorDay, lastDay),
      anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds()));
  };
  // Candidate window starting in now's month; step back one month if now precedes it.
  let start = clamp(now.getUTCFullYear(), now.getUTCMonth());
  if (now < start) start = clamp(now.getUTCFullYear(), now.getUTCMonth() - 1);
  const end = clamp(start.getUTCFullYear(), start.getUTCMonth() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

// ── Entitlement decision (pure; callers supply the counted usage) ────────────────────────────────────
export type PassGate =
  | { ok: true; unitsAfter: number }
  | { ok: false; error: "flow_cap" | "allowance_exhausted"; message: string };

export function canRunPass(plan: PlanV1, unitsUsedInWindow: number, selectedFlows: number): PassGate {
  if (selectedFlows > plan.flowsPerPass) {
    return { ok: false, error: "flow_cap", message: `${plan.name} includes up to ${plan.flowsPerPass} flows per pass. Reduce the selection or upgrade.` };
  }
  const budget = flowUnitsPerMonth(plan);
  if (unitsUsedInWindow + selectedFlows > budget) {
    return { ok: false, error: "allowance_exhausted", message: `This month's allowance is used up (${plan.passesPerMonth} passes of ${plan.flowsPerPass} flows). It resets at your next subscription month, or you can run pay-as-you-go passes.` };
  }
  return { ok: true, unitsAfter: unitsUsedInWindow + selectedFlows };
}

// Passes-equivalent for display: "3.4 of 10 passes used" reads better than flow units.
export function passesEquivalent(unitsUsed: number, plan: PlanV1): number {
  return Math.round((unitsUsed / plan.flowsPerPass) * 10) / 10;
}
