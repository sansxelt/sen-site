// Display formatting for the approved _v1 money model (docs/pricing-verdict-final.md). NO money
// constants live here and none may be added: every rendered dollar figure is formatted from cents that
// come out of lib/preflight/pass-pricing.ts (PLAN_CATALOG_V1, passPriceCents, rerunPriceCents, ...).
// scripts/pricing-v1-ui-verify.ts enforces that the V1 surfaces never hardcode a dollar amount.

// Whole-dollar display: 4900 -> "$49", 149000 -> "$1,490".
export function usdFromCents(cents: number): string {
  return "$" + Math.round(cents / 100).toLocaleString("en-US");
}

// Annual plans charge 10x monthly up front (two months free); the effective monthly rate spreads the
// yearly total over 12 months for display, e.g. builder_v1 -> "$41".
export function effectiveMonthlyUsd(yearlyCents: number): string {
  return usdFromCents(yearlyCents / 12);
}

// ── WHAT A PLAN SELLS, IN ONE PLACE ──────────────────────────────────────────────────────────────────
//
// This text lived in THREE files: the console plans page, the previous marketing pricing page, and design
// 06's. Three copies of the same sentence is how one of them ends up describing a product the others do
// not, and it is exactly what happened: API access was Scale-only and stated on none of them.
//
// Both surfaces derive from here now, so a plan cannot be described two ways.
//
// The split is deliberate. A plan LEADS with the outcomes it keeps proven, because nobody wants forty
// verifications, they want checkout to keep granting Pro access. The capacity that pays for it is
// disclosed immediately underneath rather than behind a phrase like "fair use": the first question anyone
// serious asks is whether one guarantee can trigger unbounded browser time, and the answer has to be a
// number on the card.
import type { PlanV1 } from "./pass-pricing";

/** The headline: protected surface area, not run count. */
export function planHeadline(p: PlanV1): string {
  return `Protects up to ${p.maxGuarantees} active guarantees`;
}

/** The capacity behind the headline. Every line is a figure the system actually enforces. */
export function planCapacity(p: PlanV1): string[] {
  return [
    `${p.passesPerMonth} verifications a month, up to ${p.flowsPerPass} flows each`,
    p.maxApplications === null ? "Connect any number of systems" : `${p.maxApplications} connected system${p.maxApplications === 1 ? "" : "s"}`,
    // Was Scale-only and listed nowhere, which is how someone could install the CLI and be refused by a
    // rule they had no way to read.
    "API, CLI and webhooks",
    "Top up for more, billed per verification",
  ];
}
