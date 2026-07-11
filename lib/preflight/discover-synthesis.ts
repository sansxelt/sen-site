// AI discovery synthesis. Turns the DETERMINISTIC snapshot (+ the original build prompt) into evidence-
// backed product requirements + flows via strict structured output. The model is NEVER authoritative about
// the browser or facts: every suggestion must carry provenance, and support is classified so best-practice
// items don't masquerade as observed facts. Fail-soft (returns null on any model error) so discovery keeps
// its last successful result. Reuses the evaluator's model/key env.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { PageSnapshot } from "./discover-extract";
import type { Suggestion, SourceRef } from "./contract-merge";
import type { Severity } from "../v-applications";

// Read lazily (call time) so env loaded after import order — and the Next runtime — still resolve.
const apiKey = () => process.env.VRAELIS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
const model = () => process.env.VRAELIS_EVAL_MODEL || "claude-sonnet-4-6";
export function synthesisConfigured(): boolean { return !!apiKey(); }

const Sev = z.enum(["critical", "important", "informational"]);
const Support = z.enum(["explicit", "strong_inference", "best_practice"]);
const Src = z.object({ type: z.string(), url: z.string().optional(), reference: z.string() });

// Lean schema (kept flat to stay under the structured-output complexity limit): flows carry compact steps.
const SynthSchema = z.object({
  product_summary: z.string(),
  product_type: z.string(),
  roles: z.array(z.string()),
  capabilities: z.array(z.string()),
  data_entities: z.array(z.string()),
  integrations: z.array(z.string()),
  requirements: z.array(z.object({ text: z.string(), category: z.string(), severity: Sev, confidence: z.number(), support: Support, sources: z.array(Src) })),
  flows: z.array(z.object({ name: z.string(), goal: z.string(), role: z.string(), priority: Sev, start_path: z.string(), auth_required: z.boolean(), mobile_relevant: z.boolean(), steps: z.array(z.object({ action: z.string(), target: z.string(), value: z.string(), expect: z.string() })), requirement_refs: z.array(z.string()) })),
  uncertainties: z.array(z.string()),
});
export type Synthesis = z.infer<typeof SynthSchema>;
export type SynthReq = Synthesis["requirements"][number];

// Compact, bounded view of the deterministic snapshot for the prompt (no raw HTML).
function describe(pages: PageSnapshot[]): string {
  return pages.slice(0, 12).map((p) => {
    const forms = p.forms.map((f) => `${f.method} ${f.action} [${f.inputs.map((i) => `${i.name}:${i.type}`).join(",")}] (${f.submitLabels.join("/")})`).join("; ");
    return `PAGE ${p.url}\n  title: ${p.title}\n  headings: ${p.headings.slice(0, 8).join(" | ")}\n  nav: ${p.navLinks.slice(0, 12).map((l) => l.label).join(", ")}\n  ctas: ${p.ctas.slice(0, 12).join(", ")}\n  forms: ${forms}\n  indicators: ${p.indicators.join(", ")}\n  roles_seen: ${p.roles.join(", ")}\n  api: ${p.apiRefs.join(", ")}`;
  }).join("\n\n").slice(0, 12000);
}

export async function synthesize(pages: PageSnapshot[], buildPrompt: string | null): Promise<Synthesis | null> {
  const API_KEY = apiKey();
  if (!API_KEY || !pages.length) return null;
  const prompt =
    `You map an already-built web app to its production promises. You are given (1) the ORIGINAL BUILD PROMPT the maker used, and (2) a DETERMINISTIC snapshot of the deployed app's public pages (titles, headings, nav, forms, buttons, capability indicators, routes, same-origin API refs). Both are evidence.\n\n` +
    `Return: a short product_summary, product_type, roles, capabilities, data_entities, integrations, a list of production requirements, a list of concrete browser test flows, and uncertainties.\n\n` +
    `HARD RULES:\n` +
    `- Every requirement and flow MUST cite sources (type original_prompt | discovered_page with the url + a short reference to the exact evidence). No evidence, no item.\n` +
    `- Classify each requirement's support: explicit (stated in the prompt or directly visible), strong_inference (clearly implied by real evidence), or best_practice (a general convention).\n` +
    `- Do NOT invent authentication, payments, teams, file uploads, admin roles, or ROUTES that are not in the evidence. Do not turn generic SaaS conventions into facts about THIS product.\n` +
    `- Prefer state-integrity requirements (does created data persist across refresh / new session) when a create action is observed.\n` +
    `- Flow steps use ONLY these actions: navigate, click, fill, select, check, uncheck, press, wait_for, assert_visible, assert_text, assert_url, refresh, screenshot. Targets are SEMANTIC accessible names (e.g. the button labeled "Create project"), never CSS/XPath. Set unused string fields to "".\n` +
    `- severity/priority: critical only for launch-blocking promises (auth, persistence, authorization, payment). Write plainly; no em dashes.\n\n` +
    `ORIGINAL BUILD PROMPT:\n${(buildPrompt || "(none provided)").slice(0, 6000)}\n\n` +
    `DETERMINISTIC SNAPSHOT:\n${describe(pages)}`;
  try {
    const client = new Anthropic({ apiKey: API_KEY, timeout: 50_000, maxRetries: 0 });
    const res = await client.messages.parse({ model: model(), max_tokens: 4000, temperature: 0, messages: [{ role: "user", content: prompt }], output_config: { format: zodOutputFormat(SynthSchema) } });
    return res.parsed_output ?? null;
  } catch (e) { console.error("discover synthesis failed:", (e as Error).message); return null; }
}

// support -> whether the requirement is enabled by default when first inserted.
//   explicit -> enabled; strong_inference -> enabled (review); best_practice -> disabled until approved.
export function enabledDefault(support: SynthReq["support"]): boolean { return support === "explicit" || support === "strong_inference"; }

// Map synthesized requirements to merge Suggestions (planMerge assigns fingerprints + review state).
export function toSuggestions(s: Synthesis): (Suggestion & { support: SynthReq["support"]; enabledDefault: boolean })[] {
  return s.requirements.slice(0, 60).map((r) => ({
    requirement: r.text.slice(0, 400), category: (r.category || "general").slice(0, 60), severity: (r.severity as Severity),
    source_refs: (r.sources || []).slice(0, 8) as SourceRef[], confidence: r.confidence, reasoning_summary: undefined,
    support: r.support, enabledDefault: enabledDefault(r.support),
  }));
}
