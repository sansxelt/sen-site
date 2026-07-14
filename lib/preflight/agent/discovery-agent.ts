// Discovery agent (the first real agent) — proposes a Production Contract for a connected app so a new user
// is never dropped into a blank contract form (the onboarding friction the founder hit live).
//
// It runs through the governed agentCall (flag-gated, token-metered, key-safe, fail-soft). It is ADVISORY:
// the model proposes requirements + flows; the human reviews and approves them (never auto-approved). The
// model is never authoritative about facts — it proposes what to VERIFY, and the deterministic worker is
// what actually verifies. Returns null when the agent is disabled/unconfigured or on any error, so the
// existing manual-authoring path is always the fallback.

import { agentCall, agentConfigured } from "./agent-client";

export type ProposedRequirement = { requirement: string; category: string; severity: "critical" | "important" | "informational" };
export type ProposedFlowStep = { action: string; target?: string; value?: string; expect?: string };
export type ProposedFlow = { name: string; goal: string; priority: "critical" | "important" | "informational"; steps: ProposedFlowStep[] };
export type ContractProposal = { requirements: ProposedRequirement[]; flows: ProposedFlow[] };

// The structured-output schema the model must fill. Kept lean (flat, small) to stay reliable.
const PROPOSAL_SCHEMA = {
  name: "production_contract_proposal",
  description: "The critical requirements an app must keep, and the browser flows that verify them.",
  input_schema: {
    type: "object", additionalProperties: false, required: ["requirements", "flows"],
    properties: {
      requirements: {
        type: "array", maxItems: 8,
        items: {
          type: "object", additionalProperties: false, required: ["requirement", "category", "severity"],
          properties: {
            requirement: { type: "string", description: "One sentence, the promise the app must keep (e.g. 'A signed-in user's projects persist after refresh')." },
            category: { type: "string" },
            severity: { type: "string", enum: ["critical", "important", "informational"] },
          },
        },
      },
      flows: {
        type: "array", maxItems: 6,
        items: {
          type: "object", additionalProperties: false, required: ["name", "goal", "priority", "steps"],
          properties: {
            name: { type: "string" },
            goal: { type: "string" },
            priority: { type: "string", enum: ["critical", "important", "informational"] },
            steps: {
              type: "array", maxItems: 12,
              items: {
                type: "object", additionalProperties: false, required: ["action"],
                properties: {
                  action: { type: "string", description: "One of: navigate, click, fill, assert_visible, assert_text, assert_url, refresh, sign_in_as, verify_authenticated, sign_out." },
                  target: { type: "string" }, value: { type: "string" }, expect: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

export type DiscoveryInput = {
  owner: string;
  appName: string;
  appUrl: string;
  buildPrompt?: string | null;      // the original prompt the app was built with (strongest signal)
  contextNotes?: string | null;     // owner-provided product definition
  roles?: string[];                 // configured test-account roles (for sign_in_as steps)
};

export async function proposeContract(input: DiscoveryInput): Promise<ContractProposal | null> {
  if (!agentConfigured()) return null;  // flag off or no key -> caller uses manual authoring

  const roleLine = input.roles?.length ? `Configured sign-in roles: ${input.roles.join(", ")}. Use these exact labels in sign_in_as steps.` : "No test accounts are configured; propose UNAUTHENTICATED flows only (no sign_in_as).";
  const system = "You help define a Production Contract: the critical user journeys an AI-built app must keep before launch. Propose REQUIREMENTS (promises the app must keep) and FLOWS (browser steps that verify each). Be concrete and specific to this app. Navigation targets must be relative paths. Never invent a login flow if no role is configured. You propose what to VERIFY; a human approves it.";
  const prompt = [
    `App: ${input.appName}`,
    `URL: ${input.appUrl}`,
    input.buildPrompt ? `Original build prompt:\n${input.buildPrompt.slice(0, 4000)}` : null,
    input.contextNotes ? `Product notes:\n${input.contextNotes.slice(0, 2000)}` : null,
    roleLine,
    "Propose 3-6 critical requirements and a flow that verifies each. Prefer persistence, auth, and core-action journeys.",
  ].filter(Boolean).join("\n\n");

  const res = await agentCall({ purpose: "discovery", owner: input.owner, system, prompt, schema: PROPOSAL_SCHEMA, maxTokens: 2500 });
  if (!res.ok || res.json === undefined) return null;
  return sanitizeProposal(res.json);
}

// Validate + clamp the model output to the exact proposal shape — never trust the model's structure blindly.
export function sanitizeProposal(raw: unknown): ContractProposal | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const sev = (v: unknown): ProposedRequirement["severity"] => (v === "critical" || v === "important" || v === "informational" ? v : "important");
  const str = (v: unknown, max = 400): string => (typeof v === "string" ? v.slice(0, max) : "");
  const reqs = Array.isArray(o.requirements) ? o.requirements.slice(0, 8) : [];
  const flows = Array.isArray(o.flows) ? o.flows.slice(0, 6) : [];
  const requirements: ProposedRequirement[] = reqs.map((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    return { requirement: str(x.requirement), category: str(x.category, 60) || "general", severity: sev(x.severity) };
  }).filter((r) => r.requirement.length > 0);
  const proposedFlows: ProposedFlow[] = flows.map((f) => {
    const x = (f ?? {}) as Record<string, unknown>;
    const steps = Array.isArray(x.steps) ? x.steps.slice(0, 12) : [];
    return {
      name: str(x.name, 120), goal: str(x.goal, 200), priority: sev(x.priority),
      steps: steps.map((s) => {
        const y = (s ?? {}) as Record<string, unknown>;
        const step: ProposedFlowStep = { action: str(y.action, 40) };
        if (y.target) step.target = str(y.target);
        if (y.value) step.value = str(y.value);
        if (y.expect) step.expect = str(y.expect);
        return step;
      }).filter((s) => s.action),
    };
  }).filter((f) => f.name.length > 0 && f.steps.length > 0);
  if (requirements.length === 0 && proposedFlows.length === 0) return null;
  return { requirements, flows: proposedFlows };
}
