// Vraelis Rank — plan entitlements. One resolver; enforce server-side at every
// action boundary (create test, launch, add-on, API). Prices live in Stripe.

export type Plan = "free" | "starter" | "creator" | "pro" | "scale" | "enterprise";

export type Entitlements = {
  plan: Plan;
  monthlyCredits: number;
  activeTestsPerMonth: number;
  maxOptions: number;
  maxVotes: number;
  targeting: boolean;
  api: boolean;
  discord: boolean;
};

const TABLE: Record<Plan, Omit<Entitlements, "plan">> = {
  // Free: credits are the real limiter, not the run quota. With 25 starter credits and the
  // MIN_VOTES=10 floor, a Free user can afford at most ~2 runs, so a cap of 3 means credits
  // (never the quota) gate usage — the point of starter credits is to let people try it.
  free:       { monthlyCredits: 0,      activeTestsPerMonth: 3,     maxOptions: 4, maxVotes: 100,  targeting: false, api: false, discord: false },
  starter:    { monthlyCredits: 150,    activeTestsPerMonth: 3,     maxOptions: 5, maxVotes: 300,  targeting: false, api: false, discord: false },
  creator:    { monthlyCredits: 500,    activeTestsPerMonth: 10,    maxOptions: 6, maxVotes: 500,  targeting: true,  api: false, discord: false },
  pro:        { monthlyCredits: 2000,   activeTestsPerMonth: 30,    maxOptions: 8, maxVotes: 1000, targeting: true,  api: false, discord: true  },
  scale:      { monthlyCredits: 7500,   activeTestsPerMonth: 100,   maxOptions: 8, maxVotes: 2000, targeting: true,  api: true,  discord: true  },
  enterprise: { monthlyCredits: 999999, activeTestsPerMonth: 99999, maxOptions: 8, maxVotes: 5000, targeting: true,  api: true,  discord: true  },
};

export function entitlements(plan: string | null | undefined): Entitlements {
  const p: Plan = plan && plan in TABLE ? (plan as Plan) : "free";
  return { plan: p, ...TABLE[p] };
}

// New signed-in users get a small one-time credit grant so they can try the
// loop before any payment. Abuse-gated by one-grant-per-account (see v-credits).
export const SIGNUP_FREE_CREDITS = 25;

// MVP guardrails.
export const MIN_OPTIONS = 2;
export const MIN_VOTES = 10;
export const MAX_VOTES_FREE = 100;

// API access is a Scale+ feature. VRAELIS_API_ALLOW (comma-separated emails)
// allowlists specific accounts regardless of plan — e.g. for testing.
// The VERSIONED catalog keys that carry API access. Held separately from TABLE rather than added to it,
// because the two vocabularies are deliberately distinct: "scale" and "scale_v1" are different products
// that happen to share a word, and the legacy meanings are never reused.
const V1_API_PLANS = new Set(["scale_v1"]);

/**
 * May this account use the public API?
 *
 * `planV1` IS NOT OPTIONAL IN PRACTICE, and leaving it out was a real outage for paying customers.
 *
 * A versioned-plan subscriber has no v_subscriptions row, so getPlan returns "free". And "scale_v1" is not
 * a key in TABLE, so entitlements() falls back to free as well. Two independent reasons, same answer: every
 * caller that passed only the legacy plan refused API access to someone paying $399 a month for the plan
 * whose headline feature is the API. That closed key creation AND every request an existing key made.
 */
export function apiAccessAllowed(plan: string | null | undefined, email: string, planV1?: string | null): boolean {
  if (planV1 && V1_API_PLANS.has(planV1.trim())) return true;
  if (entitlements(plan).api) return true;
  const allow = (process.env.VRAELIS_API_ALLOW || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return allow.includes((email || "").trim().toLowerCase());
}

// API RUNTIME access — which accounts may use the customer-facing API verification product (distinct from
// the Rank `.api` entitlement above, which gates the older programmatic API). The API runtime engine is
// live and generally available: by DEFAULT every signed-in account is allowed. The optional allowlist
// VRAELIS_API_RUNTIME_BETA (comma-separated emails) is now a *restriction* — if it is set, access is
// narrowed to only those emails; if it is empty/unset, all signed-in accounts have access. This lets us
// re-restrict instantly without a deploy while keeping the surface open by default. Combined with the
// apiRuntimeEnabled() kill switch, the surface is fail-OPEN for enabled accounts but instantly closable.
export function apiRuntimeBetaAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.VRAELIS_API_RUNTIME_BETA || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  if (allow.length === 0) return true; // no allowlist configured -> generally available to any signed-in account
  return allow.includes(email.trim().toLowerCase());
}

// ── One-time credit top-up limits ──────────────────────────────────────────────
// $999,999.99 is the hard ceiling for a SINGLE Stripe charge (99,999,999 cents).
// So this is the max any one top-up checkout can be, for everyone.
export const TOPUP_MIN_DOLLARS = 5;
export const STRIPE_MAX_SINGLE_CHARGE_DOLLARS = 999_999;

// An account is "elevated" if it's on Scale (or in the VRAELIS_ELEVATED_TOPUP
// allowlist — the admin-grant path: sales approves, ops adds the email). Elevated
// accounts still can't exceed the Stripe single-charge ceiling in ONE payment, but
// they're offered a contact-for-invoice path for amounts above it (invoicing/
// multi-charge is a future build — see topupOverCeilingSupported).
export function isElevatedTopup(plan: string | null | undefined, email: string): boolean {
  if (entitlements(plan).plan === "scale" || entitlements(plan).plan === "enterprise") return true;
  const allow = (process.env.VRAELIS_ELEVATED_TOPUP || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return allow.includes((email || "").trim().toLowerCase());
}

// The max a SINGLE top-up checkout may charge for this account, in dollars.
// Everyone is capped at the Stripe single-charge ceiling; the elevated flag doesn't
// raise the per-charge max (Stripe won't allow it) — it unlocks the over-ceiling
// contact path in the UI instead.
export function topupMaxDollars(): number {
  return STRIPE_MAX_SINGLE_CHARGE_DOLLARS;
}

// Admin access (data requests + audit review). VRAELIS_ADMIN = comma-separated emails.
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = (process.env.VRAELIS_ADMIN || "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  return allow.includes(email.trim().toLowerCase());
}

// The lead-agent / intake-widget product (the embeddable /widget.js chat widget + the hosted /f/[key] intake
// form + the /api/vraelis/intake endpoints) is RETIRED. Its code and DB tables are preserved, but the public
// surface is off unless VRAELIS_LEAD_AGENT is "1". Default OFF, so the intake form 404s and the intake API
// refuses — no retired lead-agent product is publicly operational.
export function leadAgentEnabled(): boolean {
  return process.env.VRAELIS_LEAD_AGENT === "1";
}
