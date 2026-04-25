export type PricingPlanKey =
  | "free"
  | "apprentice"
  | "studio"
  | "pro"
  | "teams"
  | "enterprise";

export type BillingAddonKey =
  // v0.1.12 — memory_boost / api_boost / key_pack removed (no Stripe
  // products were ever created for them; the buttons rendered as
  // buyable but every click 500'd "no price configured").
  // v0.1.4 monetization — recurring add-on packs (monthly/yearly).
  // v0.1.9 dropped voice_pack + image_pack — those features are now
  // covered by the credit ledger (lib/credits.ts). Copilot Pro Pack
  // and Power Pack stay as real Stripe subscriptions.
  | "copilot_pro_pack"
  | "power_pack"
  // v0.1.4 monetization — one-time top-ups. These are NOT subscription
  // items — payment-intent route handles them via Stripe checkout in
  // mode: "payment" (or a one-shot PaymentIntent). They still get
  // priced through STRIPE_PRICES so the same price-id lookup works.
  // v0.1.9 dropped voice_minute_pack / image_credit_pack /
  // copilot_time_pack — replaced by buy-credits flow.
  | "session_boost"
  | "weekly_boost";

// One-time top-up keys that are charged with a single PaymentIntent
// instead of being attached as a recurring subscription item. Centralized
// here so both the client and the server agree on what's "buy once."
export const ONE_TIME_BOOST_KEYS: ReadonlySet<BillingAddonKey> = new Set([
  "session_boost",
  "weekly_boost",
]);

export function isOneTimeBoost(key: string): key is BillingAddonKey {
  return ONE_TIME_BOOST_KEYS.has(key as BillingAddonKey);
}

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

export type BillingAddon = {
  ctaLabel: string;
  description: string;
  key: BillingAddonKey;
  monthlyLabel: string;
  monthlyValue: number;
  name: string;
  note: string;
  points: string[];
  yearlyLabel?: string;
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

export const billingAddons: BillingAddon[] = [
  // v0.1.12 — Memory Boost / API Boost / Key Pack removed: never had
  // Stripe products created, so the buttons rendered as buyable but
  // every click 500'd with "no price configured." Cleaner to delete
  // the entries than to env-gate dead UI.
  // ──────────────────────────────────────────────────────────────────
  // v0.1.4 monetization — recurring add-on packs.
  // Stripe products/prices need to be created in the dashboard and
  // wired through STRIPE_PRICE_<KEY>_MONTHLY / _YEARLY env vars.
  // v0.1.9 — Voice Pack + Image Pack were dropped. Voice / image usage
  // is now covered by the credit ledger (lib/credits.ts).
  // ──────────────────────────────────────────────────────────────────
  {
    ctaLabel: "Add Copilot Pro Pack",
    description: "Unlimited copilot for any plan.",
    key: "copilot_pro_pack",
    monthlyLabel: "$12 / month",
    monthlyValue: 12,
    name: "Copilot Pro Pack",
    note: "Unlimited copilot",
    points: ["Unlimited copilot hours", "Always-on background assist"],
    yearlyLabel: "$120 / year",
  },
  {
    ctaLabel: "Add Power Pack",
    description: "Unlimited copilot + monthly credit allowance — best ongoing value.",
    key: "power_pack",
    monthlyLabel: "$25 / month",
    monthlyValue: 25,
    name: "Power Pack",
    note: "Bundle of boosts + credits",
    points: [
      "Includes Copilot Pro Pack",
      "Bonus credit allowance for voice + image",
      "Best ongoing value vs. separate purchases",
    ],
    yearlyLabel: "$240 / year",
  },
  // ──────────────────────────────────────────────────────────────────
  // v0.1.4 monetization — one-time boost top-ups.
  // Charged via a single Stripe PaymentIntent (mode: "payment" via
  // checkout.sessions.create in the future, but the desktop app uses
  // an inline PaymentIntent here so the user stays inside the app).
  // ──────────────────────────────────────────────────────────────────
  {
    ctaLabel: "Buy Session Boost",
    description: "+50 chats this session.",
    key: "session_boost",
    monthlyLabel: "$2",
    monthlyValue: 2,
    name: "Session Boost",
    note: "One-time",
    points: ["+50 chat requests", "Applied immediately"],
  },
  {
    ctaLabel: "Buy Weekly Boost",
    description: "+500 weekly requests.",
    key: "weekly_boost",
    monthlyLabel: "$5",
    monthlyValue: 5,
    name: "Weekly Boost",
    note: "One-time",
    points: ["+500 weekly requests", "Resets at end of week"],
  },
  // v0.1.9 — Voice Minute Pack / Image Credit Pack / Copilot Time Pack
  // were dropped in favour of the flexible credit ledger. Users buy a
  // dollar balance and each feature burns credits at
  // CREDIT_COSTS[kind] (see lib/credits.ts).
];

// v0.1.16 — Plans that already INCLUDE the value of recurring addons.
// Pro / Teams / Enterprise have unlimited weekly chat + image, so the
// Copilot Pro Pack and Power Pack don't add anything they don't
// already get. Billing UI shows these as "Owned with your plan"
// instead of payment buttons. One-time boosts (session_boost,
// weekly_boost) are always purchasable since they grant cap-busting
// credits that pair well with any plan when the user wants more.
export const ADDONS_INCLUDED_BY_PLAN: Record<string, BillingAddonKey[]> = {
  free: [],
  apprentice: [],
  studio: [],
  pro: ["copilot_pro_pack", "power_pack"],
  teams: ["copilot_pro_pack", "power_pack"],
  enterprise: ["copilot_pro_pack", "power_pack"],
};

export function planIncludesAddon(
  planKey: string | null | undefined,
  addonKey: BillingAddonKey,
): boolean {
  if (!planKey) return false;
  const list = ADDONS_INCLUDED_BY_PLAN[planKey.toLowerCase()] ?? [];
  return list.includes(addonKey);
}

export const pricingPlanMap = Object.fromEntries(
  pricingPlans.map((plan) => [plan.key, plan]),
) as Record<PricingPlanKey, PricingPlan>;

export const billingAddonMap = Object.fromEntries(
  billingAddons.map((addon) => [addon.key, addon]),
) as Record<BillingAddonKey, BillingAddon>;

export function getPricingPlan(planKey: PricingPlanKey) {
  return pricingPlanMap[planKey];
}

export function getBillingAddon(addonKey: BillingAddonKey) {
  return billingAddonMap[addonKey];
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
  if (plan.ctaVariant === "contact") return "/contact";
  if (plan.key === "free") return "/account";
  return `/checkout?plan=${plan.key}`;
}
