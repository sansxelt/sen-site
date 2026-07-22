// The correction PROPOSERS. When the deterministic gate finds a plan cannot prove the claim, these ask the
// model for a stronger plan — stronger requirements, or a runnable flow that actually exercises the
// guarantee. They are proposers only. Nothing here decides whether a proposal is sufficient: the pure
// validators in coverage.ts remain the sole authority, and the resolver re-runs them after every correction.
// That separation IS the product — the model proposes how to prove the guarantee; Vraelis decides
// independently whether the proof plan is complete.
//
// Everything here is bounded and side-effect-light: a correction is at most one model call, a recrawl reads
// pages only. None of it launches a browser run, holds credit, or charges. Those gates live downstream and
// are never reached from a proposal that the validators reject.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { PageSnapshot } from "./discover-extract";
import { crawl } from "./discover-crawl";
import { makeSafeFetcher } from "./crawl-fetch";
import { validateSteps } from "./flow-steps";
import type { ClaimObligations } from "./coverage";
import type { PlanRequirement, PlanFlow } from "./verification-lane";

// Same key/model the evaluator and synthesis use, read lazily so env resolves after import order.
const apiKey = () => process.env.VRAELIS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
const model = () => process.env.VRAELIS_EVAL_MODEL || "claude-sonnet-4-6";
export function correctionConfigured(): boolean { return !!apiKey(); }

// ── The corrector interfaces (injectable) ─────────────────────────────────────────────────────────────────
// The resolver takes these as dependencies so the whole bounded loop can be tested with fakes and NO model
// call. The defaults below are the real, model-backed proposers.

export type RequirementCorrectorInput = {
  claim: string;
  requirements: string[];
  obligations: ClaimObligations;
  /** The exact missing claim obligations from checkClaimCoverage. */
  missing: string[];
};
export type RequirementCorrector = (input: RequirementCorrectorInput) => Promise<PlanRequirement[] | null>;

export type FlowCorrectorInput = {
  claim: string;
  requirements: string[];
  flows: PlanFlow[];
  obligations: ClaimObligations;
  /** The exact uncovered requirement obligations from checkExecutionCoverage. */
  missing: string[];
  pages: PageSnapshot[];
};
// The flow corrector reports not just the accepted flows but how many the model PROPOSED and why any were
// dropped by the designer validator. That distinction is what tells an operator whether a block was "the
// model produced nothing usable" versus "the model produced a plan that still does not prove the claim" —
// otherwise a discarded correction looks identical to no correction at all.
export type FlowCorrectionResult = { flows: PlanFlow[]; candidates: number; rejected: { name: string; reason: string }[] };
export type FlowCorrector = (input: FlowCorrectorInput) => Promise<FlowCorrectionResult | null>;

export type Recrawler = (deploymentUrl: string, focusPaths: string[], existing: PageSnapshot[]) => Promise<PageSnapshot[]>;

// ── Deterministic discovery helpers (no model) ────────────────────────────────────────────────────────────

// A compact, bounded page view for the correction prompt: the controls and destinations a flow can use.
function describePages(pages: PageSnapshot[]): string {
  return pages.slice(0, 14).map((p) => {
    const forms = p.forms.map((f) => `${f.method} ${f.action} [${f.inputs.map((i) => `${i.name}:${i.type}`).join(",")}] (${f.submitLabels.join("/")})`).join("; ");
    return `PAGE ${p.url}\n  title: ${p.title}\n  headings: ${p.headings.slice(0, 8).join(" | ")}\n  nav: ${p.navLinks.slice(0, 14).map((l) => `${l.label}->${l.href}`).join(", ")}\n  buttons: ${p.buttons.slice(0, 14).join(", ")}\n  ctas: ${p.ctas.slice(0, 14).join(", ")}\n  forms: ${forms}\n  indicators: ${p.indicators.join(", ")}`;
  }).join("\n\n").slice(0, 12000);
}

