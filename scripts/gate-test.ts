// Throwaway credit-free regression test for the gate/absolute-pass fixes (adversarial review
// 2026-07). Run:  npx tsx scripts/gate-test.ts
// Covers: strict verdict<->sentence binding (fail-open fix), sentence-keyed dedup (no collapse on
// a shared quote), and safe display-span selection (unique/exact-case quote, else the sentence).
import { prepareCandidates, finalizeEvaluation } from "../lib/v-evaluator";

type V = { candidate: string; claim: string; backed: boolean; quote?: string };
type F = { candidate: string; span: string; issue?: string; why?: string; fix?: string };
type Case = {
  name: string; text: string; verdicts: V[]; flags?: F[];
  expectHigh: number; expectMedium?: number; spanEquals?: string; spanIncludes?: string;
};

const CASES: Case[] = [
  // --- strict binding: the fail-open the review found ---
  { name: "whitespace claim cannot clear (was fail-open)", text: "Automate anything instantly.",
    verdicts: [{ candidate: "A", claim: " ", backed: true }], expectHigh: 1 },
  { name: "short shared claim cannot cross-clear (was fail-open)", text: "We guarantee refunds within 30 days. We guarantee results.",
    verdicts: [{ candidate: "A", claim: "We guarantee", backed: true }], expectHigh: 2 },
  { name: "backed absolute still clears (regression guard)", text: "We never sell your data. Your information stays private and is encrypted at rest and in transit.",
    verdicts: [{ candidate: "A", claim: "We never sell your data.", backed: true }], expectHigh: 0 },
  { name: "backed clears with trailing-punct / case diff", text: "We never sell your data. Your information stays private and is encrypted at rest and in transit.",
    verdicts: [{ candidate: "A", claim: "we never sell your data", backed: true }], expectHigh: 0 },
  { name: "unbacked absolute -> HIGH", text: "Automate anything instantly.",
    verdicts: [{ candidate: "A", claim: "Automate anything instantly.", backed: false }], expectHigh: 1 },
  { name: "un-verdicted absolute -> HIGH (fail-closed)", text: "Works with every tool you use.",
    verdicts: [], expectHigh: 1 },

  // --- sentence-keyed dedup: two distinct absolutes with an IDENTICAL quote must both surface ---
  { name: "two distinct absolutes, shared quote -> 2 HIGH (dedup on sentence)", text: "We always ship on time. We always refund in full.",
    verdicts: [{ candidate: "A", claim: "We always ship on time.", backed: false, quote: "We always" },
               { candidate: "A", claim: "We always refund in full.", backed: false, quote: "We always" }],
    expectHigh: 2 },

  // --- display span: a quote that repeats (exact-case) in the doc is NOT unique -> fall back to
  //     the sentence (so the report can't underline a benign earlier occurrence). Sentence 1 has
  //     no absolute vocab, so only sentence 2 is a pre-found absolute. ---
  { name: "repeated quote -> span falls back to the full sentence", text: "ship faster today. we promise to ship faster every day, guaranteed.",
    verdicts: [{ candidate: "A", claim: "we promise to ship faster every day, guaranteed.", backed: false, quote: "ship faster" }],
    expectHigh: 1, spanEquals: "we promise to ship faster every day, guaranteed." },

  // --- display span: a unique, exact-case, in-sentence quote IS used ---
  { name: "unique valid quote -> tight span used", text: "We help teams move fast. We guarantee results forever with no exceptions.",
    verdicts: [{ candidate: "A", claim: "We guarantee results forever with no exceptions.", backed: false, quote: "guarantee results forever" }],
    expectHigh: 1, spanEquals: "guarantee results forever" },

  // --- open-ended flag that restates a HIGH absolute is suppressed (compared on the sentence) ---
  { name: "open-ended flag overlapping a HIGH absolute is dropped", text: "Automate anything instantly.",
    verdicts: [{ candidate: "A", claim: "Automate anything instantly.", backed: false }],
    flags: [{ candidate: "A", span: "Automate anything instantly.", issue: "overpromise", why: "hype", fix: "qualify it" }],
    expectHigh: 1, expectMedium: 0 },
];

let pass = 0;
for (const c of CASES) {
  const prepared = prepareCandidates({ outputType: "marketing_copy", candidates: [{ text: c.text }] } as never);
  const raw = {
    candidates: [{ label: "A", summary: "", scores: [] }],
    flags: (c.flags || []).map((f) => ({ issue: "overpromise", why: "w", fix: "f", ...f })),
    absolute_verdicts: c.verdicts.map((v) => ({ why: "w", fix: "f", ...v })),
    recommendation: "",
  };
  const res = finalizeEvaluation("marketing_copy", prepared, raw as never, "test");
  const high = res.flags.filter((f) => f.severity === "high");
  const medium = res.flags.filter((f) => f.severity === "medium");
  const checks: string[] = [];
  if (high.length !== c.expectHigh) checks.push(`HIGH=${high.length} want ${c.expectHigh}`);
  if (c.expectMedium != null && medium.length !== c.expectMedium) checks.push(`MED=${medium.length} want ${c.expectMedium}`);
  if (c.spanEquals != null && high[0]?.span !== c.spanEquals) checks.push(`span="${high[0]?.span}" want "${c.spanEquals}"`);
  if (c.spanIncludes != null && !(high[0]?.span || "").includes(c.spanIncludes)) checks.push(`span="${high[0]?.span}" must include "${c.spanIncludes}"`);
  const ok = checks.length === 0;
  if (ok) pass++;
  console.log(`${ok ? "OK " : "XX "} ${c.name}${ok ? "" : "  [" + checks.join("; ") + "]"}`);
}
console.log(`\n${pass}/${CASES.length} cases correct.`);
process.exit(pass === CASES.length ? 0 : 1);
