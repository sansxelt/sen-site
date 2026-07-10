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
import { findAiTells, type AiTell } from "./ai-tells";

export const OUTPUT_TYPES = ["support_reply", "onboarding", "marketing_copy", "agent_action", "other"] as const;
export type OutputType = (typeof OUTPUT_TYPES)[number];

// "Reads as AI-written" detection runs on human-read prose, not machine action logs (agent_action).
const AI_TELLS_TYPES: ReadonlySet<string> = new Set(["support_reply", "onboarding", "marketing_copy", "other"]);
export type AiReview = { tells: AiTell[]; verdict: "clean" | "some" | "reads_ai"; density: number; count: number; readsAs?: "human" | "ai" | "mixed"; readsAsNote?: string };

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

// Displayed scores are rounded to no finer than each criterion's MEASURED run-to-run spread
// (from the 20-input x5 stability set), so a report never shows precision the number lacks: a
// criterion that swings 40 points must not render as a 2-digit integer. Scores are indicative
// only, the gate never uses them. Anything not listed measured <= 5 points of spread.
const CRITERION_BAND: Record<string, number> = { reversibility: 20, reassurance: 20, tone: 10, completeness: 10 };
export function bandScore(criterion: string, score: number): number {
  const b = CRITERION_BAND[criterion] ?? 5;
  return Math.min(100, Math.max(0, Math.round(score / b) * b));
}

export type CriterionScore = { criterion: string; label: string; score: number; note: string };
// Instruction fit: how fully a version did what the original request ASKED, judged separately from
// general quality. Only produced when the caller supplies an original request. Informational -- like
// the scores, it NEVER touches the pass/fail gate.
export type InstructionFit = { score: number; met: string[]; missed: string[]; contradictions: string[]; fix: string };
export type CandidateEval = { index: number; label: string; text: string; overall: number; scores: CriterionScore[]; summary: string; correctedVersion?: string; aiReview?: AiReview; instructionFit?: InstructionFit };
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
  originalRequest?: string;         // the task the AI was given (when supplied); rides the jsonb, shown on the report
};

export type EvalCandidate = { label?: string; text: string };
export type EvalInput = { outputType: OutputType; audience?: string; goal?: string; candidates: EvalCandidate[]; context?: CheckContext; originalRequest?: string };
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
    claim: z.string(),                                // the FULL sentence, verbatim -- backing is judged on THIS
    backed: z.boolean(),                              // does the sentence + surrounding copy substantiate it?
    quote: z.string().optional(),                     // tightest verbatim phrase within the sentence, DISPLAY ONLY
    why: z.string(),
    fix: z.string(),
  })).optional(),
  recommendation: z.string(),
  // Holistic "reads as AI-written" read (the model layer, on top of the deterministic tell scan).
  // A SUMMARY only -- it never creates flags; the specific tells are found in code (findAiTells).
  reads_as: z.enum(["human", "ai", "mixed"]).optional(),
  reads_as_note: z.string().optional(),
  // Instruction fit -- ONLY when an original request is supplied. Judged per candidate against the
  // stated request, separate from the quality scores; never gates. Absent otherwise.
  instruction_fit: z.array(z.object({
    candidate: z.string(),
    score: z.number(),                        // 0-100: how fully this version did what was asked
    met: z.array(z.string()),                 // requirements clearly satisfied
    missed: z.array(z.string()),              // requirements missed or only partly done
    contradictions: z.array(z.string()),      // anything that directly contradicts the request
    fix: z.string(),                          // single highest-impact task-compliance change
  })).optional(),
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

// A model verdict binds to a code-found absolute ONLY when its claim IS that sentence (normalized,
// trailing punctuation ignored) -- NEVER on loose substring containment. A loose includes() let a
// short, empty, or shared-clause claim clear a different (or every) absolute and flip the fail-
// closed gate open (adversarial review, 2026-07). Any non-exact claim leaves the sentence
// un-verdicted, which the pass treats as HIGH -- fail-closed, the safe direction.
function sameClaim(normClaim: string, normSentence: string): boolean {
  const strip = (s: string) => s.replace(/[.!?;:,\s]+$/, "");
  const a = strip(normClaim), b = strip(normSentence);
  return a.length > 0 && a === b;
}

// The displayed HIGH span is the model's tight quote ONLY when it is a UNIQUE, exact-case,
// in-sentence substring of the candidate (so the report highlights the right, verbatim
// occurrence and never a benign repeat elsewhere); otherwise the whole sentence. Display only --
// the gate and dedup key on the sentence, never this.
function displaySpan(p: PreparedCandidate, sentence: string, quote?: string): string {
  const q = (quote || "").trim();
  const unique = !!q && sentence.includes(q) && p.text.indexOf(q) !== -1 && p.text.indexOf(q) === p.text.lastIndexOf(q);
  return (unique ? q : sentence).trim().slice(0, 400);
}