// The surface keywords a claim's action + values imply — used both to decide whether discovery already
// covers the needed surfaces and to steer a targeted recrawl. Deterministic and claim-derived.
function surfaceKeywords(obligations: ClaimObligations): string[] {
  const kws = new Set<string>(["account", "settings", "profile", "sign in", "signin", "log in", "login", "sign out"]);
  for (const v of obligations.namedValues) kws.add(v.toLowerCase());
  if (obligations.action) kws.add(obligations.action);
  // Purchase-shaped claims imply the whole billing surface even when the verb alone is "upgrade".
  if (/\b(upgrade|pay|buy|purchase|checkout|subscribe)\b/i.test(obligations.action || "") || obligations.namedValues.some((v) => /pro|paid|premium|plus/i.test(v))) {
    ["pricing", "plans", "upgrade", "checkout", "billing", "subscribe", "buy"].forEach((k) => kws.add(k));
  }
  return Array.from(kws);
}

function pageMentions(p: PageSnapshot, needle: string): boolean {
  const hay = [p.url, p.title, ...p.headings, ...p.navLinks.map((l) => `${l.label} ${l.href}`), ...p.buttons, ...p.ctas, ...p.indicators].join(" ").toLowerCase();
  return hay.includes(needle.toLowerCase());
}

// Does the CURRENT discovery already contain the controls and pages a flow correction would need? When it
// does, a recrawl is wasted work and must be skipped (do not crawl the whole product again for surfaces we
// already have). "Covered" means the pages collectively surface the action AND a place the outcome is read.
export function discoveryCovers(pages: PageSnapshot[], obligations: ClaimObligations): boolean {
  if (!pages.length) return false;
  const actionWords = surfaceKeywords(obligations).filter((k) => /pric|plan|upgrade|checkout|buy|subscribe|pay/.test(k));
  const hasAction = actionWords.length === 0 || actionWords.some((k) => pages.some((p) => pageMentions(p, k)));
  // Somewhere the outcome can be observed: the named value itself, or an account/settings surface.
  const readWords = [...obligations.namedValues.map((v) => v.toLowerCase()), "account", "settings", "profile"];
  const hasRead = readWords.some((k) => pages.some((p) => pageMentions(p, k)));
  return hasAction && hasRead;
}

// Candidate paths for a targeted recrawl: same-origin nav/link destinations whose label or href matches a
// surface keyword the claim implies. Bounded, de-duplicated, relative paths only (the recrawler rebases onto
// the deployment origin). This is NOT a full re-crawl; it re-reads only the surfaces the claim points at.
export function focusPaths(pages: PageSnapshot[], obligations: ClaimObligations): string[] {
  const kws = surfaceKeywords(obligations);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    for (const link of p.navLinks) {
      const hay = `${link.label} ${link.href}`.toLowerCase();
      if (!kws.some((k) => hay.includes(k))) continue;
      let path = link.href;
      try { path = new URL(link.href, p.url).pathname; } catch { /* keep raw href */ }
      if (!path.startsWith("/")) continue;               // same-origin relative paths only
      if (seen.has(path)) continue;
      seen.add(path); out.push(path);
      if (out.length >= 6) return out;                    // bounded
    }
  }
  return out;
}

// The default targeted recrawl: read each focus path (shallow), merge unique pages with what we already have.
// Reads pages only — no browser run, no hold, no charge.
export const defaultRecrawler: Recrawler = async (deploymentUrl, paths, existing) => {
  const origin = (() => { try { return new URL(deploymentUrl).origin; } catch { return deploymentUrl.replace(/\/+$/, ""); } })();
  const byUrl = new Map(existing.map((p) => [p.url, p]));
  const fetcher = makeSafeFetcher();
  for (const path of paths.slice(0, 6)) {
    const snap = await crawl(`${origin}${path}`, fetcher, { maxPages: 3, maxDepth: 1 });
    for (const p of snap.pages) if (!byUrl.has(p.url)) byUrl.set(p.url, p);
  }
  return Array.from(byUrl.values());
};

