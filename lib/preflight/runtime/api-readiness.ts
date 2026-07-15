// Readiness + preview for an API launch (API beta). Computes what the customer sees before launch AND the
// hard blockers the launch route enforces BEFORE billing — one source of truth so the preview can never say
// "ready to launch" while the launch would refuse (or vice-versa). Pure w.r.t. the injected data (the route
// loads target/build/flows/credentials and passes them in), so it is directly unit-testable.

import { validateApiSteps, apiFlowCredentials, type ApiFlowStep } from "./api-steps";

export type ReadinessBlocker =
  | "no_target"            // API target not created
  | "no_base_url"          // build/base URL not set
  | "no_flows"             // no enabled flows selected
  | "flow_invalid"         // a selected flow has an unsupported action / bad step
  | "credential_missing";  // a flow signs in with a credential label that no longer exists

export type ReadinessFlow = { id: string; name: string; priority: string; enabled: boolean; steps: unknown[] };
export type ReadinessInput = {
  hasTarget: boolean;
  baseUrl: string | null;
  environment: string | null;
  buildVersion: string | null;
  flows: ReadinessFlow[];
  selectedFlowIds: string[];       // which flows the customer chose to run
  credentialLabels: string[];      // labels of currently-saved credentials
};

export type ReadinessResult = {
  blockers: ReadinessBlocker[];
  launchable: boolean;
  selectedCount: number;
  // Human, customer-safe reason per blocker (no internal terms).
  reasons: string[];
};

const REASON: Record<ReadinessBlocker, string> = {
  no_target: "Create your API target first.",
  no_base_url: "Add your API base URL.",
  no_flows: "Select at least one flow to run.",
  flow_invalid: "A selected flow has a step that can't run. Open the flow and fix it.",
  credential_missing: "A selected flow uses a saved credential that no longer exists. Update the flow or re-add the credential.",
};

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const blockers: ReadinessBlocker[] = [];
  if (!input.hasTarget) blockers.push("no_target");
  if (!input.baseUrl) blockers.push("no_base_url");

  const selected = input.flows.filter((f) => input.selectedFlowIds.includes(f.id) && f.enabled);
  if (selected.length === 0) blockers.push("no_flows");

  const credSet = new Set(input.credentialLabels.map((c) => c.trim().toLowerCase()));
  for (const f of selected) {
    const v = validateApiSteps(f.steps, { credentialLabels: input.credentialLabels });
    if (!v.ok) { if (!blockers.includes("flow_invalid")) blockers.push("flow_invalid"); continue; }
    // Every credential a flow references must still exist (a revoked credential blocks BEFORE billing).
    for (const label of apiFlowCredentials(v.steps as ApiFlowStep[])) {
      if (!credSet.has(label.trim().toLowerCase())) { if (!blockers.includes("credential_missing")) blockers.push("credential_missing"); }
    }
  }

  return {
    blockers, launchable: blockers.length === 0, selectedCount: selected.length,
    reasons: blockers.map((b) => REASON[b]),
  };
}
