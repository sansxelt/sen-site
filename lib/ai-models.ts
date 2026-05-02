// sansxel-1 model registry. The user-facing tier names ("fast",
// "balanced", "smart") map to specific Anthropic model IDs and are
// gated by subscription plan. Keeping this in one place so backend
// routing and frontend pickers stay in sync.

export type ModelTier = "fast" | "balanced" | "smart";

export type PlanKey =
  | "free"
  | "student"
  | "apprentice"
  | "creator"
  | "studio"
  | "developer"
  | "pro"
  | "teams"
  | "enterprise";

export type ModelDescriptor = {
  tier: ModelTier;
  model: string; // Anthropic model id used in messages.stream({ model })
  display_name: string; // shown in the UI
  blurb: string; // shown in the picker tooltip
  // Lowest plan that may select this tier. "free" means everyone.
  min_plan: PlanKey;
};

export const MODEL_REGISTRY: ReadonlyArray<ModelDescriptor> = [
  {
    tier: "fast",
    model: "claude-haiku-4-5-20251001",
    display_name: "sansxel-1 fast",
    blurb: "Quick replies, simple tasks. Free for all plans.",
    min_plan: "free",
  },
  {
    tier: "balanced",
    model: "claude-sonnet-4-6",
    display_name: "sansxel-1",
    blurb: "Default. Strong on writing, code, planning. Apprentice plan and up.",
    min_plan: "apprentice",
  },
  {
    tier: "smart",
    model: "claude-opus-4-7",
    display_name: "sansxel-1 deep",
    blurb: "Heaviest reasoning. Long context. Pro plan and up.",
    min_plan: "pro",
  },
];

const PLAN_RANK: Record<PlanKey, number> = {
  free: 0,
  student: 0,
  apprentice: 1,
  creator: 1,
  studio: 1,
  developer: 2,
  pro: 2,
  teams: 3,
  enterprise: 3,
};

export function planAllowsTier(plan: PlanKey, tier: ModelTier): boolean {
  const desc = MODEL_REGISTRY.find((m) => m.tier === tier);
  if (!desc) return false;
  return PLAN_RANK[plan] >= PLAN_RANK[desc.min_plan];
}

// Best tier the plan is allowed to use, given a preferred one.
// Falls back to the highest allowed tier ≤ preferred.
export function resolveTier(plan: PlanKey, requested: ModelTier): ModelTier {
  if (planAllowsTier(plan, requested)) return requested;
  // Walk down the list, registry is ordered fast → smart, so reverse.
  const allowed = [...MODEL_REGISTRY]
    .reverse()
    .find((m) => PLAN_RANK[plan] >= PLAN_RANK[m.min_plan]);
  return allowed?.tier ?? "fast";
}

export function tiersForPlan(plan: PlanKey): ModelDescriptor[] {
  return MODEL_REGISTRY.filter((m) => planAllowsTier(plan, m.tier));
}

export function descriptorForTier(tier: ModelTier): ModelDescriptor {
  const found = MODEL_REGISTRY.find((m) => m.tier === tier);
  if (!found) throw new Error(`Unknown tier: ${tier}`);
  return found;
}

// v0.2.0 phase G — side-by-side model duel.
// The duel surface is opinionated: one column is GPT, one is Claude.
// We don't expose tier picking inside duel mode (the moat is "compare
// the two intelligences", not "pick a tier per side"). The Claude
// side always uses our default chat tier (balanced sonnet-4-6); the
// GPT side uses whichever DUEL_GPT_MODEL is configured below.
//
// DUEL_GPT_MODEL is read from env at runtime so we can flip to gpt-5
// in the dashboard the moment it lands in our OpenAI account, no
// redeploy. Falls back to gpt-4o if unset or empty.
export const DUEL_CLAUDE_MODEL = "claude-sonnet-4-6" as const;

export function getDuelGptModel(): string {
  const fromEnv = (process.env.DUEL_GPT_MODEL ?? "").trim();
  return fromEnv || "gpt-4o";
}

export type DuelSide = "left" | "right";

// Display labels at the top of each duel column. Locked to GPT / Claude
// so the user instantly understands what they're comparing, even if
// the underlying model id changes (gpt-4o → gpt-5, sonnet-4-6 →
// sonnet-4-7, etc.).
export const DUEL_SIDE_LABELS: Record<DuelSide, string> = {
  left: "GPT",
  right: "Claude",
};
