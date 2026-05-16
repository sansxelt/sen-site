export type PricingPlanKey =
  | "free"
  | "student"
  | "apprentice"
  | "creator"
  | "studio"
  | "developer"
  | "pro"
  | "teams"
  | "enterprise";

export type BillingAddonKey =
  // v0.1.12, memory_boost / api_boost / key_pack removed (no Stripe
  // products were ever created for them; the buttons rendered as
  // buyable but every click 500'd "no price configured").
  // v0.1.4 monetization, recurring add-on packs (monthly/yearly).
  // v0.1.9 dropped voice_pack + image_pack, those features are now
  // covered by the credit ledger (lib/credits.ts). Copilot Pro Pack
  // and Power Pack stay as real Stripe subscriptions.
  | "copilot_pro_pack"
  | "power_pack"
  // v0.1.4 monetization, one-time top-ups. These are NOT subscription
  // items, payment-intent route handles them via Stripe checkout in
  // mode: "payment" (or a one-shot PaymentIntent). They still get
  // priced through STRIPE_PRICES so the same price-id lookup works.
  // v0.1.9 dropped voice_minute_pack / image_credit_pack /
  // copilot_time_pack, replaced by buy-credits flow.
  | "session_boost"
  | "weekly_boost"
  // v0.2.x marketplace add-ons
  | "voice_pack_standard"
  | "storage_upgrade"
  | "template_pack"
  | "agent_pack"
  | "lifetime_deal";

