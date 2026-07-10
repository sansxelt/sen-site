// Credit-free verification of instruction fit AND the task-fit recommendation/verdict logic,
// exercised through finalizeEvaluation with hand-built raw model output (no API, no credits).
// Run:  npx tsx scripts/instruction-fit-verify.ts
import { prepareCandidates, finalizeEvaluation, taskOutcome } from "../lib/v-evaluator";

const CRIT = ["empathy", "resolution", "tone", "accuracy"]; // support_reply rubric -> overall = mean = the value
type Fit = { score: number; met?: string[]; missed?: string[]; contradictions?: string[]; fix?: string };
type Cand = { label: string; overall: number; fit?: Fit };

function build(cands: Cand[]) {
  return {
    candidates: cands.map((c) => ({ label: c.label, summary: "", scores: CRIT.map((k) => ({ criterion: k, score: c.overall, note: "" })) })),
    flags: [], absolute_verdicts: [], recommendation: "model's own sentence",
    instruction_fit: cands.filter((c) => c.fit).map((c) => ({ candidate: c.label, score: c.fit!.score, met: c.fit!.met || [], missed: c.fit!.missed || [], contradictions: c.fit!.contradictions || [], fix: c.fit!.fix || "" })),
  };
}
function run(texts: string[], cands: Cand[]) {
  const prepared = prepareCandidates({ outputType: "support_reply", candidates: texts.map((t) => ({ text: t })) } as never);
  return finalizeEvaluation("support_reply" as never, prepared, build(cands) as never, "test");
}
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); if (cond) pass++; else fail++; };

// 0) No request -> unchanged: recommendation is argmax(overall), no taskFit.
const t0 = run(["a", "b"], [{ label: "A", overall: 88 }, { label: "B", overall: 74 }]);
ok("0 no-request: recommend higher overall (A)", t0.recommendedLabel === "A" && !t0.taskFit && !t0.recommendedOnTaskFit);

// 1) THE CORE FIX: A is better written (88) but contradicts the request (fit 35); B follows it (95, 74).
//    B must win, flagged as a task-fit win, and the verdict is SHIP for B.
const t1 = run(["well written A", "plainer B"], [
  { label: "A", overall: 88, fit: { score: 35, contradictions: ["promises a refund the request forbade"], missed: ["ignores the no-refund rule"] } },
  { label: "B", overall: 74, fit: { score: 95, met: ["follows the no-refund rule"] } },
]);
ok("1 task-fit override: recommend B despite lower overall", t1.recommendedLabel === "B", `rec=${t1.recommendedLabel} margin=${t1.margin}`);
ok("1 recommendedOnTaskFit flag set", t1.recommendedOnTaskFit === true);
ok("1 verdict is SHIP for B", t1.taskFit?.outcome === "ship" && t1.taskFit?.label === "B");
ok("1 no HIGH flag manufactured from the contradiction", t1.flags.filter((f) => f.severity === "high").length === 0);

// 2) Outcomes on a single candidate (no comparison): ship / revise / fails.
const ship = run(["clean"], [{ label: "A", overall: 80, fit: { score: 95, met: ["did it"] } }]);
ok("2 outcome SHIP (fit 95, no risk flag)", ship.taskFit?.outcome === "ship");
const revise = run(["clean"], [{ label: "A", overall: 70, fit: { score: 60, missed: ["missed a rule"] } }]);
ok("2 outcome REVISE (fit 60)", revise.taskFit?.outcome === "revise");
const fails = run(["clean"], [{ label: "A", overall: 70, fit: { score: 30, contradictions: ["contradicts the ask"] } }]);
ok("2 outcome FAILS (fit 30 + contradiction)", fails.taskFit?.outcome === "fails");

// 3) meets on task BUT a HIGH risk flag on the pick -> REVISE (risk blocks ship), and the HIGH flag
//    comes from the absolute-claim gate, not from instruction fit.
const risk = run(["Our tool always works and never fails."], [{ label: "A", overall: 80, fit: { score: 90, met: ["did the task"] } }]);
const highs = risk.flags.filter((f) => f.severity === "high").length;
ok("3 risk block: HIGH flag exists from the absolute-claim gate", highs > 0, `${highs} high`);
ok("3 verdict downgraded to REVISE despite task meets", risk.taskFit?.outcome === "revise");

// 4) Misses/contradiction never become HIGH flags on clean text.
const t4 = run(["Thanks for reaching out. I have flagged this for our team and will follow up soon."], [{ label: "A", overall: 70, fit: { score: 20, contradictions: ["totally contradicts"], missed: ["missed x", "missed y"] } }]);
ok("4 task failure adds zero HIGH flags", t4.flags.filter((f) => f.severity === "high").length === 0 && t4.taskFit?.outcome === "fails");

// 5) Malformed instruction_fit: a bogus candidate letter is skipped, the valid one still attaches, no crash.
const p5 = prepareCandidates({ outputType: "support_reply", candidates: [{ text: "clean" }] } as never);
const raw5 = { candidates: [{ label: "A", summary: "", scores: CRIT.map((k) => ({ criterion: k, score: 70, note: "" })) }], flags: [], absolute_verdicts: [], recommendation: "", instruction_fit: [{ candidate: "Z", score: 50 }, { candidate: "A", score: 88, met: ["ok"] }] };
const t5 = finalizeEvaluation("support_reply" as never, p5, raw5 as never, "test");
ok("5 malformed: bogus letter skipped, valid attaches", t5.candidates[0].instructionFit?.score === 90 && t5.taskFit?.outcome === "ship");

// 6) taskOutcome thresholds are consistent with the tiers used for ranking.
ok("6 taskOutcome bands", taskOutcome({ score: 95, met: [], missed: [], contradictions: [], fix: "" }) === "meets"
  && taskOutcome({ score: 60, met: [], missed: [], contradictions: [], fix: "" }) === "revise"
  && taskOutcome({ score: 90, met: [], missed: [], contradictions: ["x"], fix: "" }) === "fails"
  && taskOutcome({ score: 40, met: [], missed: [], contradictions: [], fix: "" }) === "fails"
  && taskOutcome(undefined) === null);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