// ── The model proposers (default correctors) ──────────────────────────────────────────────────────────────

const CorrectedReqs = z.object({
  requirements: z.array(z.object({
    text: z.string(),
    category: z.string(),
    severity: z.enum(["critical", "important", "informational"]),
  })),
});

// Repair ONLY the missing claim coverage. The model may not broaden the claim, add unrequested guarantees, or
// restate what is already covered — it returns the requirement(s) that close the named gaps. The resolver
// MERGES these with the existing requirements (existing valid ones are never discarded) and then re-runs the
// deterministic claim check, which is what actually decides sufficiency.
export const defaultRequirementCorrector: RequirementCorrector = async ({ claim, requirements, obligations, missing }) => {
  const API_KEY = apiKey();
  if (!API_KEY) return null;
  const prompt =
    `A claim about an already-built app has requirements that DROPPED part of what the claim promises. Write the ` +
    `minimum additional requirement(s) that restore ONLY the missing coverage. Do not broaden the claim. Do not ` +
    `add guarantees the claim does not state. Do not restate requirements that are already present.\n\n` +
    `CLAIM:\n${claim}\n\n` +
    `WHAT THE CLAIM OBLIGES (deterministic):\n` +
    `- actor: ${obligations.actor}\n- action: ${obligations.action ?? "(none named)"}\n` +
    `- exact expected values: ${obligations.namedValues.join(", ") || "(none named)"}\n` +
    `- must persist across a boundary (sign-in / reload): ${obligations.persistence}\n` +
    `- tied to the same identity: ${obligations.identity}\n\n` +
    `CURRENT REQUIREMENTS:\n${requirements.map((r, i) => `${i + 1}. ${r}`).join("\n") || "(none)"}\n\n` +
    `MISSING OBLIGATIONS TO RESTORE:\n${missing.map((m) => `- ${m}`).join("\n")}\n\n` +
    `Return only the new requirement(s), each a single checkable sentence that names the exact expected value and, ` +
    `where the claim requires it, the persistence and same-identity conditions. severity critical for a ` +
    `launch-blocking promise (payment, persistence, authorization). No em dashes.`;
  try {
    const client = new Anthropic({ apiKey: API_KEY, timeout: 50_000, maxRetries: 0 });
    const res = await client.messages.parse({ model: model(), max_tokens: 1500, temperature: 0, messages: [{ role: "user", content: prompt }], output_config: { format: zodOutputFormat(CorrectedReqs) } });
    const out = res.parsed_output?.requirements ?? [];
    return out.map((r) => ({ text: r.text.trim(), category: r.category || "correctness", severity: r.severity })).filter((r) => r.text);
  } catch (e) { console.error("requirement correction failed:", (e as Error).message); return null; }
};

const CorrectedFlows = z.object({
  flows: z.array(z.object({
    name: z.string(),
    goal: z.string(),
    role: z.string(),
    auth_required: z.boolean(),
    priority: z.enum(["critical", "important", "informational"]),
    steps: z.array(z.object({ action: z.string(), target: z.string(), value: z.string(), expect: z.string() })),
  })),
});