// Severity for an OPEN-ENDED flag (a non-absolute problem the model surfaced) is ALWAYS MEDIUM.
// The LOW tier was DROPPED. We first tried to keep it and make it deterministic with a forced
// stylistic yes/no binary (steadier than the open-ended issue label), but across 20x5 it still
// drifted 1 span (low x4 / medium x1) -- so per the rule "target 0, else drop LOW" the boundary
// is removed entirely: no LOW/MEDIUM line left to flap. HIGH is only ever the unbacked-absolute
// pass, MEDIUM is everything else the model flags. (FlagSeverity keeps "low" in the type for the
// stored history of older runs; nothing emits it now.)

// Pure, exported so the honesty enforcement is independently testable without a key:
// keep only rubric criteria, compute a transparent overall, drop non-verbatim spans,
// derive the recommended version from the scores, and COMPUTE each flag's severity.
// A fix that asks for no change -> leave the span untouched in the corrected version.
function isNoOpFix(fix: string): boolean {
  return /^\s*(no fix|no change|works as|leave (as|it|this)|keep (as|it|this)|fine as|already|n\/a|none|unchanged)\b/i.test(fix);
}

// Reduce a fix to the drop-in replacement text. `fix` is meant to be a rewrite of the span, but
// the model sometimes wraps it as an instruction ("Replace with '...' to remove X"). If so, use
// the quoted rewrite; otherwise the fix as written. Pure parsing of an already-generated field.
function cleanFix(fix: string): string {
  if (/^\s*(replace|change|rewrite|reword|swap|use|drop)\b/i.test(fix)) {
    const quoted = [...fix.matchAll(/["'“]([^"'”]{3,})["'”]/g)].map((m) => m[1].trim());
    if (quoted.length) return quoted.sort((a, b) => b.length - a.length)[0];
  }
  return fix;
}