// One-time top-up keys that are charged with a single PaymentIntent
// instead of being attached as a recurring subscription item. Centralized
// here so both the client and the server agree on what's "buy once."
export const ONE_TIME_BOOST_KEYS: ReadonlySet<BillingAddonKey> = new Set([
  "session_boost",
  "weekly_boost",
  "template_pack",
  "lifetime_deal",
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
  // v0.2.0, hidden = legacy / deprecated tier still accepted by the
  // type system + DB but not shown in the user-facing pricing list,
  // upgrade paths, or compare table. Existing subs on these tiers
  // keep working; nobody new can pick them.
  hidden?: boolean;
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
  badge?: string;
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
  // ── Individual progression ──────────────────────────────────────────────
  {
    apiRequestLimit: 10000,
    ctaLabel: "Start free",
    ctaVariant: "account",
    description: "Try vraelis with no commitment. Core chat, projects, file uploads, and conversation history.",
    key: "free",
    memoryWindow: "7-day history",
    monthlyCredits: "Core usage",
    monthlyLabel: "Free",
    monthlyValue: 0,
    name: "Free",
    note: "For trying vraelis",
    points: [
      "Core chat access",
      "Up to 3 projects",
      "File uploads",
      "Basic creation tools",
      "Saved conversation history",
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
    description: "More usage, more projects, and faster responses for everyday work.",
    hidden: true,
    key: "apprentice",
    memoryWindow: "30-day history",
    monthlyCredits: "Standard usage",
    monthlyLabel: "$12 / month",
    monthlyValue: 12,
    name: "Core",
    note: "Daily personal use",
    points: [
      "More messages and usage",
      "More projects and memory",
      "Larger file uploads",
      "Faster responses",
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
    description: "More usage, more projects, image generation, and faster responses for everyday makers.",
    key: "studio",
    memoryWindow: "60-day history",
    monthlyCredits: "Expanded usage",
    monthlyLabel: "$20 / month",
    monthlyValue: 20,
    name: "Plus",
    note: "For everyday use",
    points: [
      "More messages and usage",
      "More projects and memory",
      "Larger file uploads",
      "Image generation access",
      "Faster responses",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Priority email support",
    yearlyLabel: "$192 / year",
  },
  {
    apiRequestLimit: 500000,
    badge: "Most capable",
    ctaLabel: "Choose Pro",
    ctaVariant: "account",
    description: "Higher limits, full project memory, advanced creation tools, and priority access for serious work.",
    featured: true,
    key: "pro",
    memoryWindow: "120-day history",
    monthlyCredits: "High usage",
    monthlyLabel: "$39 / month",
    monthlyValue: 39,
    name: "Pro",
    note: "For makers doing serious work",
    points: [
      "Higher usage limits",
      "Full project memory",
      "Advanced file and creation tools",
      "Priority model access",
      "Copilot and integrations access when available",
      "Early access to new Workspace features",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Priority support",
    yearlyLabel: "$390 / year",
  },
  // ── Specialty / persona plans — hidden until Stripe prices are wired ───
  // To activate: create Stripe products for each key, set STRIPE_PRICE_*
  // env vars, then remove hidden: true.
  {
    apiRequestLimit: 30000,
    badge: "Student Rate",
    ctaLabel: "Join waitlist",
    ctaVariant: "contact",
    description:
      "Built for school. Homework help, document analysis, writing, tutoring, and voice study sessions.",
    hidden: true,
    key: "student",
    memoryWindow: "30-day history",
    monthlyCredits: "Study usage",
    monthlyLabel: "$6 / month",
    monthlyValue: 6,
    name: "Student",
    note: "Verified students only",
    points: [
      "300 weekly chats",
      "Tutoring + writing + math help",
      "PDF and doc reading",
      "15 voice minutes / week",
      "15 image generations / week",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Community support",
    yearlyLabel: "$54 / year",
  },
  {
    apiRequestLimit: 80000,
    ctaLabel: "Join waitlist",
    ctaVariant: "contact",
    description:
      "For YouTubers, designers, writers, streamers, and content creators who need images, scripts, and captions.",
    hidden: true,
    key: "creator",
    memoryWindow: "45-day history",
    monthlyCredits: "Creator usage",
    monthlyLabel: "$15 / month",
    monthlyValue: 15,
    name: "Creator",
    note: "Content-first toolkit",
    points: [
      "800 weekly chats",
      "75 image generations / week",
      "Script, caption, and thumbnail help",
      "45 voice minutes / week",
      "Advanced writing and rewrite tools",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Standard support",
    yearlyLabel: "$144 / year",
  },
  {
    apiRequestLimit: 200000,
    ctaLabel: "Join waitlist",
    ctaVariant: "contact",
    description:
      "Higher code limits, repo analysis, app building, debugging, deployment help, and API access.",
    hidden: true,
    key: "developer",
    memoryWindow: "90-day history",
    monthlyCredits: "Developer usage + API",
    monthlyLabel: "$29 / month",
    monthlyValue: 29,
    name: "Developer",
    note: "Build-first toolkit",
    points: [
      "1500 weekly chats",
      "API access included",
      "Deeper code and repo analysis",
      "90 voice minutes / week",
      "100 image generations / week",
    ],
    seats: "1 seat",
    segment: "individual",
    support: "Priority email support",
    yearlyLabel: "$276 / year",
  },
  // ── Team / org plans ────────────────────────────────────────────────────
  {
    apiRequestLimit: 300000,
    ctaLabel: "Contact for Teams",
    ctaVariant: "contact",
    description: "Shared workspaces, team memory libraries, admin controls, and collaborative workflows.",
    key: "teams",
    memoryWindow: "Shared library history",
    monthlyCredits: "Per-seat shared usage",
    monthlyLabel: "$25 / seat",
    monthlyValue: 25,
    name: "Teams",
    note: "For teams building together",
    points: [
      "Shared workspaces",
      "Team memory libraries",
      "Admin and usage controls",
      "Shared billing",
      "Priority support",
    ],
    seats: "3+ seats",
    segment: "team",
    support: "Priority team support",
    yearlyLabel: "$240 / seat / yr",
  },
  {
    apiRequestLimit: null,
    ctaLabel: "Contact enterprise",
    ctaVariant: "contact",
    description:
      "Custom rollout for organizations that want vraelis embedded into real workflows at scale.",
    key: "enterprise",
    memoryWindow: "Custom retention",
    monthlyCredits: "Unlimited usage and API",
    monthlyLabel: "$500+ / mo",
    monthlyValue: 500,
    name: "Enterprise",
    note: "Custom rollout and governance",
    points: [
      "Copilot Pro Pack + Power Pack included org-wide",
      "Custom usage and access policies",
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
  // v0.1.12, Memory Boost / API Boost / Key Pack removed: never had
  // Stripe products created, so the buttons rendered as buyable but
  // every click 500'd with "no price configured." Cleaner to delete
  // the entries than to env-gate dead UI.
  // ──────────────────────────────────────────────────────────────────
  // v0.1.4 monetization, recurring add-on packs.
  // Stripe products/prices need to be created in the dashboard and
  // wired through STRIPE_PRICE_<KEY>_MONTHLY / _YEARLY env vars.
  // v0.1.9, Voice Pack + Image Pack were dropped. Voice / image usage
  // is now covered by the credit ledger (lib/credits.ts).
  // ──────────────────────────────────────────────────────────────────
  {
    ctaLabel: "Add Copilot Pro Pack",
    description: "Unlimited chat + copilot, no weekly cap.",
    key: "copilot_pro_pack",
    monthlyLabel: "$12 / month",
    monthlyValue: 12,
    name: "Copilot Pro Pack",
    note: "Lifts the weekly chat cap",
    points: [
      "Unlimited chat requests",
      "Unlimited copilot asks",
      "Same fast tier, no silent throttle",
    ],
    yearlyLabel: "$120 / year",
  },
  {
    ctaLabel: "Add Power Pack",
    description: "Unlimited chat + image + voice, no weekly cap on anything.",
    key: "power_pack",
    monthlyLabel: "$25 / month",
    monthlyValue: 25,
    name: "Power Pack",
    note: "Lifts every weekly cap",
    points: [
      "Includes Copilot Pro Pack",
      "Unlimited image generation",
      "Unlimited voice, talk + transcribe",
    ],
    yearlyLabel: "$240 / year",
  },
  // ──────────────────────────────────────────────────────────────────
  // v0.1.4 monetization, one-time boost top-ups.
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
  // v0.1.9, Voice Minute Pack / Image Credit Pack / Copilot Time Pack
  // were dropped in favour of the flexible credit ledger. Users buy a
  // dollar balance and each feature burns credits at
  // CREDIT_COSTS[kind] (see lib/credits.ts).
  // ──────────────────────────────────────────────────────────────────
  // v0.2.x marketplace add-ons.
  // ──────────────────────────────────────────────────────────────────
  {
    ctaLabel: "Add Voice Pack",
    description: "Access premium AI voices, higher quality speech output, and additional voice styles.",
    key: "voice_pack_standard",
    monthlyLabel: "$4 / month",
    monthlyValue: 4,
    name: "Voice Pack",
    note: "Upgrades voice quality",
    points: [
      "5 additional voice styles",
      "Higher fidelity speech output",
      "Narration and podcast-style voices",
    ],
    yearlyLabel: "$38 / year",
  },
  {
    ctaLabel: "Add Storage",
    description: "Extra storage for files, generated images, project history, documents, and workspace assets.",
    key: "storage_upgrade",
    monthlyLabel: "$3 / month",
    monthlyValue: 3,
    name: "Storage Upgrade",
    note: "10 GB extra storage",
    points: [
      "+10 GB file and asset storage",
      "Longer project memory retention",
      "Extended chat history archive",
    ],
    yearlyLabel: "$28 / year",
  },
  {
    ctaLabel: "Buy Template Pack",
    description: "50 curated prompt packs, business workflows, study templates, content systems, and coding scaffolds.",
    key: "template_pack",
    monthlyLabel: "$6 one-time",
    monthlyValue: 6,
    name: "Template Pack",
    note: "One-time purchase",
    points: [
      "50 professional prompt templates",
      "Business, creator, and study packs",
      "Instant workflow starters",
    ],
  },
  {
    ctaLabel: "Add Agent Pack",
    description: "Unlock specialist agents for coding, school, content creation, research, and productivity.",
    key: "agent_pack",
    monthlyLabel: "$8 / month",
    monthlyValue: 8,
    name: "Agent Pack",
    note: "Specialized AI agents",
    points: [
      "Coding agent (full-project debug)",
      "Research agent (multi-source synthesis)",
      "Study agent (tutoring + flashcards)",
      "Content agent (script + SEO + captions)",
    ],
    yearlyLabel: "$76 / year",
  },
  {
    badge: "Limited",
    ctaLabel: "Get Lifetime Pro",
    description: "Pay once, use Pro forever. Early adopter pricing — limited spots. Includes all current Pro features and future core updates.",
    key: "lifetime_deal",
    monthlyLabel: "$199 one-time",
    monthlyValue: 199,
    name: "Lifetime Pro",
    note: "Limited — early adopter",
    points: [
      "Pro plan access forever",
      "All future core feature updates",
      "Early adopter badge",
      "Priority support",
    ],
  },
];

// v0.1.16, Plans that already INCLUDE the value of recurring addons.
// Pro / Teams / Enterprise have unlimited weekly chat + image, so the
// Copilot Pro Pack and Power Pack don't add anything they don't
// already get.
//
// Plus ($20/mo) includes Copilot Pro Pack ($12/mo standalone), the
// math leaves $8 for the base Plus value which lines up with the
// step up from Core ($12/mo). Power Pack ($25/mo) is NOT included
// in Plus because it costs more than Plus does, bundling it would
// make Plus a strict pricing arbitrage over Power Pack alone.
//
// Billing UI shows included addons as "Owned with [Plan]" instead of
// payment buttons. One-time boosts (session_boost, weekly_boost) are
// always purchasable since they grant cap-busting credits that pair
// well with any plan when the user wants more.
export const ADDONS_INCLUDED_BY_PLAN: Record<string, BillingAddonKey[]> = {
  free: [],
  student: [],
  apprentice: [],
  creator: [],
  studio: ["copilot_pro_pack"],
  developer: [],
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

// User-facing plan name. Internal keys ("apprentice", "studio") look
// confusing in error messages, every other surface shows "Core" /
// "Plus" so the cap-blocked errors should match. Single source of
// truth so client + server agree.
export function planDisplayName(key: string | null | undefined): string {
  const k = (key ?? "").toLowerCase();
  if (k === "apprentice") return "Core";
  if (k === "studio") return "Plus";
  if (k === "pro") return "Pro";
  if (k === "teams") return "Teams";
  if (k === "enterprise") return "Enterprise";
  if (k === "free") return "Free";
  if (k === "student") return "Student";
  if (k === "creator") return "Creator";
  if (k === "developer") return "Developer";
  return key || "Free";
}

// "Monday at 12:00 AM UTC" instead of an ISO string. The ISO timestamp
// in cap-blocked messages reads like a stack trace to a non-technical
// user. Returns a short human-friendly label that still conveys the
// reset moment unambiguously.
export function formatResetTime(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "Monday at 12:00 AM UTC";
  return d.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}
