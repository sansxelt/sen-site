export type PricingPlanKey =
  | "free"
  | "apprentice"
  | "studio"
  | "pro"
  | "teams"
  | "enterprise";

export type BillingCycle = "monthly" | "yearly" | "custom";
export type SubscriptionStatus =
  | "free"
  | "selection_pending"
  | "active"
  | "contact_required"
  | "canceled";

export type PricingPlan = {
  apiRequestLimit: number | null;
  badge?: string;
  ctaLabel: string;
  ctaVariant: "account" | "contact";
  description: string;
  featured?: boolean;
  key: PricingPlanKey;
  memoryWindow: string;
  monthlyCredits: string;
  monthlyLabel: string;
  monthlyValue: number | null;
  name: string;
  note: string;
  points: string[];
  seats: string;
  segment: "individual" | "team";
  support: string;
  yearlyLabel?: string;
};

export type PricingSnapshot = {
  billingCycle: BillingCycle;
  monthlyLabel: string;
  plan: PricingPlan;
  seatCount: number;
  status: SubscriptionStatus;
};

export const pricingPlans: PricingPlan[] = [
  {
    apiRequestLimit: 10000,
    ctaLabel: "Start free",
    ctaVariant: "account",
    description:
      "A limited entry point for trying the workspace, account flow, and lightweight memory features.",
    key: "free",
    memoryWindow: "7-day memory",
    monthlyCredits: "Light credits",
    monthlyLabel: "$0 / month",
    monthlyValue: 0,
    name: "Free",
    note: "Limited early-access plan",
    points: [
      "1 device session",
      "Basic workspace memory",
      "Recent activity timeline",
      "Invite queue access",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Community support",
    yearlyLabel: "$0 / year",
  },
  {
    apiRequestLimit: 50000,
    ctaLabel: "Choose Apprentice",
    ctaVariant: "account",
    description:
      "An entry paid tier for personal workflows that need more continuity than the free plan.",
    key: "apprentice",
    memoryWindow: "30-day memory",
    monthlyCredits: "Standard credits",
    monthlyLabel: "$12 / month",
    monthlyValue: 12,
    name: "Apprentice",
    note: "Personal memory and recovery",
    points: [
      "Everything in Free",
      "Longer memory window",
      "More timeline search depth",
      "Priority invite movement",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Standard support",
    yearlyLabel: "$120 / year",
  },
  {
    apiRequestLimit: 150000,
    ctaLabel: "Choose Studio",
    ctaVariant: "account",
    description:
      "For people who want a reliably useful AI workspace without jumping all the way into the highest tier.",
    key: "studio",
    memoryWindow: "60-day memory",
    monthlyCredits: "Expanded credits",
    monthlyLabel: "$20 / month",
    monthlyValue: 20,
    name: "Studio",
    note: "More capable AI workflow",
    points: [
      "Everything in Apprentice",
      "Stronger daily summaries",
      "Deeper session recovery",
      "Higher monthly AI usage",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Priority email support",
    yearlyLabel: "$192 / year",
  },
  {
    apiRequestLimit: 500000,
    badge: "Best Value",
    ctaLabel: "Choose Pro",
    ctaVariant: "account",
    description:
      "The full individual plan for people who want richer AI behavior, larger credit pools, and API access.",
    featured: true,
    key: "pro",
    memoryWindow: "120-day memory",
    monthlyCredits: "High credits + API access",
    monthlyLabel: "$39 / month",
    monthlyValue: 39,
    name: "Pro",
    note: "Full personal AI workspace",
    points: [
      "Everything in Studio",
      "Much larger AI credit pool",
      "API access for personal workflows",
      "Priority feature access",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Priority support",
    yearlyLabel: "$390 / year",
  },
  {
    apiRequestLimit: 300000,
    ctaLabel: "Contact for Teams",
    ctaVariant: "contact",
    description:
      "A per-seat team tier for shared workspaces, onboarding, and admin controls without enterprise overhead.",
    key: "teams",
    memoryWindow: "Shared workspace memory",
    monthlyCredits: "Per-seat shared credits",
    monthlyLabel: "$25 / seat",
    monthlyValue: 25,
    name: "Teams",
    note: "Starts at 3 seats",
    points: [
      "Shared workspaces",
      "Admin controls",
      "Per-seat usage management",
      "Team onboarding support",
    ],
    seats: "3+ seats",
    segment: "team",
    support: "Team support",
    yearlyLabel: "$240 / seat / yr",
  },
  {
    apiRequestLimit: null,
    ctaLabel: "Contact enterprise",
    ctaVariant: "contact",
    description:
      "Base pricing starts at $5k/yr for small LLCs and scales higher based on company size, longevity, and deployment scope. All contracts are negotiated.",
    key: "enterprise",
    memoryWindow: "Custom retention",
    monthlyCredits: "Unlimited credits and API",
    monthlyLabel: "$500+ / mo",
    monthlyValue: 500,
    name: "Enterprise",
    note: "Negotiated · verified business required",
    points: [
      "Unlimited API and credits",
      "Expanded device usage",
      "Custom rollout and support",
      "Business verification required",
    ],
    seats: "Custom",
    segment: "team",
    support: "Dedicated support",
    yearlyLabel: "From $5k+ / yr",
  },
];

export const pricingPlanMap = Object.fromEntries(
  pricingPlans.map((plan) => [plan.key, plan]),
) as Record<PricingPlanKey, PricingPlan>;

export function getPricingPlan(planKey: PricingPlanKey) {
  return pricingPlanMap[planKey];
}

export function getDefaultPricingSnapshot(): PricingSnapshot {
  return {
    billingCycle: "monthly",
    monthlyLabel: pricingPlanMap.free.monthlyLabel,
    plan: pricingPlanMap.free,
    seatCount: 1,
    status: "free",
  };
}

export function getPlanActionHref(plan: PricingPlan) {
  if (plan.ctaVariant === "contact") {
    return "/contact";
  }

  return "/account?section=billing";
}