// Assemble the recommended text with every APPLICABLE fix already applied: a single copy-pasteable
// corrected version, diagnosis to cure. PURE ASSEMBLY from fixes ALREADY generated -- no second
// evaluation, no re-check. The `fix` the model returns is a rewrite of the SENTENCE the flagged
// span sits in (not a drop-in for the bare span -- swapping the span alone duplicates surrounding
// words), so a fix replaces the whole sentence that verbatim-contains its span. A span not found
// verbatim is skipped (never hallucinated); a sentence already rewritten by an earlier (HIGH-first)
// flag is left as it is; a fix equal to the sentence is a no-op. Untouched sentences are preserved.
export function buildCorrectedVersion(text: string, flags: LineFlag[], aiTells: AiTell[] = []): string {
  const edits: { start: number; end: number; replacement: string }[] = [];
  const taken: Array<[number, number]> = [];
  for (const f of flags) {
    const span = (f.span || "").trim();
    if (!span || isNoOpFix(f.fix || "")) continue;
    const replacement = cleanFix((f.fix || "").trim());
    if (!replacement) continue;
    const idx = text.indexOf(span);
    if (idx === -1) continue;                                    // not verbatim -> skip, never hallucinate
    // Expand to the sentence that contains the span (the scope the fix is written for).
    let s = idx;
    while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
    while (s < idx && /\s/.test(text[s])) s++;                   // trim leading whitespace of the sentence
    let e = idx + span.length;
    if (!/[.!?]/.test(text[e - 1])) {                           // unless the span already ends the sentence
      while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
      if (e < text.length && /[.!?]/.test(text[e])) e++;        // include the terminal . ! ?
    }
    if (taken.some(([ts, te]) => s < te && ts < e)) continue;   // sentence already rewritten by a prior flag
    if (norm(replacement) === norm(text.slice(s, e))) continue; // fix equals the sentence -> no change
    edits.push({ start: s, end: e, replacement });
    taken.push([s, e]);
  }
  let out = text;
  if (edits.length) {
    edits.sort((a, b) => a.start - b.start);
    let acc = "", cursor = 0;
    for (const ed of edits) { acc += text.slice(cursor, ed.start) + ed.replacement; cursor = ed.end; }
    out = acc + text.slice(cursor);
  }
  // De-slop, but ONLY the grammatically-safe swap: em dash -> comma (also the founder's pet peeve).
  // Word/phrase swaps are NOT clean drop-ins ("a myriad of" -> "a many of"), so they stay advisory in
  // the AI-tells section for the human to apply, rather than corrupting the corrected copy.
  for (const t of aiTells) {
    if (t.kind !== "em_dash" || t.replacement === undefined || !t.span || !out.includes(t.span)) continue;
    out = out.split(t.span).join(t.replacement);
  }
  return out.replace(/ {2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1"); // tidy spacing
}

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
  const overlap = (a: string, b: string) => { const x = norm(a), y = norm(b); return x.includes(y) || y.includes(x); };

  // 1) Mandatory absolute-claim gate, FAIL-CLOSED. Code finds every absolute claim; the model must
  //    affirmatively verdict THAT sentence `backed` or it becomes a HIGH flag. Dedup and the gate
  //    key on the SENTENCE (the claim identity), never on the display quote, so the set of HIGH
  //    flags the gate consumes cannot wobble with how tightly the model quotes.
  const absSentences: { label: string; sentence: string }[] = [];
  const verdicts = raw.absolute_verdicts || [];
  for (const { label, claim: sentence } of findAbsoluteClaims(prepared)) {
    const p = prepByLabel.get(label);
    if (!p) continue;
    const v = verdicts.find((x) => (x.candidate || "").trim().toUpperCase() === label && sameClaim(norm(x.claim || ""), norm(sentence)));
    if (v && v.backed === true) continue;                 // the model affirmatively cleared THIS sentence
    if (absSentences.some((r) => r.label === label && overlap(r.sentence, sentence))) continue; // already recorded
    absSentences.push({ label, sentence });
    flags.push({ candidateIndex: p.index, candidateLabel: p.label, span: displaySpan(p, sentence, v?.quote), issue: "overpromise", severity: "high",
      why: ((v?.why || "").trim() || "This makes an absolute claim the copy does not back up.").slice(0, 300),
      fix: ((v?.fix || "").trim() || "Qualify the claim or name what backs it.").slice(0, 400) });
  }

  // 2) Open-ended flags (non-absolute problems), always MEDIUM. A span survives only if it is
  //    verbatim in its candidate and does not restate an absolute already recorded above (compared
  //    on the absolute SENTENCE, not the display span) or a prior open-ended flag.
  for (const f of raw.flags || []) {
    const p = prepByLabel.get((f.candidate || "").trim().toUpperCase());
    if (!p) continue;
    const span = (f.span || "").trim();
    if (!span || !p.normText.includes(norm(span))) continue; // dropped: not verbatim in the candidate
    const why = (f.why || "").trim();
    const fix = (f.fix || "").trim();
    if (!why || !fix) continue;
    if (absSentences.some((r) => r.label === p.label && overlap(r.sentence, span))) continue; // same as a HIGH absolute
    if (flags.some((h) => h.candidateLabel === p.label && h.severity !== "high" && overlap(h.span, span))) continue; // dup open-ended
    const issue = (ISSUES as string[]).includes((f.issue || "").trim().toLowerCase()) ? ((f.issue || "").trim().toLowerCase() as FlagIssue) : "other";
    flags.push({ candidateIndex: p.index, candidateLabel: p.label, span: span.slice(0, 400), issue, severity: "medium", why: why.slice(0, 300), fix: fix.slice(0, 400) });
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

  // Corrected version (display-layer consolidation): the ship-pick with its fixes already applied,
  // or, when there is a single candidate (a critique, not a pick), that one. Assembly only -- it
  // never touches the gate, the scores, or the recommendation, and does not re-check the result.
  const correctTarget = recommendedIndex != null ? recommendedIndex : (candidates.length === 1 ? candidates[0].index : null);
  if (correctTarget != null) {
    const tc = candidates.find((c) => c.index === correctTarget);
    if (tc) {
      // "Reads as AI-written": DETERMINISTIC tell scan (findAiTells) + the model's holistic read.
      // LOW/MEDIUM, its own section, NEVER touches the gate. Human-read prose only (not agent_action).
      const isTellType = AI_TELLS_TYPES.has(outputType);
      const found = isTellType ? findAiTells(tc.text) : { tells: [] as AiTell[], verdict: "clean" as const, density: 0, count: 0 };
      const readsAs = ["human", "ai", "mixed"].includes(raw.reads_as as string) ? (raw.reads_as as "human" | "ai" | "mixed") : undefined;
      if (isTellType && (found.count > 0 || readsAs)) {
        tc.aiReview = { tells: found.tells, verdict: found.verdict, density: found.density, count: found.count, readsAs, readsAsNote: (raw.reads_as_note || "").trim().slice(0, 240) || undefined };
      }
      // Corrected version: ship-pick with overpromise fixes applied AND the AI tells de-slopped.
      const corrected = buildCorrectedVersion(tc.text, flags.filter((f) => f.candidateIndex === correctTarget), found.tells);
      if (corrected && corrected !== tc.text) tc.correctedVersion = corrected; // only when something changed
    }
  }

  // Instruction fit (present only when an original request was supplied). Attached PER candidate so
  // comparison mode shows how each version did the task. Informational -- never touches the gate.
  for (const f of raw.instruction_fit || []) {
    const p = prepByLabel.get((f.candidate || "").trim().toUpperCase());
    const c = p ? candidates.find((x) => x.index === p.index) : undefined;
    if (!c) continue;
    const list = (a: string[] | undefined, n: number) => (a || []).map((s) => (s || "").trim()).filter(Boolean).slice(0, n);
    c.instructionFit = {
      score: bandScore("instruction_fit", clampScore(f.score)),
      met: list(f.met, 12), missed: list(f.missed, 12), contradictions: list(f.contradictions, 8),
      fix: (f.fix || "").trim().slice(0, 400),
    };
  }

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
  const task = (input.originalRequest || "").trim().slice(0, 20000);
  const PROMPT =
    `You are an evaluation engine reviewing AI-generated ${typeLabel} ${published ? "that is already published and live in production" : "for the team about to ship it"}. Give an honest, specific assessment. You are an AI assessment, not a human judgment and not a guarantee.\n\n` +
    (ctx ? `${ctx}\n\n` : "") +
    (task ? `The AI was ORIGINALLY ASKED to produce the following. Judge INSTRUCTION FIT against this, and judge ONLY against what is actually asked here (never penalize for things the request never mentions):\n"""\n${task}\n"""\n\n` : "") +
    `Score each version on these criteria, 0 to 100 (higher is better). Use the exact criterion key:\n${criteriaBlock}\n\n` +
    (multi ? `There are ${prepared.length} versions to compare:\n\n${candidatesBlock}\n\n` : `One version to review:\n\n${candidatesBlock}\n\n`) +
    `Return:\n` +
    `- candidates: for EACH version, its label (e.g. "A"), a one-line summary, and a score for EVERY criterion above (exact key) with a one-line note.\n` +
    `- flags: specific line-level problems. For each: candidate (the version letter), span (the EXACT problem text copied WORD FOR WORD from that version, never paraphrased), issue (one of: dismissive, overpromise, confusing, risky, inaccurate, tone, other), severity (low, medium, high), why (one line), and fix (a concrete rewrite of just that span).\n` +
    (absClaims.length
      ? `- absolute_verdicts: the text makes the absolute or universal claims listed below, and you MUST return a verdict on EVERY one. For each: candidate (letter), claim (copy the sentence EXACTLY as it appears in the list below, character for character, no more and no less -- this is how your verdict is matched to the claim), backed (judged from the WHOLE sentence and its surrounding copy: true ONLY if they substantiate it with a real mechanism, specifics, or evidence; false if the product cannot literally deliver it or nothing on the page backs it), quote (the SHORTEST exact phrase WITHIN that sentence that carries the claim, copied verbatim, used only to display the flag; it does NOT change the backed judgment), why (one line), fix (a concrete rewrite). Judge honestly and independently, always on the full sentence and its context: "works with every major tool: Slack, Gmail, and Notion" is backed; "We never sell your data." next to copy about encryption and privacy is a backed policy statement; "automate any app" with nothing behind it is NOT backed. The claims:\n${absList}\n`
      : "") +
    (multi
      ? `- recommendation: one plain sentence naming which version to ship and why.\n`
      : published
        ? `- recommendation: one plain sentence naming the single highest-impact change to make now. This content is already live, so do NOT frame it as ready or not ready to ship.\n`
        : `- recommendation: one plain sentence on whether this is ready to ship and the single most important change.\n`) +
    (AI_TELLS_TYPES.has(outputType)
      ? `- reads_as: does the recommended version read as written by a human or by AI? One of: human, ai, mixed. reads_as_note: one short line on the giveaways (or what keeps it human). This is a HOLISTIC read only; do NOT create flags for it.\n`
      : `\n`) +
    (task
      ? `- instruction_fit: for EACH version, judge how fully it did what the ORIGINAL REQUEST asked. Return candidate (letter), score (0-100, how completely it satisfied the request), met (requirements clearly satisfied), missed (requirements missed or only partly done), contradictions (anything that directly contradicts the request), fix (the single highest-impact change to better satisfy the request). This is SEPARATE from the quality scores: a well-written version can still miss the task, and a plain one can nail it. Judge only against stated requirements.\n\n`
      : "") +
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
      max_tokens: task ? 3600 : 2600, // instruction_fit adds per-candidate output; give it headroom

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
    if (task) result.originalRequest = task;
    return result;
  } catch (e) {
    console.error("evaluateOutput failed:", e);
    return null; // transient failure: caller renders nothing / can retry
  }
}
