// Credit-free verification of the two integrity fixes: the conditional Custom rubric, and the
// deprecated-threshold-criterion compatibility layer. Run: npx tsx scripts/taxonomy-compat.ts
import { rubricFor, finalizeEvaluation, prepareCandidates } from "../lib/v-evaluator";
import { resolveThresholdCriteria } from "../lib/v-gate";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── Fix 2: Custom (other) rubric is conditional on an original request ──
const withReq = rubricFor("other", true).map((c) => c.key);
const noReq = rubricFor("other", false).map((c) => c.key);
ok("other WITH request grades instruction fit (intent_fit), not relevance", withReq.includes("intent_fit") && !withReq.includes("relevance"), withReq.join(","));
ok("other WITHOUT request grades relevance, not instruction fit", noReq.includes("relevance") && !noReq.includes("intent_fit"), noReq.join(","));
ok("non-other type is unaffected by hasRequest", JSON.stringify(rubricFor("marketing_copy", false).map((c) => c.key)) === JSON.stringify(rubricFor("marketing_copy", true).map((c) => c.key)));

function finOther(hasReq: boolean, scoreKeys: string[]) {
  const prepared = prepareCandidates({ outputType: "other", candidates: [{ text: "some output text" }] } as never);
  const raw = { candidates: [{ label: "A", summary: "", scores: scoreKeys.map((k) => ({ criterion: k, score: 80, note: "" })) }], flags: [], absolute_verdicts: [], recommendation: "" };
  return finalizeEvaluation("other" as never, prepared, raw as never, "test", hasReq);
}
const rel = finOther(false, ["clarity", "relevance", "effectiveness", "risk"]);
ok("finalize (no request) matches the relevance score", rel.candidates[0].scores.some((s) => s.criterion === "relevance") && rel.candidates[0].overall === 80, `overall=${rel.candidates[0].overall}`);
const fit = finOther(true, ["clarity", "intent_fit", "effectiveness", "risk"]);
ok("finalize (with request) matches the instruction-fit score", fit.candidates[0].scores.some((s) => s.criterion === "intent_fit") && fit.candidates[0].overall === 80);

// ── Fix 1: deprecated threshold criteria are remapped or rejected, never silently failed ──
const alias = resolveThresholdCriteria("marketing_copy" as never, { criteria: { overpromise: 80 } });
ok("marketing 'overpromise' remapped to 'credibility'", alias.ok && alias.spec.criteria?.credibility === 80 && alias.spec.criteria?.overpromise === undefined, alias.ok ? JSON.stringify(alias.spec.criteria) : "rejected");
const aliasAgent = resolveThresholdCriteria("agent_action" as never, { criteria: { completeness: 70 } });
ok("agent 'completeness' remapped to 'task_completion'", aliasAgent.ok && aliasAgent.spec.criteria?.task_completion === 70);
const reject = resolveThresholdCriteria("marketing_copy" as never, { criteria: { brand_tone: 80 } });
ok("dropped 'brand_tone' (no successor) rejected + names valid keys", !reject.ok && reject.unsupported.includes("brand_tone") && reject.valid.includes("credibility"));
const rejectTone = resolveThresholdCriteria("other" as never, { criteria: { tone: 80 } });
ok("'tone' invalid for 'other' rejected", !rejectTone.ok && rejectTone.unsupported.includes("tone"));
const good = resolveThresholdCriteria("support_reply" as never, { criteria: { empathy: 80, policy_compliance: 70 } });
ok("valid support_reply criteria pass through unchanged", good.ok && good.spec.criteria?.empathy === 80 && good.spec.criteria?.policy_compliance === 70);
const union = resolveThresholdCriteria("other" as never, { criteria: { relevance: 60, intent_fit: 60 } });
ok("'other' accepts BOTH relevance and intent_fit (union of conditional variants)", union.ok);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail) process.exit(1);
