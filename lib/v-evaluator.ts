// lib/v-evaluator.ts
// Vraelis — AI Output Check (pivot stage 1: the engine). Take 1..N versions of an
// AI-generated output plus context, return an honest, structured evaluation:
// per-criterion scores by a domain-aware rubric, a recommended version, and
// line-level flags on the exact problem spans, each with a concrete suggested fix.
//
// This is explicitly an AI ASSESSMENT — never a human judgment and never a
// guarantee. Honesty is enforced in CODE, not by trusting the model:
//   1. Every flagged span must be a VERBATIM substring of the candidate it flags;
//      spans the model invents are dropped (no phantom problems).
//   2. The recommended version is COMPUTED from the criterion scores (argmax of the
//      mean), never taken from the model's say-so — so the pick is a transparent
//      function of the numbers shown, and an exact tie yields no recommendation.
//
// Fail-soft everywhere: no key / no candidates / a failed call all return null.
// Model is VRAELIS_EVAL_MODEL (default claude-sonnet-4-6 — this is the paid core, so
// it warrants nuance for line-level flags); key is VRAELIS_LLM_API_KEY or
// ANTHROPIC_API_KEY (same precedence as lib/v-themes.ts, lib/v-ai.ts).
//
// NOTE on PII: unlike the human-eval path (lib/v-content-policy.ts blocks PII because
// candidate content is shown to real evaluators), we do NOT block or strip PII here.
// This content is the customer's OWN output and is sent only to the model, never to a
// human evaluator, so blocking would break legitimate checks (e.g. auditing a support
// reply that names a customer).

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

