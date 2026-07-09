// Credit-free edge-case checks for buildCorrectedVersion. Run: npx tsx scripts/corrected-edge.ts
import { buildCorrectedVersion, type LineFlag } from "../lib/v-evaluator";

const mk = (span: string, fix: string): LineFlag =>
  ({ candidateIndex: 0, candidateLabel: "A", span, issue: "overpromise" as never, severity: "high" as never, why: "", fix });

let pass = 0, total = 0;
function check(name: string, got: string, want: string) {
  total++; const ok = got === want; if (ok) pass++;
  console.log(`${ok ? "OK " : "XX "} ${name}`);
  if (!ok) console.log(`   got:  ${JSON.stringify(got)}\n   want: ${JSON.stringify(want)}`);
}

check("preserves the untouched sentence",
  buildCorrectedVersion("We guarantee results. Our team is small and friendly.", [mk("We guarantee results.", "We aim to deliver results.")]),
  "We aim to deliver results. Our team is small and friendly.");

check("skips a non-verbatim span (leaves original)",
  buildCorrectedVersion("We help teams ship faster.", [mk("we promise the moon", "anything")]),
  "We help teams ship faster.");

check("leaves a no-op fix untouched",
  buildCorrectedVersion("This is fine as written today.", [mk("This is fine as written today.", "no fix needed, works as written")]),
  "This is fine as written today.");

check("extracts the quoted rewrite from a meta-instruction fix",
  buildCorrectedVersion("A dedicated team coordinates everything.", [mk("A dedicated team coordinates everything.", "Replace with 'A team coordinates your work' to remove the unbacked claim.")]),
  "A team coordinates your work");

check("two flags in one sentence: first (HIGH) wins, no double edit",
  buildCorrectedVersion("We never fail and always win.", [mk("never fail", "do our best"), mk("always win", "aim high")]),
  "do our best");

check("only the flagged sentence changes among three",
  buildCorrectedVersion("Intro line. We guarantee 100% uptime. Closing line.", [mk("We guarantee 100% uptime.", "We target high uptime with an SLA.")]),
  "Intro line. We target high uptime with an SLA. Closing line.");

console.log(`\n${pass}/${total} edge cases correct.`);
process.exit(pass === total ? 0 : 1);