// Repair the EXECUTION plan so every validated requirement has a runnable path with an observable assertion.
// The model must return executable steps, not a reworded description. The resolver validates every returned
// flow through the SAME designer step validator the dashboard uses, drops any that don't validate, then
// re-runs execution coverage — which decides sufficiency. The model never decides would_launch.
export const defaultFlowCorrector: FlowCorrector = async ({ claim, requirements, flows, obligations, missing, pages }) => {
  const API_KEY = apiKey();
  if (!API_KEY) return null;
  const val = obligations.namedValues[0] || "the expected value";
  const prompt =
    `An execution plan for an already-built app does not actually PROVE the claim. Repair it: return runnable ` +
    `browser flow(s) whose steps carry a browser all the way through the guarantee and ASSERT the outcome where ` +
    `it is actually read. A checkout success message alone is not sufficient. A generic account plan label is not ` +
    `sufficient. A sign-in step without a LATER assertion of the outcome is not sufficient.\n\n` +
    `CLAIM:\n${claim}\n\n` +
    `VALIDATED REQUIREMENTS (every one must be provable by a runnable path):\n${requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}\n\n` +
    `WHAT IS MISSING FROM THE CURRENT PLAN (deterministic):\n${missing.map((m) => `- ${m}`).join("\n")}\n\n` +
    `THE OUTCOME TO ASSERT: exact value "${val}"` + (obligations.persistence ? `, and it must still hold after ${obligations.identity ? "signing out and signing back in with the same account" : "reloading"}.` : ".") + `\n\n` +
    `CURRENT FLOWS:\n${flows.map((f) => `- ${f.name}: ${f.steps.map((s) => s.action + (s.target ? `(${s.target})` : "")).join(" -> ")}`).join("\n") || "(none runnable)"}\n\n` +
    `REACHABLE PAGES AND CONTROLS:\n${describePages(pages)}\n\n` +
    `RULES:\n` +
    `- Steps use ONLY: navigate, click, fill, assert_visible, assert_text, assert_url, refresh. No select/check/press/wait_for/screenshot; a flow using one is discarded.\n` +
    `- Express signing in as a plain fill + click on the visible form. Never put a password, card number, or security code in a fill value; treat such forms as pre-filled and click the submit control directly.\n` +
    `- Targets are the visible accessible names (a button's label, a heading), never CSS or XPath. Set unused string fields to "".\n` +
    `- For a persistence guarantee, ONE flow must: perform the action, assert the exact outcome where it is read, ${obligations.identity ? "sign out, sign back in with the same account, " : "reload, "}then assert the exact outcome AGAIN. Keep that whole journey in a single flow.`;
  try {
    const client = new Anthropic({ apiKey: API_KEY, timeout: 50_000, maxRetries: 0 });
    const res = await client.messages.parse({ model: model(), max_tokens: 3000, temperature: 0, messages: [{ role: "user", content: prompt }], output_config: { format: zodOutputFormat(CorrectedFlows) } });
    const raw = res.parsed_output?.flows ?? [];
    const { flows, rejected } = validateCorrectedFlows(raw);
    if (rejected.length) console.error("flow correction dropped flows:", JSON.stringify(rejected));
    return { flows, candidates: raw.length, rejected };
  } catch (e) { console.error("flow correction failed:", (e as Error).message); return null; }
};

// Validate model-proposed flows through the designer validator (the resolver's authority over "executable"),
// keeping the reason each dropped flow failed. Exported so a test can prove the corrected fixture flow
// validates without a model call. Roles a flow may sign into are drawn from the flows themselves, matching
// projectPlan's rule.
export function validateCorrectedFlows(
  raw: { name: string; goal: string; role: string; auth_required: boolean; priority: "critical" | "important" | "informational"; steps: { action: string; target: string; value: string; expect: string }[] }[],
): { flows: PlanFlow[]; rejected: { name: string; reason: string }[] } {
  const roles = Array.from(new Set(raw.map((f) => (f.role || "").trim()).filter(Boolean)));
  const flows: PlanFlow[] = [];
  const rejected: { name: string; reason: string }[] = [];
  for (const f of raw.slice(0, 20)) {
    const steps = validateSteps(f.steps, { rolesAvailable: roles });
    if (!steps.ok) { rejected.push({ name: f.name || "(unnamed)", reason: steps.reason }); continue; }
    flows.push({ name: f.name, goal: f.goal, role: f.auth_required ? (f.role || null) : null, steps: steps.steps, priority: f.priority });
  }
  return { flows, rejected };
}
