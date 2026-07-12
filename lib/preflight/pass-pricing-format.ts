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
