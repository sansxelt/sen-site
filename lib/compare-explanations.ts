import type { PricingPlanKey } from "./pricing";

export type CompareAnswers = {
  audience: "me" | "team" | "org";
  usage:    "light" | "daily" | "heavy" | "hardcore";
  api:      "no" | "maybe" | "yes";
};

/**
 * Deterministic, client-side "AI-style" explanations.
 *
 * Picks copy based on the user's actual answers so it feels personal —
 * references their audience choice, usage intensity, and API answer.
 * Revealed character-by-character in the UI so it reads like a model
 * is typing, but it's instant, offline, and costs nothing.
 *
 * Keep these under ~240 characters each — short is more confident.
 */
export function buildExplanation(
  planKey: PricingPlanKey,
  answers: CompareAnswers,
): string {
  const { audience, usage, api } = answers;

  switch (planKey) {
    case "free":
      return "For the light usage you described, free covers it — you'll rarely hit the 10K-request cap, and everything for Ask and Explore is included. If creative work ramps up later, Core is a two-click upgrade away.";

    case "apprentice": // Core
      if (usage === "light")
        return "Core is the sweet spot when usage is light but you want more than Free gives — $12/month unlocks priority generation and 5× the request cap, with no setup cost to trying it.";
      return "Core is the daily driver — $12/month gets you 5× Free's usage cap and priority generation, which matters once work runs through it every day. No API needed, which keeps the experience clean inside the app.";

    case "studio": // Plus
      if (api === "maybe")
        return "Plus gives you headroom for heavier creative work without jumping to Pro's price — 150K requests covers 'building real things' without stretch. If API access becomes essential later, Pro is the clean next step.";
      return "Plus is built for heavier creative work — 150K requests and richer output depth for polished deliverables, without Pro's price tag. You'll feel the upgrade immediately on larger files and visual tasks.";

    case "pro":
      if (api === "yes")
        return "Pro is the right call — you need API access, and it's the only personal plan that includes it. You also get the highest personal usage limits, which matters at the intensity you described.";
      if (usage === "hardcore")
        return "Pro is the right call at all-out usage — 500K requests, API access, and early access to advanced build features. It's the full personal tier, built for people who run everything through it.";
      return "Pro gives you the full personal build power — highest limits, API access, and advanced features. If the rest of your answers were lighter this would be overkill, but you'll grow into it.";

    case "teams":
      if (audience === "team")
        return "Teams is built for exactly what you described — shared libraries, team spaces, admin controls. Starts at 3 seats at $25/each. If it's closer to solo-with-occasional-collaboration, Pro is cheaper.";
      return "Teams is the collaborative tier — shared libraries and admin controls across 3+ seats. If most of the work is still yours alone, Pro is a better individual fit.";

    case "enterprise":
      return "Enterprise is the path for org-wide rollout — custom usage policies, dedicated support, business verification. Reach out through Contact and someone scopes the deployment shape with you.";

    default:
      return "Based on your answers, this plan fits your needs best. You can always change later from Billing.";
  }
}

/**
 * Simple heuristic — the one call that matters.  Claude used to do this
 * too; swapping it for rules saves credits and is instant.
 */
export function recommendPlanKey(answers: CompareAnswers): PricingPlanKey {
  if (answers.audience === "org")  return "enterprise";
  if (answers.audience === "team") return "teams";
  if (answers.api      === "yes")  return "pro";

  switch (answers.usage) {
    case "light":    return "free";
    case "daily":    return "apprentice";
    case "heavy":    return "studio";
    case "hardcore": return "pro";
  }
}
