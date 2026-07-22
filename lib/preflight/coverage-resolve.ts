// The bounded correction loop.
//
// The gate found that a plan cannot prove the claim. This orchestrates at most one requirement correction and
// at most one flow correction to try to close the gap, then hands back a plan that EITHER passes both
// deterministic gates or is Blocked. It is deliberately not an open-ended agent loop: each stage runs at most
// once, there is no "keep calling the model until something passes", and the deterministic validators — not
// the model — decide at every step whether coverage is now sufficient.
//
// The two stages are independent and strictly ordered:
//   1. Requirement correction runs ONLY when claim coverage fails. If claim coverage still fails afterward, we
//      Block immediately and never touch flow correction — there is no point building a flow to prove a
//      guarantee the requirements still do not state.
//   2. Flow correction runs ONLY after claim coverage passes and execution coverage fails. A targeted recrawl
//      runs first, but only when the current discovery lacks the surfaces the correction needs.
//
// Nothing here launches a browser run, holds credit, or charges. It returns a resolution; the route decides
// what to do with it.
import type { Synthesis } from "./discover-synthesis";
import type { PageSnapshot } from "./discover-extract";
import {
  projectPlan, planRequirementTexts,
  type PlannedVerification, type PlanRequirement,
} from "./verification-lane";
import { checkClaimCoverage, checkExecutionCoverage, claimObligations, coverageGaps, type Coverage } from "./coverage";
import {
  defaultRequirementCorrector, defaultFlowCorrector, defaultRecrawler, discoveryCovers, focusPaths,
  type RequirementCorrector, type FlowCorrector, type Recrawler, type FlowCorrectionStatus,
} from "./coverage-correction";

export type Correctors = {
  correctRequirements: RequirementCorrector;
  correctFlows: FlowCorrector;
  recrawl: Recrawler;
};

const DEFAULT_CORRECTORS: Correctors = {
  correctRequirements: defaultRequirementCorrector,
  correctFlows: defaultFlowCorrector,
  recrawl: defaultRecrawler,
};

export type CoverageResolution = {
  /** The plan as first projected from synthesis, before any correction. */
  originalPlan: PlannedVerification;
  /** The final plan: the original, or a corrected-and-revalidated one. This is what a run would execute. */
  plan: PlannedVerification;
  claimBefore: Coverage;
  claimAfter: Coverage;         // === claimBefore when no requirement correction ran
  executionBefore: Coverage;
  executionAfter: Coverage;     // === executionBefore when no flow correction ran
  requirementCorrectionAttempted: boolean;
  flowCorrectionAttempted: boolean;
  recrawlAttempted: boolean;
  /** Diagnostics for the flow-correction stage, precise enough to name the exact failure boundary.
   *  status: where the model attempt landed (call failed / no content / parse failed / zero flows / ok, or
   *  not_run when the stage never ran, no_result when the corrector returned nothing at all).
   *  candidates: flows the model proposed. accepted: how many passed the designer validator. rejected: why
   *  each dropped. The original/final flow counts are on originalPlan/plan. */
  flowCorrectionStatus: FlowCorrectionStatus | "not_run" | "no_result";
  flowCorrectionCandidates: number;
  flowCorrectionAccepted: number;
  flowCorrectionRejected: { name: string; reason: string }[];
  /** The obligations still unproven when Blocked; empty when ready. */
  remainingObligations: string[];
  /** True only when BOTH deterministic gates pass. A paid run may begin only then. */
  readyToLaunch: boolean;
  /** A short machine reason when Blocked; null when ready. */
  blockedReason: string | null;
};

function norm(s: string): string { return s.trim().replace(/\s+/g, " ").toLowerCase(); }

