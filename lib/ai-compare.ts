import Anthropic from "@anthropic-ai/sdk";
import { billingAddons, pricingPlans } from "./pricing";

/**
 * Lazy Anthropic client — only constructed on the server on first use, so
 * missing ANTHROPIC_API_KEY doesn't blow up at module load time.
 */
let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// ── Types ──────────────────────────────────────────────────────────────────

export type CompareAnswers = {
  audience: "me" | "team" | "org";
  usage:    "light" | "daily" | "heavy" | "hardcore";
  api:      "no" | "maybe" | "yes";
};

export type RecommendationInput = {
  answers: CompareAnswers;
  selectedPlanKeys: string[];
};

// ── Prompt builders ────────────────────────────────────────────────────────

/**
 * Build a lean JSON snapshot of the pricing catalog so Claude can reason over
 * it without having to read the whole pricing.ts source.  Kept short and
 * deterministic (no Date.now(), no non-stable iteration) so any future
 * caching additions are possible.
 */
function buildCatalog(): string {
  const plans = pricingPlans.map((p) => ({
    key:           p.key,
    name:          p.name,
    segment:       p.segment,
    price_monthly: p.monthlyLabel,
    price_yearly:  p.yearlyLabel ?? null,
    monthly_usd:   p.monthlyValue,
    api_requests:  p.apiRequestLimit,
    memory:        p.memoryWindow,
    credits:       p.monthlyCredits,
    seats:         p.seats,
    support:       p.support,
    description:   p.description,
    key_features:  p.points,
  }));
  const addons = billingAddons.map((a) => ({
    key: a.key, name: a.name, price: a.monthlyLabel, description: a.description,
  }));
  return JSON.stringify({ plans, addons }, null, 2);
}

const AUDIENCE_LABELS: Record<CompareAnswers["audience"], string> = {
  me:   "Personal use — individual workflows and projects",
  team: "A small team sharing outputs and collaboration",
  org:  "A whole organization — enterprise rollout",
};

const USAGE_LABELS: Record<CompareAnswers["usage"], string> = {
  light:    "Light — just a handful of questions a day",
  daily:    "Daily driver — most creative work runs through it",
  heavy:    "Heavy — building real products and deliverables",
  hardcore: "All-out — every day, all day, everything",
};

const API_LABELS: Record<CompareAnswers["api"], string> = {
  no:    "No — will stay inside sansxel",
  maybe: "Maybe someday — could wire it in later",
  yes:   "Yes — essential, plugging it into own apps / workflows",
};

function buildUserMessage(input: RecommendationInput): string {
  const comparedNames = input.selectedPlanKeys
    .map((k) => pricingPlans.find((p) => p.key === k)?.name ?? k)
    .join(", ");

  return `My answers:
- Audience:   ${AUDIENCE_LABELS[input.answers.audience]}
- Usage:      ${USAGE_LABELS[input.answers.usage]}
- API access: ${API_LABELS[input.answers.api]}

Plans I'm comparing: ${comparedNames}

Pick the best-fit plan for me from the catalog and explain why in 2 short sentences, talking TO me.`;
}

const SYSTEM_PROMPT = (catalogJson: string) => `You are sansxel's pricing advisor. You know the full plan + addon catalog (below) and must pick the single best plan for the user's needs.

Be direct, confident, conversational. Write as if you're talking to one person — use "you", never third-person "the user". No hedging, no "it depends".

Favor the lowest-cost plan that actually meets their needs. Only recommend upgrades when their answers require it (Pro for personal API access, Teams for multi-seat, Enterprise only for verified-org requests). If they're comparing plans that include one clearly better fit, pick that.

RESPOND IN EXACTLY THIS FORMAT (nothing before, nothing after):

PLAN_KEY=<one of: free, apprentice, studio, pro, teams, enterprise>

<2 short sentences. No bullet lists, no markdown headings. Speak directly to the user.>

CATALOG:
${catalogJson}`;

// ── Streaming helper ───────────────────────────────────────────────────────

/**
 * Kick off a streaming Anthropic call and return the raw SDK stream.  The
 * API route that calls this is responsible for transforming the stream
 * into an HTTP response (plain text chunks) for the browser.
 *
 * Uses claude-opus-4-7 with thinking disabled — this is a fast
 * classification task, thinking tokens would add latency we don't want.
 */
export function streamRecommendation(input: RecommendationInput) {
  return getAnthropic().messages.stream({
    model:      "claude-opus-4-7",
    max_tokens: 400,
    thinking:   { type: "disabled" },
    system:     SYSTEM_PROMPT(buildCatalog()),
    messages:   [{ role: "user", content: buildUserMessage(input) }],
  });
}
