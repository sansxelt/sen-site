// INVALIDATION: a verdict Vraelis produced from its own defect must stop counting without being rewritten.
//
// Three verifications told the demo account that Notewell's sign-in, account creation and pricing flows were
// broken. Notewell was not broken. The worker's locator resolver only ever built getByRole("button"), so
// every anchor styled as a button timed out and was reported as the customer's failure.
//
// Deleting those runs would be dishonest and editing their verdicts would be worse: the decision a customer
// was shown is a historical fact, and a product whose records change retroactively is worth less than one
// whose records are wrong but honest. So invalidation is orthogonal to the verdict. state and decision keep
// exactly what they said; what changes is whether the run still COUNTS.
//
// pickHealthRun is pure, so most of this is behavioural rather than a source assertion: real run shapes in,
// real selection out.
import { readFileSync } from "node:fs";
import { pickHealthRun, isLaunchHealthCandidate, isInvalidatedRun, type HealthRunLike } from "../lib/preflight/target-url";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const run = (o: Partial<HealthRunLike> & { created_at: string }): HealthRunLike => ({
  state: "completed", decision: "failed", summary: null, invalidated_at: null, ...o,
});
const AT = "2026-07-20T10:00:00Z";

console.log("── the rule itself ──");
ok("a run with no invalidation counts", !isInvalidatedRun({ invalidated_at: null }));
ok("a run with an invalidation timestamp does not", isInvalidatedRun({ invalidated_at: AT }));
ok("an undefined field (pre-migration) counts as valid", !isInvalidatedRun({}));

console.log("\n── an invalidated run can never be the health verdict ──");
ok("an invalidated completed run is not a health candidate",
  !isLaunchHealthCandidate(run({ created_at: "2026-07-20T10:00:00Z", decision: "failed", invalidated_at: AT })));
ok("the same run WITHOUT the invalidation is a candidate",
  isLaunchHealthCandidate(run({ created_at: "2026-07-20T10:00:00Z", decision: "failed" })));

// THE DEMO ACCOUNT'S EXACT SHAPE: every run it has was produced by the resolver defect.
{
  const all = [
    run({ created_at: "2026-07-20T12:00:00Z", decision: "failed", invalidated_at: AT }),
    run({ created_at: "2026-07-20T11:00:00Z", decision: "blocked", invalidated_at: AT }),
    run({ created_at: "2026-07-20T10:00:00Z", decision: "blocked", invalidated_at: AT }),
  ];
  // If invalidated runs were only skipped by the CANDIDATE filter, the honest-fallback branch would still
  // return one of them and the system would keep reporting the verdict we established was untrue.
  ok("a history of nothing but invalidated runs yields NO verdict", pickHealthRun(all) === undefined,
    "the fallback must not resurrect an invalidated run");
}

console.log("\n── a valid verdict still wins, and still loses to a newer valid one ──");
{
  const runs = [
    run({ created_at: "2026-07-22T10:00:00Z", decision: "failed", invalidated_at: AT }),   // newest, invalid
    run({ created_at: "2026-07-21T10:00:00Z", decision: "verified" }),                      // newest VALID
    run({ created_at: "2026-07-20T10:00:00Z", decision: "failed" }),
  ];
  const picked = pickHealthRun(runs);
  ok("the newest VALID run is chosen over a newer invalidated one", picked?.decision === "verified");
  ok("it is the run itself, not a synthesized verdict", picked?.created_at === "2026-07-21T10:00:00Z");
}
{
  // The baseline -> regression -> repair arc: the newest valid result must win, including when it is a
  // failure. Invalidation must never be a way to make a real failure disappear.
  const runs = [
    run({ created_at: "2026-07-23T10:00:00Z", decision: "failed" }),
    run({ created_at: "2026-07-22T10:00:00Z", decision: "verified" }),
  ];
  ok("a genuine newer FAILURE still wins over an older pass", pickHealthRun(runs)?.decision === "failed");
}