// Merge corrected requirements into the existing set WITHOUT discarding any existing one. Existing come
// first; a corrected requirement is added only when its normalized text is not already present.
function mergeRequirements(existing: PlanRequirement[], corrected: PlanRequirement[]): PlanRequirement[] {
  const seen = new Set(existing.map((r) => norm(r.text)));
  const out = [...existing];
  for (const r of corrected) {
    const k = norm(r.text);
    if (r.text.trim() && !seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}

export async function resolveCoverage(
  deploymentUrl: string,
  claim: string,
  synth: Synthesis,
  pages: PageSnapshot[],
  opts?: { correctors?: Partial<Correctors> },
): Promise<CoverageResolution> {
  const correctors: Correctors = { ...DEFAULT_CORRECTORS, ...(opts?.correctors ?? {}) };
  const obligations = claimObligations(claim);
  const originalPlan = projectPlan(synth);

  let plan = originalPlan;
  let requirementCorrectionAttempted = false;
  let flowCorrectionAttempted = false;
  let recrawlAttempted = false;
  let flowCorrectionStatus: FlowCorrectionStatus | "not_run" | "no_result" = "not_run";
  let flowCorrectionCandidates = 0;
  let flowCorrectionAccepted = 0;
  let flowCorrectionRejected: { name: string; reason: string }[] = [];

  // ── Stage 1: claim coverage, then AT MOST ONE requirement correction ──────────────────────────────────
  const claimBefore = checkClaimCoverage(claim, planRequirementTexts(plan));
  let claimAfter = claimBefore;
  if (!claimBefore.ok) {
    requirementCorrectionAttempted = true;
    const corrected = await correctors.correctRequirements({
      claim, requirements: planRequirementTexts(plan), obligations, missing: claimBefore.missing,
    });
    if (corrected && corrected.length) {
      plan = { ...plan, requirements: mergeRequirements(plan.requirements, corrected) };
    }
    claimAfter = checkClaimCoverage(claim, planRequirementTexts(plan));
    if (!claimAfter.ok) {
      // Still missing after the single correction. Block — do NOT proceed to flow correction, launch, hold,
      // or charge. Flow correction never ran, so execution coverage is reported on the uncorrected flows
      // (requirement correction does not touch flows) for the response, not used as a gate.
      return blocked(originalPlan, plan, claimBefore, claimAfter,
        checkExecutionCoverage(claim, plan.flows),
        { requirementCorrectionAttempted, flowCorrectionAttempted, recrawlAttempted, flowCorrectionStatus, flowCorrectionCandidates, flowCorrectionAccepted, flowCorrectionRejected },
        "claim_coverage_incomplete_after_correction", claimAfter.missing);
    }
  }

  // ── Stage 2: execution coverage, then AT MOST ONE flow correction ─────────────────────────────────────
  const executionBefore = checkExecutionCoverage(claim, plan.flows);
  let executionAfter = executionBefore;
  if (!executionBefore.ok) {
    // Targeted recrawl FIRST, but only when the current discovery lacks the surfaces the correction needs.
    let workingPages = pages;
    if (!discoveryCovers(pages, obligations)) {
      recrawlAttempted = true;
      workingPages = await correctors.recrawl(deploymentUrl, focusPaths(pages, obligations), pages);
    }
    flowCorrectionAttempted = true;
    const fc = await correctors.correctFlows({
      claim, requirements: planRequirementTexts(plan), flows: plan.flows, obligations,
      missing: executionBefore.missing, pages: workingPages,
    });
    flowCorrectionStatus = fc ? fc.status : "no_result";
    flowCorrectionCandidates = fc?.candidates ?? 0;
    flowCorrectionAccepted = fc?.flows.length ?? 0;
    flowCorrectionRejected = fc?.rejected ?? [];
    const correctedFlows = fc?.flows ?? [];
    if (correctedFlows.length) {
      // The corrected set IS the repaired execution plan; it replaces the weak flows rather than sitting
      // beside them. Coverage below decides whether it is now sufficient.
      plan = { ...plan, flows: correctedFlows };
    }
    executionAfter = checkExecutionCoverage(claim, plan.flows);
    if (!executionAfter.ok) {
      return blocked(originalPlan, plan, claimBefore, claimAfter, executionAfter,
        { requirementCorrectionAttempted, flowCorrectionAttempted, recrawlAttempted, flowCorrectionStatus, flowCorrectionCandidates, flowCorrectionAccepted, flowCorrectionRejected },
        "execution_coverage_incomplete_after_correction", executionAfter.missing);
    }
  }

  // Both gates pass (originally, or after the bounded corrections).
  return {
    originalPlan, plan,
    claimBefore, claimAfter, executionBefore, executionAfter,
    requirementCorrectionAttempted, flowCorrectionAttempted, recrawlAttempted,
    flowCorrectionStatus, flowCorrectionCandidates, flowCorrectionAccepted, flowCorrectionRejected,
    remainingObligations: [],
    readyToLaunch: true,
    blockedReason: null,
  };
}

function blocked(
  originalPlan: PlannedVerification, plan: PlannedVerification,
  claimBefore: Coverage, claimAfter: Coverage, executionAfter: Coverage,
  attempts: {
    requirementCorrectionAttempted: boolean; flowCorrectionAttempted: boolean; recrawlAttempted: boolean;
    flowCorrectionStatus: FlowCorrectionStatus | "not_run" | "no_result";
    flowCorrectionCandidates: number; flowCorrectionAccepted: number; flowCorrectionRejected: { name: string; reason: string }[];
  },
  reason: string, remaining: string[],
): CoverageResolution {
  return {
    originalPlan, plan,
    claimBefore, claimAfter,
    executionBefore: executionAfter, executionAfter,
    ...attempts,
    remainingObligations: remaining,
    readyToLaunch: false,
    blockedReason: reason,
  };
}

// Convenience for callers that want every unproven obligation across both gates (used by the response).
export function resolutionGaps(r: CoverageResolution): string[] {
  if (r.readyToLaunch) return [];
  return coverageGaps({ claim: r.claimAfter, execution: r.executionAfter, readyToLaunch: false });
}