export const OUTPUT_TYPES = ["support_reply", "onboarding", "marketing_copy", "agent_action", "other"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

export type FlagIssue = "dismissive" | "overpromise" | "confusing" | "risky" | "inaccurate" | "tone" | "other";
export type FlagSeverity = "low" | "medium" | "high";
const ISSUES: FlagIssue[] = ["dismissive", "overpromise", "confusing", "risky", "inaccurate", "tone", "other"];
// Severity is no longer read from the model; it is computed in deriveSeverity (finalizeEvaluation).

// Domain-aware rubric: the criteria shift by output type. Each is scored 0..100.
export type Criterion = { key: string; label: string; guide: string };
export const RUBRICS: Record<OutputType, Criterion[]> = {
  support_reply: [
    { key: "empathy", label: "Empathy", guide: "acknowledges the person's situation without being hollow or scripted" },
    { key: "resolution", label: "Resolution", guide: "actually moves the issue toward being solved, with a clear next step" },
    { key: "tone", label: "Tone", guide: "warm and respectful, never dismissive, defensive, or robotic" },
    { key: "accuracy", label: "Accuracy & safety", guide: "factually careful; no invented policy, no unsafe or unverifiable claims" },
  ],
  onboarding: [
    { key: "clarity", label: "Clarity", guide: "immediately understandable; no jargon or ambiguity about what to do" },
    { key: "next_step", label: "Next step", guide: "points to one concrete first action, not an open-ended 'get started'" },
    { key: "reassurance", label: "Reassurance", guide: "lowers the stakes (nothing to break, easy to undo) so the person acts" },
    { key: "tone", label: "Tone", guide: "welcoming and human, not corporate or condescending" },
  ],
  marketing_copy: [
    { key: "clarity", label: "Clarity", guide: "the value is legible in one read; no vague or abstract filler" },
    { key: "persuasion", label: "Persuasion", guide: "gives a concrete reason to care or act, grounded in a real benefit" },
    { key: "overpromise", label: "Overpromise / risk", guide: "no claims that cannot be backed up; no hype that invites distrust or legal risk" },
    { key: "brand_tone", label: "Brand tone", guide: "consistent, confident voice that fits the audience" },
  ],
  agent_action: [
    { key: "correctness", label: "Correctness", guide: "the action or answer is right for the request; no wrong operation" },
    { key: "safety", label: "Safety", guide: "no destructive, irreversible, or out-of-scope action taken without warrant" },
    { key: "completeness", label: "Completeness", guide: "handles the whole task, including obvious edge cases, not just the happy path" },
    { key: "reversibility", label: "Reversibility", guide: "prefers reversible steps and surfaces how to undo when it matters" },
  ],
  other: [
    { key: "clarity", label: "Clarity", guide: "clear and easy to follow" },
    { key: "tone", label: "Tone", guide: "appropriate for the audience and purpose" },
    { key: "risk", label: "Risk", guide: "no overpromising, unsafe, or misleading content" },
    { key: "effectiveness", label: "Effectiveness", guide: "does its job well for the stated goal" },
  ],
};

export type CriterionScore = { criterion: string; label: string; score: number; note: string };
export type CandidateEval = { index: number; label: string; text: string; overall: number; scores: CriterionScore[]; summary: string };
export type LineFlag = { candidateIndex: number; candidateLabel: string; span: string; issue: FlagIssue; severity: FlagSeverity; why: string; fix: string };

// Is the output about to ship, or already live? A published landing page cannot be "not
// ready to ship", so the verdict framing (and the report kicker) shift for "published".
export type CheckContext = "pre_ship" | "published";

export type EvalResult = {
  outputType: OutputType;
  model: string;
  assessment: "ai";                 // never "human" — a model assessment, not a guarantee
  recommendedIndex: number | null;  // computed from scores; null for a single candidate or an exact tie
  recommendedLabel: string | null;
  margin: number | null;            // winner overall minus runner-up (points); null with < 2 scored candidates
  recommendation: string;
  candidates: CandidateEval[];
  flags: LineFlag[];
  context?: CheckContext;           // rides the stored result jsonb; drives report framing
};

export type EvalCandidate = { label?: string; text: string };
export type EvalInput = { outputType: OutputType; audience?: string; goal?: string; candidates: EvalCandidate[]; context?: CheckContext };
export type PreparedCandidate = { index: number; label: string; text: string; normText: string };

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const MAX_CANDIDATES = LETTERS.length; // matches the product spec (2 to 8 versions)
// PINNED judge model. A score only means something if the judge is fixed, so this is a
// deliberate version pin, not a floating default: if Anthropic ships a model update, bumping
// this is a tested change (re-run the stability harness), never a silent shift under every
// customer's gate. If a dated snapshot of this model is published, pin to that exact string.
// The env override is for staging comparisons only.
const MODEL = process.env.VRAELIS_EVAL_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.VRAELIS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;

// Forgiving-but-honest verbatim match (case + whitespace insensitive) — a span counts
// only if its words truly appear in the candidate. Same normalizer as lib/v-themes.ts.
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

// Is the evaluator usable at all (is an API key present)? Callers use this to avoid
// side effects (e.g. charging a credit) when a check would fail-soft to null anyway.
export function evaluatorConfigured(): boolean { return !!API_KEY; }

// Wire schema — the model returns a single object; everything is re-validated in code.
const EvalSchema = z.object({
  candidates: z.array(z.object({
    label: z.string(),                                // "A", "B", ...
    summary: z.string(),                              // one-line read of this version
    scores: z.array(z.object({
      criterion: z.string(),                          // must be a rubric key for the output type
      score: z.number(),                              // 0..100
      note: z.string(),                               // one line
    })),
  })),
  flags: z.array(z.object({
    candidate: z.string(),                            // version letter this flag is about
    span: z.string(),                                 // EXACT problem text, copied verbatim
    issue: z.string(),                                // dismissive|overpromise|confusing|risky|inaccurate|tone|other
    severity: z.string(),                             // low|medium|high (DISCARDED — severity is computed)
    why: z.string(),
    fix: z.string(),                                  // concrete rewrite of just that span
  })),
  // Mandatory-consideration pass: code pre-finds every absolute/universal claim and the model
  // MUST return a backed/unbacked verdict on each. This closes the false-negative hole where
  // the open-ended flag pass simply failed to notice an absolute (recall wobbled run to run).
  absolute_verdicts: z.array(z.object({
    candidate: z.string(),
    claim: z.string(),                                // the absolute claim, copied verbatim
    backed: z.boolean(),                              // does the surrounding copy substantiate it?
    why: z.string(),
    fix: z.string(),
  })).optional(),
  recommendation: z.string(),
});

// Trim, drop empties, cap at MAX_CANDIDATES, and assign stable letters + normalized text.
export function prepareCandidates(input: EvalInput): PreparedCandidate[] {
  return (input.candidates || [])
    .map((c) => (c?.text || "").trim())
    .filter((t) => t.length > 0)
    .slice(0, MAX_CANDIDATES)
    .map((text, i) => ({ index: i, label: LETTERS[i], text, normText: norm(text) }));
}

// Absolute / universal claim vocabulary. Code finds these; the model verdicts each.
const ABSOLUTE_RE = /\b(any|anything|anyone|every|everything|everyone|all|always|never|none|guarantee|guaranteed|guarantees|instant|instantly|unlimited|100%)\b/i;

// Deterministic half of the mandatory-consideration pass: split each candidate into sentence-
// ish spans and return every one that makes an absolute/universal claim, VERBATIM and bounded.
// Because CODE finds these, the model can never fail to LOOK at an absolute (its recall on
// open-ended discovery wobbles run to run; a forced verdict on a named span is far steadier).
// It is not a full-text severity scanner: a found claim only becomes HIGH if the model then
// verdicts it unbacked, so a benign backed absolute ("we never sell your data") clears.
function findAbsoluteClaims(prepared: PreparedCandidate[]): { label: string; claim: string }[] {
  const out: { label: string; claim: string }[] = [];
  const seen = new Set<string>();
  for (const p of prepared) {
    const sentences = p.text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length >= 6 && s.length <= 240);
    for (const s of sentences) {
      if (!ABSOLUTE_RE.test(s)) continue;
      const k = `${p.label}|${s.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ label: p.label, claim: s });
      if (out.length >= 12) return out; // hard cap across all candidates, bounds the prompt
    }
  }
  return out;
}

// Severity for an OPEN-ENDED flag (a non-absolute problem the model surfaced). The model's own
// severity guess is DISCARDED (it flapped run-to-run: medium x8 / high x2 on the same line). A
// matter of voice is LOW, every other flagged problem is MEDIUM. HIGH is reserved for unbacked
// absolutes and is produced by the verdict pass, never here, so it can't depend on a flappy label.
function deriveSeverity(issue: FlagIssue): FlagSeverity {
  return issue === "tone" ? "low" : "medium";
}

// Pure, exported so the honesty enforcement is independently testable without a key:
// keep only rubric criteria, compute a transparent overall, drop non-verbatim spans,
// derive the recommended version from the scores, and COMPUTE each flag's severity.
export function finalizeEvaluation(
  outputType: OutputType,
  prepared: PreparedCandidate[],
  raw: z.infer<typeof EvalSchema>,
  model: string,
): EvalResult {
  const rubric = RUBRICS[outputType] ?? RUBRICS.other;
  const critByKey = new Map(rubric.map((c) => [c.key.toLowerCase(), c]));
  const prepByLabel = new Map(prepared.map((p) => [p.label, p]));
  const rawByLabel = new Map((raw.candidates || []).map((c) => [(c.label || "").trim().toUpperCase(), c]));

  const candidates: CandidateEval[] = prepared.map((p) => {
    const rc = rawByLabel.get(p.label);
    const seen = new Set<string>();
    const scores: CriterionScore[] = [];
    for (const s of rc?.scores ?? []) {
      const crit = critByKey.get((s.criterion || "").trim().toLowerCase());
      if (!crit || seen.has(crit.key)) continue;      // drop unknown/duplicate criteria
      seen.add(crit.key);
      scores.push({ criterion: crit.key, label: crit.label, score: clampScore(s.score), note: (s.note || "").trim().slice(0, 200) });
    }
    const overall = scores.length ? Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length) : 0;
    return { index: p.index, label: p.label, text: p.text, overall, scores, summary: (rc?.summary || "").trim().slice(0, 240) };
  });

  const flags: LineFlag[] = [];
  const overlaps = (label: string, span: string) =>
    flags.some((h) => h.candidateLabel === label && (norm(h.span).includes(norm(span)) || norm(span).includes(norm(h.span))));

  // 1) Mandatory absolute-claim gate, FAIL-CLOSED. Code finds every absolute claim; the model
  //    must affirmatively verdict it `backed` or it becomes a HIGH flag. This closes the
  //    false-negative hole (open-ended recall wobbled: a real absolute went unflagged 2/10).
  const verdicts = raw.absolute_verdicts || [];
  for (const { label, claim: sentence } of findAbsoluteClaims(prepared)) {
    const p = prepByLabel.get(label);
    if (!p) continue;
    const v = verdicts.find((x) => (x.candidate || "").trim().toUpperCase() === label && x.claim && norm(sentence).includes(norm(x.claim)));
    if (v && v.backed === true) continue;                 // model affirmatively cleared it
    // tightest verbatim span: the model's claim if it truly appears in the candidate, else the sentence
    const span = (v && v.claim && p.normText.includes(norm(v.claim)) ? v.claim : sentence).trim().slice(0, 400);
    if (overlaps(label, span)) continue;                  // already recorded this absolute
    flags.push({ candidateIndex: p.index, candidateLabel: p.label, span, issue: "overpromise", severity: "high",
      why: ((v?.why || "").trim() || "This makes an absolute claim the copy does not back up.").slice(0, 300),
      fix: ((v?.fix || "").trim() || "Qualify the claim or name what backs it.").slice(0, 400) });
  }

  // 2) Open-ended flags (non-absolute problems), computed to MEDIUM/LOW. A span survives only if
  //    it is verbatim in its candidate; one that overlaps a HIGH absolute above is the same defect
  //    and is skipped (keep the HIGH).
  for (const f of raw.flags || []) {
    const p = prepByLabel.get((f.candidate || "").trim().toUpperCase());
    if (!p) continue;
    const span = (f.span || "").trim();
    if (!span || !p.normText.includes(norm(span))) continue; // dropped: not verbatim in the candidate
    const why = (f.why || "").trim();
    const fix = (f.fix || "").trim();
    if (!why || !fix) continue;
    if (overlaps(p.label, span)) continue;                 // same span as a HIGH absolute -> skip
    const issue = (ISSUES as string[]).includes((f.issue || "").trim().toLowerCase()) ? ((f.issue || "").trim().toLowerCase() as FlagIssue) : "other";
    flags.push({ candidateIndex: p.index, candidateLabel: p.label, span: span.slice(0, 400), issue, severity: deriveSeverity(issue), why: why.slice(0, 300), fix: fix.slice(0, 400) });
  }

  // Recommended version is COMPUTED from the scores, never the model's word. An exact
  // tie (margin 0) yields no recommendation; a single candidate is a critique, not a pick.
  let recommendedIndex: number | null = null;
  let margin: number | null = null;
  const scored = candidates.filter((c) => c.scores.length > 0);
  if (scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => b.overall - a.overall || a.index - b.index);
    margin = sorted[0].overall - sorted[1].overall;
    recommendedIndex = margin > 0 ? sorted[0].index : null;
  }
  const recommendedLabel = recommendedIndex != null ? (candidates.find((c) => c.index === recommendedIndex)?.label ?? null) : null;

  return {
    outputType,
    model,
    assessment: "ai",
    recommendedIndex,
    recommendedLabel,
    margin,
    recommendation: (raw.recommendation || "").trim().slice(0, 400),
    candidates,
    flags,
  };
}

// Run one AI Output Check. Returns null on skip (no key / no candidates) or transient
// failure; a concrete EvalResult otherwise.
export async function evaluateOutput(input: EvalInput): Promise<EvalResult | null> {
  if (!API_KEY) return null;
  const outputType: OutputType = OUTPUT_TYPES.includes(input.outputType) ? input.outputType : "other";
  const prepared = prepareCandidates(input);
  if (prepared.length === 0) return null;

  const rubric = RUBRICS[outputType];
  const criteriaBlock = rubric.map((c) => `- ${c.key}: ${c.label} — ${c.guide}`).join("\n");
  const ctx = [
    input.audience ? `Audience: ${input.audience.trim()}` : null,
    input.goal ? `What "good" means here: ${input.goal.trim()}` : null,
  ].filter(Boolean).join("\n");
  const candidatesBlock = prepared.map((p) => `Version ${p.label}:\n"""\n${p.text}\n"""`).join("\n\n");
  const typeLabel = outputType.replace(/_/g, " ");
  const multi = prepared.length > 1;

  // Deterministic pre-scan: every absolute/universal claim, found by code, that the model MUST verdict.
  const absClaims = findAbsoluteClaims(prepared);
  const absList = absClaims.map((a) => `- [${a.label}] "${a.claim}"`).join("\n");

  const published = input.context === "published";
  const PROMPT =
    `You are an evaluation engine reviewing AI-generated ${typeLabel} ${published ? "that is already published and live in production" : "for the team about to ship it"}. Give an honest, specific assessment. You are an AI assessment, not a human judgment and not a guarantee.\n\n` +
    (ctx ? `${ctx}\n\n` : "") +
    `Score each version on these criteria, 0 to 100 (higher is better). Use the exact criterion key:\n${criteriaBlock}\n\n` +
    (multi ? `There are ${prepared.length} versions to compare:\n\n${candidatesBlock}\n\n` : `One version to review:\n\n${candidatesBlock}\n\n`) +
    `Return:\n` +
    `- candidates: for EACH version, its label (e.g. "A"), a one-line summary, and a score for EVERY criterion above (exact key) with a one-line note.\n` +
    `- flags: specific line-level problems. For each: candidate (the version letter), span (the EXACT problem text copied WORD FOR WORD from that version, never paraphrased), issue (one of: dismissive, overpromise, confusing, risky, inaccurate, tone, other), severity (low, medium, high), why (one line), and fix (a concrete rewrite of just that span).\n` +
    (absClaims.length
      ? `- absolute_verdicts: the text makes the absolute or universal claims listed below, and you MUST return a verdict on EVERY one. For each: candidate (letter), claim (copied verbatim), backed (true ONLY if the surrounding copy substantiates it with a real mechanism, specifics, or evidence; false if the product cannot literally deliver it or nothing on the page backs it), why (one line), fix (a concrete rewrite). Judge honestly and independently: "works with every major tool: Slack, Gmail, and Notion" is backed; "we never sell your data" is a policy statement and is backed; "automate any app" with nothing behind it is NOT backed. The claims:\n${absList}\n`
      : "") +
    (multi
      ? `- recommendation: one plain sentence naming which version to ship and why.\n\n`
      : published
        ? `- recommendation: one plain sentence naming the single highest-impact change to make now. This content is already live, so do NOT frame it as ready or not ready to ship.\n\n`
        : `- recommendation: one plain sentence on whether this is ready to ship and the single most important change.\n\n`) +
    `Flag a span only when it is a real, checkable problem: a false statement, a claim that cannot be backed up, or a safety or clarity issue. Do not flag a matter of taste, voice, or phrasing that you would merely prefer.` +
    (outputType === "marketing_copy" ? ` Marketing copy is allowed to be bold, aspirational, and confident; flag a specific claim that is false or cannot be backed up, not a strong tone.` : "") +
    ` The system assigns each flag's severity from its content, so a rough severity guess is fine.` +
    `\n\n` +
    `Rules: copy every span verbatim from the version text, and do not invent or paraphrase spans. Score honestly against the criteria. Write plainly and do not use em dashes.`;

  try {
    // maxRetries: 0 (unlike v-themes/v-ai): a check charges a credit and runs behind a
    // 60s route maxDuration. One 40s attempt fits with headroom; a retry could push two
    // attempts to ~80s and get the function hard-killed mid-flight — which would strand
    // the charge with no chance to refund. One attempt, then a clean fail-soft.
    const client = new Anthropic({ apiKey: API_KEY, timeout: 40_000, maxRetries: 0 });
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 2600,
      temperature: 0,   // a rubric that means anything must be applied as identically as the
                        // model allows; temp 0 collapses most run-to-run variance (it is NOT a
                        // determinism guarantee: batching + float nondeterminism still exist).
      messages: [{ role: "user", content: PROMPT }],
      output_config: { format: zodOutputFormat(EvalSchema) },
    });
    const raw = res.parsed_output ?? null;
    if (!raw) return null;
    const result = finalizeEvaluation(outputType, prepared, raw, MODEL);
    result.context = published ? "published" : "pre_ship";
    return result;
  } catch (e) {
    console.error("evaluateOutput failed:", e);
    return null; // transient failure: caller renders nothing / can retry
  }
}
