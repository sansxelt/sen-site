// AI discovery synthesis. Turns the DETERMINISTIC snapshot (+ the original build prompt + the owner's
// product-definition context + connection presence signals) into evidence-backed product requirements +
// flows via strict structured output. The model is NEVER authoritative about the browser or facts: every
// suggestion must carry provenance, and support is classified so best-practice items don't masquerade as
// observed facts. Each requirement is additionally attributed to the SINGLE STRONGEST input that justified
// it (a closed provenance set, validated server-side; anything unrecognized degrades to "inference").
// Fail-soft (returns null on any model error) so discovery keeps its last successful result. Without an
// API key the deterministic connectionSignalSuggestions path still works (pure, no AI). Reuses the
// evaluator's model/key env.
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

// ── Provenance (S7): the closed set a generated requirement's `source` column may carry ────────────────
// prompt = the original build prompt; summary = the guided product-definition fields (summary/goal/roles/
// workflows/data/auth_expect/billing_expect/risks); prd = a pasted PRD or requirements doc; readme = a
// pasted README; connection:<kind> = a connection presence signal; manual = added by the owner by hand
// (never AI-assigned); inference = Vraelis inferred it without a single justifying input.
export const PROVENANCE_SOURCES = [
  "prompt", "summary", "prd", "readme",
  "connection:stripe_test", "connection:supabase", "connection:sentry", "connection:github",
  "manual", "inference",
] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

// Server-side validator for the AI's per-requirement source tag. Fail-closed: anything outside the closed
// set — or outside the inputs that were actually AVAILABLE to this synthesis — degrades to "inference".
// "manual" is never a valid AI attribution (only the owner's own adds record it).
export function normalizeProvenanceSource(raw: unknown, available?: Iterable<string>): ProvenanceSource {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!(PROVENANCE_SOURCES as readonly string[]).includes(v) || v === "manual") return "inference";
  if (available) {
    const set = available instanceof Set ? available : new Set(available);
    if (v !== "inference" && !set.has(v)) return "inference";
  }
  return v as ProvenanceSource;
}

// The extra synthesis inputs (S7). `sources` are the application's product-definition context entries
// (kind + content, content already persisted bounded); `connections` are the connected provider kinds.
export type SynthContext = {
  sources: { kind: string; content: string }[];
  connections: string[];
};

// Which context kinds ride into the prompt, and which provenance tag each one justifies. The guided
// product-definition fields all collapse to "summary"; documents map to prd/readme; the prompt kind is
// excluded here because the original build prompt rides its own prompt section.
const CONTEXT_KIND_TAG: Record<string, ProvenanceSource> = {
  summary: "summary", goal: "summary", roles: "summary", workflows: "summary",
  data: "summary", auth_expect: "summary", billing_expect: "summary", risks: "summary",
  prd: "prd", requirements: "prd", readme: "readme",
};

// Connection kinds that produce a presence signal in the prompt (github contributes naming context only).
const CONNECTION_GUIDANCE: Record<string, string> = {
  stripe_test: "stripe_test (Stripe in test mode) is connected: propose billing-flow requirements (checkout starts, a test-mode payment completes, the paid state is reflected). Tag them connection:stripe_test.",
  supabase: "supabase is connected: propose persistence and state-integrity requirements (created data survives refresh and a new session). Tag them connection:supabase.",
  sentry: "sentry is connected: propose a requirement that core flows complete without unhandled errors. Tag it connection:sentry.",
  github: "github is connected: use it for NAMING context only. Do NOT derive requirements from it.",
};

// The provenance tags this synthesis may legitimately assign, given what was actually provided.
export function availableProvenance(buildPrompt: string | null, context?: SynthContext): Set<ProvenanceSource> {
  const out = new Set<ProvenanceSource>(["inference"]);
  if (buildPrompt && buildPrompt.trim()) out.add("prompt");
  for (const s of context?.sources ?? []) {
    const tag = CONTEXT_KIND_TAG[s.kind];
    if (tag && s.content.trim()) out.add(tag);
  }
  for (const c of context?.connections ?? []) {
    const tag = `connection:${c}`;
    if ((PROVENANCE_SOURCES as readonly string[]).includes(tag)) out.add(tag as ProvenanceSource);
  }
  return out;
}

const Sev = z.enum(["critical", "important", "informational"]);
const Support = z.enum(["explicit", "strong_inference", "best_practice"]);
const Src = z.object({ type: z.string(), url: z.string().optional(), reference: z.string() });

