// sansxel-1 model registry. The user-facing tier names ("fast",
// "balanced", "smart") map to specific Anthropic model IDs and are
// gated by subscription plan. Keeping this in one place so backend
// routing and frontend pickers stay in sync.

export type ModelTier = "fast" | "balanced" | "smart";

export type PlanKey =
  | "free"
  | "apprentice"
  | "studio"
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
  apprentice: 1,
  studio: 1,
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
