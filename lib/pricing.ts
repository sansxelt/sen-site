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
      "A lightweight starting point for everyday questions, discovery, and structured output.",
    key: "free",
    memoryWindow: "7-day history",
    monthlyCredits: "Light usage",
    monthlyLabel: "Free",
    monthlyValue: 0,
    name: "Free",
    note: "Universal starter",
    points: [
      "Ask and Explore access",
      "Light Create outputs",
      "Saved result history",
      "Invite queue access",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Community support",
    yearlyLabel: undefined,
  },
  {
    apiRequestLimit: 50000,
    ctaLabel: "Choose Core",
    ctaVariant: "account",
    description:
      "For people who want Sansxel as a daily thinking and output tool.",
    key: "apprentice",
    memoryWindow: "30-day history",
    monthlyCredits: "Standard usage",
    monthlyLabel: "$12 / month",
    monthlyValue: 12,
    name: "Core",
    note: "Daily personal use",
    points: [
      "Everything in Free",
      "More Ask and Explore usage",
      "More Create outputs",
      "Faster generation priority",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Standard support",
    yearlyLabel: "$120 / year",
  },
  {
    apiRequestLimit: 150000,
    ctaLabel: "Choose Plus",
    ctaVariant: "account",
    description:
      "For heavier personal workflows moving from rough input to polished deliverables.",
    key: "studio",
    memoryWindow: "60-day history",
    monthlyCredits: "Expanded usage",
    monthlyLabel: "$20 / month",
    monthlyValue: 20,
    name: "Plus",
    note: "Richer create workflows",
    points: [
      "Everything in Core",
      "Stronger visual output depth",
      "Larger input and file handling",
      "Higher monthly usage",
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
      "The full personal plan for people building products, systems, and polished deliverables every week.",
    featured: true,
    key: "pro",
    memoryWindow: "120-day history",
    monthlyCredits: "High usage + API access",
    monthlyLabel: "$39 / month",
    monthlyValue: 39,
    name: "Pro",
    note: "Full build power",
    points: [
      "Everything in Plus",
      "Highest personal usage limits",
      "API access for custom workflows",
      "Early access to advanced build features",
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
      "Shared Sansxel for teams turning ideas, research, and planning into outputs together.",
    key: "teams",
    memoryWindow: "Shared library history",
    monthlyCredits: "Per-seat shared usage",
    monthlyLabel: "$25 / seat",
    monthlyValue: 25,
    name: "Teams",
    note: "Starts at 3 seats",
    points: [
      "Shared result libraries",
      "Team spaces and permissions",
      "Usage and admin controls",
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
      "Custom rollout for organizations that want Sansxel embedded into real workflows at scale.",
    key: "enterprise",
    memoryWindow: "Custom retention",
    monthlyCredits: "Unlimited usage and API",
    monthlyLabel: "$500+ / mo",
    monthlyValue: 500,
    name: "Enterprise",
    note: "Custom rollout and governance",
    points: [
      "Custom usage and access policies",
      "Expanded limits and support",
      "Custom rollout and onboarding",
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