// Lean schema (kept flat to stay under the structured-output complexity limit): flows carry compact steps.
// `justified_by` is the AI's single-strongest-source attribution, validated by normalizeProvenanceSource.
const SynthSchema = z.object({
  product_summary: z.string(),
  product_type: z.string(),
  roles: z.array(z.string()),
  capabilities: z.array(z.string()),
  data_entities: z.array(z.string()),
  integrations: z.array(z.string()),
  requirements: z.array(z.object({ text: z.string(), category: z.string(), severity: Sev, confidence: z.number(), support: Support, justified_by: z.string(), sources: z.array(Src) })),
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

// Compact, bounded view of the product-definition context for the prompt. Per-source content is capped at
// CONTEXT_SOURCE_CAP chars and the whole section at CONTEXT_SECTION_CAP (same order of magnitude as the
// existing prompt caps: 6k for the build prompt, 12k for the snapshot). Kinds outside CONTEXT_KIND_TAG
// (e.g. the prompt kind, which rides its own section) are skipped.
const CONTEXT_SOURCE_CAP = 2000;
const CONTEXT_SECTION_CAP = 12000;
function describeContext(context: SynthContext): string {
  const lines = context.sources
    .filter((s) => CONTEXT_KIND_TAG[s.kind] && s.content.trim())
    .slice(0, 12)
    .map((s) => `${s.kind.toUpperCase()} (tag: ${CONTEXT_KIND_TAG[s.kind]}):\n${s.content.trim().slice(0, CONTEXT_SOURCE_CAP)}`);
  return lines.join("\n\n").slice(0, CONTEXT_SECTION_CAP);
}

function describeConnections(context: SynthContext): string {
  const known = Array.from(new Set(context.connections)).filter((c) => CONNECTION_GUIDANCE[c]);
  return known.map((c) => `- ${CONNECTION_GUIDANCE[c]}`).join("\n");
}

// The full synthesis prompt, exported PURE so the test suite can prove context inclusion + bounds without
// a model call. Sections for the product context and connection signals only appear when present.
export function buildSynthesisPrompt(pages: PageSnapshot[], buildPrompt: string | null, context?: SynthContext): string {
  const available = availableProvenance(buildPrompt, context);
  const contextBlock = context ? describeContext(context) : "";
  const connectionBlock = context ? describeConnections(context) : "";
  return (
    `You map an already-built web app to its production promises. You are given (1) the ORIGINAL BUILD PROMPT the maker used, (2) a DETERMINISTIC snapshot of the deployed app's public pages (titles, headings, nav, forms, buttons, capability indicators, routes, same-origin API refs)` +
    `${contextBlock ? ", (3) the maker's own PRODUCT CONTEXT (their stated summary, goals, roles, workflows, data, auth and billing expectations, risks, and pasted documents)" : ""}` +
    `${connectionBlock ? ", and the app's CONNECTED SERVICES (presence signals)" : ""}. All of it is evidence.\n\n` +
    `Return: a short product_summary, product_type, roles, capabilities, data_entities, integrations, a list of production requirements, a list of concrete browser test flows, and uncertainties.\n\n` +
    `HARD RULES:\n` +
    `- Every requirement and flow MUST cite sources (type original_prompt | discovered_page with the url + a short reference to the exact evidence). No evidence, no item.\n` +
    `- Every requirement MUST set justified_by to the SINGLE STRONGEST input that justified it, chosen ONLY from: ${Array.from(available).join(" | ")}. Use "prompt" for the original build prompt, "summary" for the maker's product context fields, "prd" for a PRD or requirements document, "readme" for a README, "connection:<kind>" when a connected service is the reason, and "inference" when no single input justifies it.\n` +
    `- Classify each requirement's support: explicit (stated in the prompt or directly visible), strong_inference (clearly implied by real evidence), or best_practice (a general convention).\n` +
    `- Do NOT invent authentication, payments, teams, file uploads, admin roles, or ROUTES that are not in the evidence. Do not turn generic SaaS conventions into facts about THIS product.\n` +
    `- Prefer state-integrity requirements (does created data persist across refresh / new session) when a create action is observed.\n` +
    `- Flow steps use ONLY these actions: navigate, click, fill, assert_visible, assert_text, assert_url, refresh. There is NO select, check, uncheck, press, wait_for, or screenshot action; a step using one is rejected and its whole flow is discarded, so never emit them. The auth actions sign_in_as, switch_role, verify_authenticated, verify_unauthorized, sign_out, reset_context work ONLY when the product has configured role-based test accounts; when it does not, express signing in as a plain fill + click on the visible form, not as an auth action. Never put a password, card number, or security code in a fill value; treat such forms as pre-filled and click the submit control directly. Targets are SEMANTIC accessible names (e.g. the button labeled "Create project"), never CSS/XPath. Set unused string fields to "".\n` +
    // FIELD CONTRACTS. validateSteps enforces every line below and DISCARDS THE WHOLE FLOW on a breach,
    // and the prompt never used to say what these fields hold. So the model described what should happen
    // ("the saved note appears in the list") where a literal was required, the flow was dropped, and the
    // coverage gate then reported the claim unprovable. Every rule here mirrors lib/preflight/flow-steps.ts.
    `- FIELD CONTRACTS. A step that breaks one of these is not repaired, it DISCARDS ITS WHOLE FLOW:\n` +
    `    navigate       target is a path on this app, e.g. "/dashboard", or "" for the app root. Never an absolute URL.\n` +
    `    assert_url     expect is a path fragment on this app, e.g. "/auth". It is checked with url.includes(expect), so a sentence such as "user is on the sign-in page" can never match and is rejected outright.\n` +
    `    assert_text    target names the element or region to look inside. expect is the LITERAL text that will be on the page at that moment, normally a value an earlier fill step typed. It is compared as text, so a DESCRIPTION of the outcome ("the saved note appears in the list") is looked for word for word and never found.\n` +
    `    assert_visible target is the literal visible text or accessible name to look for.\n` +
    `    fill           target is the field's label or placeholder; value is the literal text to type.\n` +
    `    sign_in_as / switch_role  target is one of the configured role labels, exactly as given.\n` +
    `    refresh / sign_out / reset_context  carry no target, value or expect.\n` +
    // The runner has no implicit login. A flow that opened a gated page first reached the login screen and
    // the failure was published as the customer's application defect.
    `- A flow runs EXACTLY as written, in order, in ONE browser session that STARTS SIGNED OUT. Nothing signs in implicitly, and a role on the flow does not sign anyone in. A flow that needs a signed-in page must sign in BEFORE it navigates there, or it will only ever reach the login screen.\n` +
    `- Assert the OUTCOME, not the furniture. After creating something, assert the value you typed, not that a heading or an empty container is present: a heading is still there when the thing was never saved.\n` +
    `- severity/priority: critical only for launch-blocking promises (auth, persistence, authorization, payment). Write plainly; no em dashes.\n\n` +
    `ORIGINAL BUILD PROMPT:\n${(buildPrompt || "(none provided)").slice(0, 6000)}\n\n` +
    (contextBlock ? `PRODUCT CONTEXT (the maker's own words; strong evidence of intent, not of the deployed app's behavior):\n${contextBlock}\n\n` : "") +
    (connectionBlock ? `CONNECTED SERVICES:\n${connectionBlock}\n\n` : "") +
    `DETERMINISTIC SNAPSHOT:\n${describe(pages)}`
  );
}

export async function synthesize(pages: PageSnapshot[], buildPrompt: string | null, context?: SynthContext): Promise<Synthesis | null> {
  const API_KEY = apiKey();
  if (!API_KEY || !pages.length) return null;
  const prompt = buildSynthesisPrompt(pages, buildPrompt, context);
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
// `available` (from availableProvenance) bounds the AI's justified_by attribution server-side: a tag the
// model was never given evidence for degrades to "inference" instead of becoming a false provenance claim.
export function toSuggestions(s: Synthesis, available?: Iterable<string>): (Suggestion & { support: SynthReq["support"]; enabledDefault: boolean })[] {
  return s.requirements.slice(0, 60).map((r) => ({
    requirement: r.text.slice(0, 400), category: (r.category || "general").slice(0, 60), severity: (r.severity as Severity),
    source_refs: (r.sources || []).slice(0, 8) as SourceRef[], confidence: r.confidence, reasoning_summary: undefined,
    provenance: normalizeProvenanceSource(r.justified_by, available),
    support: r.support, enabledDefault: enabledDefault(r.support),
  }));
}

// ── Deterministic connection-signal requirements (no AI, no API key needed) ─────────────────────────────
// A connected service is a presence signal, not observed behavior, so each standard requirement is
// origin-tagged "inference" (the UI renders the inferred qualifier), carries its connection as the source,
// and starts DISABLED + suggested: the owner approves before anything runs, exactly like every other
// suggestion. github deliberately produces nothing (naming context only). Pure and deterministic.
export type ConnectionSignalSuggestion = Suggestion & { support: SynthReq["support"]; enabledDefault: boolean };
const CONNECTION_SIGNAL_REQUIREMENTS: Record<string, { requirement: string; category: string; severity: Severity }> = {
  stripe_test: {
    requirement: "A customer can complete the billing flow in Stripe test mode: checkout starts, a test card payment completes, and the app reflects the paid state.",
    category: "billing", severity: "critical",
  },
  supabase: {
    requirement: "Data created in the app persists across a page refresh and a new session.",
    category: "state_integrity", severity: "critical",
  },
  sentry: {
    requirement: "Core flows complete without unhandled errors.",
    category: "reliability", severity: "important",
  },
};
export function connectionSignalSuggestions(providers: string[]): ConnectionSignalSuggestion[] {
  const out: ConnectionSignalSuggestion[] = [];
  for (const p of Array.from(new Set(providers))) {
    const std = CONNECTION_SIGNAL_REQUIREMENTS[p];
    if (!std) continue;
    out.push({
      requirement: std.requirement, category: std.category, severity: std.severity,
      source_refs: [{ type: "connection", reference: p }],
      provenance: `connection:${p}` as ProvenanceSource, origin: "inference",
      support: "best_practice", enabledDefault: false,
    });
  }
  return out.sort((a, b) => (a.provenance! < b.provenance! ? -1 : a.provenance! > b.provenance! ? 1 : 0));
}
