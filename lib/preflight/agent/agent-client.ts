// Governed agent client (the "agent that does things", à la Stripe's) — Multi-Platform Program.
//
// A thin, SAFE wrapper over the Anthropic SDK for autonomous verification/repair/authoring agents. It does
// three things the raw SDK does not, which are the whole point of gating a billable capability:
//   1. FLAG-GATED: does nothing unless VRAELIS_AGENT=1. Default OFF, so no agent call — and no spend — can
//      happen until the operator knowingly turns it on. agentEnabled() is the single gate.
//   2. METERED: every call's token usage is recorded through the EXISTING cost governor
//      (recordProviderCost({ aiTokens })), so AI spend rides the same hourly/daily ceilings + auto-pause
//      that protect browser spend. An agent can never outrun the governor.
//   3. KEY-SAFE: reads process.env.ANTHROPIC_API_KEY (or VRAELIS_LLM_API_KEY) at call time. The key is
//      never printed, returned, logged, or embedded — it stays in the environment.
//
// Callers pass a purpose (for the audit trail) and a prompt/schema; they never touch the SDK or the key.
// Fail-soft: returns null on any error (a missing key, a flag-off, a model error, a governor pause), so an
// agent feature degrades to "not available" and never breaks the deterministic core.

import Anthropic from "@anthropic-ai/sdk";
import { recordProviderCost, isRunsGovernorPaused } from "../cost-governor";

// The gate: agents are OFF unless explicitly enabled. Checked first everywhere.
export function agentEnabled(): boolean { return process.env.VRAELIS_AGENT === "1"; }

// Key resolution — same precedence as the existing discovery synthesis (reuse the configured key).
function apiKey(): string | undefined { return process.env.VRAELIS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY; }
export function agentConfigured(): boolean { return agentEnabled() && !!apiKey(); }

// Default agent model — the balanced tier, overridable by env. Never Opus-tier by default (cost control).
function agentModel(): string { return process.env.VRAELIS_AGENT_MODEL || "claude-sonnet-4-6"; }

export type AgentPurpose = "discovery" | "repair" | "flow_authoring" | "cross_platform_map";

export type AgentCallInput = {
  purpose: AgentPurpose;
  owner: string;                 // for the cost-governor attribution + audit
  system?: string;
  prompt: string;
  maxTokens?: number;            // hard output cap (cost control); default modest
  // When provided, the model is forced to emit exactly this JSON shape via a single tool call.
  schema?: { name: string; description: string; input_schema: Record<string, unknown> };
};

export type AgentResult = { ok: true; text: string; json?: unknown; inputTokens: number; outputTokens: number } | { ok: false; reason: string };

// The one call every agent goes through. Flag-gated, metered, key-safe, fail-soft.
export async function agentCall(input: AgentCallInput): Promise<AgentResult> {
  if (!agentEnabled()) return { ok: false, reason: "agent_disabled" };            // default OFF
  const key = apiKey();
  if (!key) return { ok: false, reason: "no_api_key" };
  // Respect the global cost governor: if runs are paused (budget tripped/operator), do not spend on agents.
  try { if (await isRunsGovernorPaused()) return { ok: false, reason: "governor_paused" }; } catch { /* fail-open on the read, the token meter still caps */ }

  const maxTokens = Math.min(Math.max(256, input.maxTokens ?? 1500), 4096);       // bounded output = bounded cost
  const client = new Anthropic({ apiKey: key, timeout: 60_000, maxRetries: 0 });

  try {
    const req: Record<string, unknown> = {
      model: agentModel(), max_tokens: maxTokens,
      system: input.system, messages: [{ role: "user", content: input.prompt }],
    };
    if (input.schema) {
      req.tools = [{ name: input.schema.name, description: input.schema.description, input_schema: input.schema.input_schema }];
      req.tool_choice = { type: "tool", name: input.schema.name };
    }
    const res = await client.messages.create(req as never) as unknown as {
      content: { type: string; text?: string; input?: unknown }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const inputTokens = res.usage?.input_tokens ?? 0;
    const outputTokens = res.usage?.output_tokens ?? 0;

    // METER: record AI-token spend through the existing governor (never a separate uncapped path).
    try { await recordProviderCost({ owner: input.owner, runId: null, aiTokens: inputTokens + outputTokens }); } catch { /* metering best-effort; never blocks */ }

    // Structured (tool) result.
    if (input.schema) {
      const toolBlock = res.content.find((b) => b.type === "tool_use");
      if (toolBlock && toolBlock.input !== undefined) return { ok: true, text: "", json: toolBlock.input, inputTokens, outputTokens };
      return { ok: false, reason: "no_tool_output" };
    }
    // Text result.
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    return { ok: true, text, inputTokens, outputTokens };
  } catch (e) {
    // Fail-soft: never surface the key or a raw provider error to the caller.
    return { ok: false, reason: `agent_error: ${(e as Error).message.slice(0, 120)}` };
  }
}