console.log("\n── invalidation does not disturb the rules that already existed ──");
{
  const active = run({ created_at: "2026-07-23T10:00:00Z", state: "running", decision: null });
  ok("an in-flight run still surfaces as in progress",
    pickHealthRun([active, run({ created_at: "2026-07-22T10:00:00Z", decision: "verified" })]) === active);
  // An invalidated in-flight run is a contradiction, but if one exists it must not surface either.
  const deadActive = run({ created_at: "2026-07-23T11:00:00Z", state: "running", decision: null, invalidated_at: AT });
  const good = run({ created_at: "2026-07-22T10:00:00Z", decision: "verified" });
  ok("an invalidated in-flight run does not surface", pickHealthRun([deadActive, good]) === good);
}
ok("a partial-coverage rerun is still not a launch verdict",
  !isLaunchHealthCandidate(run({ created_at: AT, decision: "verified", summary: { coverage: "partial" } })));
ok("repair_verified is still not a launch verdict",
  !isLaunchHealthCandidate(run({ created_at: AT, decision: "repair_verified" })));
ok("an empty history is still undefined", pickHealthRun([]) === undefined);

console.log("\n── the verdict is preserved, only its standing changes ──");
{
  const sql = readFileSync("sql/vraelis-preflight-24-run-invalidation.sql", "utf8");
  const body = sql.replace(/^--.*$/gm, "");
  ok("the migration adds only invalidation fields", /invalidated_at/.test(sql) && /invalidated_reason/.test(sql));
  ok("it never updates a run row", !/^\s*update\s+/im.test(body));
  ok("it never touches state or decision", !/\bset\s+(state|decision)\b/i.test(body));
  ok("it is attributable", /invalidated_by/.test(sql) && /invalidated_ref/.test(sql));

  // The operator action must refuse to act anonymously or without a stated, checkable reason: an
  // unattributed invalidation is indistinguishable from a quiet edit.
  const ops = readFileSync("ops/invalidate-run.ts", "utf8");
  ok("the ops action demands an identity", /Say who is doing this/.test(ops));
  ok("it demands a customer-readable reason", /Say why, in a sentence a customer can read/.test(ops));
  ok("it demands a defect reference", /Reference the defect/.test(ops));
  ok("it writes only invalidation fields", !/state:/.test(ops) && !/decision:/.test(ops));
  ok("it is dry by default", /Nothing was written\. Re-run with --apply/.test(ops));
}

console.log("\n── the findings of an invalidated run stop counting too ──");
{
  // The dashboard's critical counts come from issues, not runs, so excluding the run alone would leave the
  // same false story on screen through a different surface.
  const ov = readFileSync("lib/preflight/overview-db.ts", "utf8");
  ok("issues are filtered by their most recent sighting", /last_seen_run/.test(ov) && /invalidated_at/.test(ov));
  ok("the filter excludes only invalidated sightings", /not\("invalidated_at", "is", null\)/.test(ov));
  ok("a missing column degrades to counting everything, as before",
    /invalidated_at is missing/.test(ov));
}

console.log("\n── a customer can see that it was ours ──");
{
  const record = readFileSync("app/rank/app/applications/[id]/passes/[runId]/page.tsx", "utf8");
  ok("the record labels an invalidated run", /Invalidated \(verifier defect\)/.test(record));
  ok("it states the reason", /run\.invalidation\.reason/.test(record));
  ok("it says the evidence is preserved and uncounted", /no longer counted toward this/.test(record));
  ok("it shows the defect reference", /run\.invalidation\.ref/.test(record));
}

console.log("\n── the history list does not file it as an application failure ──");
{
  const list = readFileSync("app/rank/app/passes/page.tsx", "utf8");
  // Split out BEFORE the verdict grouping, so there is no ordering in which it could still be counted.
  ok("invalidated runs are separated before grouping", /const invalidated = passes\.filter\(\(p\) => !!p\.invalidatedAt\)/.test(list));
  ok("the verdict sections are built from the remainder",
    /const live = passes\.filter\(\(p\) => !p\.invalidatedAt\)/.test(list) && /const running = live\.filter/.test(list));
  ok("they get their own labelled section", /Invalidated \(verifier defect\)/.test(list));
  ok("the run list carries the invalidation",
    /invalidatedAt: \(r\.invalidated_at as string\)/.test(readFileSync("lib/preflight/overview-db.ts", "utf8")));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
