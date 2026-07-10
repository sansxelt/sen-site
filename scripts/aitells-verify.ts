// Credit-free verification of the "reads as AI-written" feature end to end through
// finalizeEvaluation. Run:  npx tsx scripts/aitells-verify.ts
import { prepareCandidates, finalizeEvaluation } from "../lib/v-evaluator";
import { findAiTells } from "../lib/ai-tells";

const ai = "In today's fast-paced world, our robust platform lets you seamlessly leverage a myriad of tools — it's not just software, it's a game-changer. When it comes to results, our solution is fast, reliable, and secure.";
const r = findAiTells(ai);
console.log(`AI text -> verdict: ${r.verdict} | density: ${r.density} | ${r.count} tells`);
r.tells.forEach((t) => console.log(`  [${t.kind}] "${t.span}" -> ${t.fix}${t.replacement !== undefined ? `  swap:"${t.replacement}"` : ""}`));
const clean = findAiTells("Cut invoice approval from three days to four hours. It connects with Slack, Gmail, and Notion today, and you can undo any change.");
console.log(`\nCLEAN text (with a real tool list) -> verdict: ${clean.verdict} | ${clean.count} tells  (must be clean, no false positive)`);

function run(outputType: string, text: string) {
  const prepared = prepareCandidates({ outputType, candidates: [{ text }] } as never);
  const raw = { candidates: [{ label: "A", summary: "", scores: [] }], flags: [], absolute_verdicts: [], recommendation: "", reads_as: "ai", reads_as_note: "Buzzword-heavy, no specifics." };
  return finalizeEvaluation(outputType as never, prepared, raw as never, "test").candidates[0];
}
console.log("\n=== finalizeEvaluation (marketing_copy) ===");
const before = "In today's fast-paced world, our robust platform lets you seamlessly leverage a myriad of tools to elevate your workflow.";
const mk = run("marketing_copy", before);
console.log(`aiReview: verdict=${mk.aiReview?.verdict} count=${mk.aiReview?.count} readsAs=${mk.aiReview?.readsAs} note="${mk.aiReview?.readsAsNote}"`);
console.log("BEFORE:", before);
console.log("AFTER: ", mk.correctedVersion);

console.log("\n=== corrected version applies the SAFE em-dash swap ===");
const emText = "Our tool ships fast — really fast. It handles the work for you.";
const em = run("marketing_copy", emText);
console.log("BEFORE:", emText);
console.log("AFTER: ", em.correctedVersion, em.correctedVersion && !em.correctedVersion.includes("—") ? "(em dash removed, grammar intact)" : "");

console.log("\n=== agent_action -> AI tells DISABLED ===");
const ag = run("agent_action", "Furthermore, the robust system will seamlessly leverage the pivotal data.");
console.log(`aiReview present? ${ag.aiReview ? "YES (wrong)" : "no (correct: agent_action excluded)"}`);
