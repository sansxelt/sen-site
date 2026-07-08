// Throwaway credit-free proof of the fail-open fix (adversarial review 2026-07). Run:
//   npx tsx scripts/gate-test.ts
// Verifies the strict verdict<->sentence binding: a whitespace/short/shared claim can no longer
// clear a genuinely unbacked absolute, while a correctly-echoed backed absolute still clears.
import { prepareCandidates, finalizeEvaluation } from "../lib/v-evaluator";

type Case = { name: string; text: string; verdicts: { candidate: string; claim: string; backed: boolean; quote?: string }[]; expectHigh: number };

const CASES: Case[] = [
  { name: "whitespace claim cannot clear (was fail-open)", text: "Automate anything instantly.",
    verdicts: [{ candidate: "A", claim: " ", backed: true }], expectHigh: 1 },
  { name: "short shared claim cannot cross-clear (was fail-open)", text: "We guarantee refunds within 30 days. We guarantee results.",
    verdicts: [{ candidate: "A", claim: "We guarantee", backed: true }], expectHigh: 2 },
  { name: "backed absolute still clears (regression guard)", text: "We never sell your data. Your information stays private and is encrypted at rest and in transit.",
    verdicts: [{ candidate: "A", claim: "We never sell your data.", backed: true }], expectHigh: 0 },
  { name: "backed clears even with trailing-punct / case diff", text: "We never sell your data. Your information stays private and is encrypted at rest and in transit.",
    verdicts: [{ candidate: "A", claim: "we never sell your data", backed: true }], expectHigh: 0 },
  { name: "unbacked absolute -> HIGH", text: "Automate anything instantly.",
    verdicts: [{ candidate: "A", claim: "Automate anything instantly.", backed: false }], expectHigh: 1 },
  { name: "un-verdicted absolute -> HIGH (fail-closed)", text: "Works with every tool you use.",
    verdicts: [], expectHigh: 1 },
];

let pass = 0;
for (const c of CASES) {
  const prepared = prepareCandidates({ outputType: "marketing_copy", candidates: [{ text: c.text }] } as never);
  const raw = { candidates: [{ label: "A", summary: "", scores: [] }], flags: [], absolute_verdicts: c.verdicts.map((v) => ({ ...v, why: "w", fix: "f" })), recommendation: "" };
  const res = finalizeEvaluation("marketing_copy", prepared, raw as never, "test");
  const high = res.flags.filter((f) => f.severity === "high");
  const passed = !high.length; // gate with no threshold
  const ok = high.length === c.expectHigh;
  if (ok) pass++;
  console.log(`${ok ? "OK " : "XX "} HIGH=${high.length} (want ${c.expectHigh}) gate.passed=${passed}  ${c.name}`);
  if (!ok || process.env.VERBOSE) high.forEach((h) => console.log(`      high span: "${h.span}"`));
}
console.log(`\n${pass}/${CASES.length} cases correct.`);
process.exit(pass === CASES.length ? 0 : 1);
