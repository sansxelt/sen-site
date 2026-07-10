// Credit-free verification of instruction-fit through finalizeEvaluation.
// Run:  npx tsx scripts/instruction-fit-verify.ts
import { prepareCandidates, finalizeEvaluation } from "../lib/v-evaluator";

function run(candTexts: string[], instruction_fit?: unknown) {
  const prepared = prepareCandidates({ outputType: "support_reply", candidates: candTexts.map((text) => ({ text })) } as never);
  const raw = {
    candidates: candTexts.map((_, i) => ({ label: String.fromCharCode(65 + i), summary: "", scores: [] })),
    flags: [], absolute_verdicts: [], recommendation: "",
    ...(instruction_fit ? { instruction_fit } : {}),
  };
  return finalizeEvaluation("support_reply" as never, prepared, raw as never, "test");
}

const a = run(["I'm sorry for the trouble. I've reversed the charge."]);
console.log("1) no request -> instructionFit present?", a.candidates[0].instructionFit ? "YES (wrong)" : "no (correct)");

const b = run(["Refund done."], [{ candidate: "A", score: 73, met: ["acknowledged the issue"], missed: ["did not avoid promising a refund"], contradictions: ["promised a refund the request said to avoid"], fix: "Remove the refund promise; offer to review the account." }]);
const bf = b.candidates[0].instructionFit;
console.log("\n2) single with request:");
console.log("   score (73 -> banded):", bf?.score);
console.log("   met:", JSON.stringify(bf?.met));
console.log("   missed:", JSON.stringify(bf?.missed));
console.log("   contradictions:", JSON.stringify(bf?.contradictions));
console.log("   fix:", bf?.fix);
console.log("   gate HIGH flags from instruction fit:", b.flags.filter((f) => f.severity === "high").length, "(must be 0 -- fit never gates)");

const c = run(["v1", "v2"], [{ candidate: "A", score: 40, met: [], missed: ["missed the main requirement"], contradictions: [], fix: "redo" }, { candidate: "B", score: 90, met: ["did the task"], missed: [], contradictions: [], fix: "minor tweak" }]);
console.log("\n3) multi (compare):");
console.log("   A fit:", c.candidates[0].instructionFit?.score, "| B fit:", c.candidates[1].instructionFit?.score, "(each version judged against the same request)");
