// Verify the corrected_version assembly on a REAL check (1 credit). Runs a multi-flag input
// through the live API, then applies buildCorrectedVersion to the real model flags and shows a
// before/after. Run:  npx tsx scripts/corrected-test.ts
import { readFileSync } from "node:fs";
import { buildCorrectedVersion, type LineFlag } from "../lib/v-evaluator";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const KEY = (process.env.VRAELIS_API_KEY || "").trim();
  const text = "Automate any app in seconds. Our AI works with every tool you use and never misses a beat. Get started instantly, no setup required.";
  const res = await fetch("https://vraelis.com/api/v1/check", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ output_type: "marketing_copy", candidates: [text] }),
  });
  if (!res.ok) { console.log(`check failed ${res.status}: ${(await res.text()).slice(0, 200)}`); process.exit(1); }
  const j = await res.json();
  const flags: LineFlag[] = (j.flags || []).map((f: { candidate?: string; span: string; issue: string; severity: string; why: string; fix: string }) =>
    ({ candidateIndex: 0, candidateLabel: f.candidate || "A", span: f.span, issue: f.issue as never, severity: f.severity as never, why: f.why, fix: f.fix }));

  console.log(`FLAGS RETURNED: ${flags.length}  (passed=${j.passed})`);
  flags.forEach((f) => console.log(`  [${f.severity}] "${f.span}"\n      fix: "${f.fix}"`));

  const corrected = buildCorrectedVersion(text, flags);
  console.log("\n=== BEFORE ===\n" + text);
  console.log("\n=== AFTER (corrected_version) ===\n" + corrected);

  // sanity checks
  const changed = corrected !== text;
  const stillHasSpan = flags.filter((f) => corrected.includes(f.span) && text.includes(f.span));
  console.log("\n--- checks ---");
  console.log(`changed from original: ${changed}`);
  console.log(`flags whose exact span still remains in corrected (should be the skipped/no-op ones only): ${stillHasSpan.length}`);
  stillHasSpan.forEach((f) => console.log(`   left as-is: "${f.span}"  (fix was: "${f.fix.slice(0, 60)}")`));
}

main().catch((e) => { console.error(String(e)); process.exit(1); });
