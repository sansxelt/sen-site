// THE FALSE VERIFIED THIS PREVENTS.
//
// A plan types a fixed value and then asserts it. Run 1 creates "Vraelis check". The application's save
// then breaks. Run 2 types "Vraelis check", writes nothing, and the assertion finds run 1's row still in
// the list. Verdict: Verified. The product is broken and Vraelis says it works.
//
// That is the exact defect class this company exists to catch, occurring inside this company's own engine,
// and it is worse than missing a defect: a false Verified is the only failure that makes every other
// verdict worth less. The whole north star is "the most trustworthy Verified in software".
//
// The fix is that each run writes something no earlier run could have written. These assertions check the
// mechanism AND simulate the failure it closes.
import { readFileSync } from "node:fs";
import {
  UNIQUE_PLACEHOLDER, runUniqueToken, applyRunUnique, containsPlaceholder, fixedValueAssertions,
} from "../lib/preflight/run-unique";
import { validateSteps } from "../lib/preflight/flow-steps";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const RUN_A = "3f9a2b71-1c4d-4e8a-9b2f-0a1b2c3d4e5f";
const RUN_B = "8c1e5d02-7a3b-4f19-8e6d-1122334455aa";

console.log("── the token belongs to one run and no other ──");
{
  ok("two runs never write the same value", runUniqueToken(RUN_A) !== runUniqueToken(RUN_B));
  // The fill and the assert are separate steps, sometimes in separate flows. If the token were random per
  // call, a flow would assert a value it never typed and every run would fail.
  ok("but one run always agrees with itself", runUniqueToken(RUN_A) === runUniqueToken(RUN_A));
  // This product writes into a customer's REAL application. Somebody finding a stray row must be able to
  // trace it to the verification that made it, rather than wondering what put it there.
  ok("the value is traceable back to its run", runUniqueToken(RUN_A).includes(RUN_A.replace(/-/g, "").slice(0, 8)));
  ok("and is short enough to sit in a title field", runUniqueToken(RUN_A).length <= 12, runUniqueToken(RUN_A));
  // No clock, no randomness: a rehearsal has to be reproducible, and a plan hash must not move.
  const src = readFileSync("lib/preflight/run-unique.ts", "utf8");
  ok("nothing here reads a clock or a random source", !/Date\.now|Math\.random|new Date/.test(strip(src)));

  // REAL IDS, taken from production. A token scheme that is unique in theory and collides on the actual
  // shape of a run id would be worse than none, because the mechanism would look present and prove
  // nothing.
  const REAL = [
    "de53ab8b-35d7-403b-8d16-f605f98cd02a", "909642a3-6d05-4257-ba79-f482e63d719d",
    "a9099445-0295-426a-975d-1bb38e86eefe", "56b42806-b1f7-4928-9ece-36dea7ef6907",
    "6dab9166-bcad-4c31-9b37-8e40925acd40", "6dacee25-2881-4b8c-8d87-d2c937b1f3c5",
  ];
  const tokens = REAL.map(runUniqueToken);
  ok("production run ids give distinct tokens", new Set(tokens).size === REAL.length, tokens.join(" "));
  // The two ids above sharing "6da" are deliberate: a scheme keying on too few leading characters passes
  // a hand-picked sample and collides on the real thing.
  ok("  including two that share a leading run of characters", runUniqueToken(REAL[4]) !== runUniqueToken(REAL[5]));
  // The trap the rehearsal fell into: ids sharing a prefix collapse to one token. Asserted so the
  // constraint is a checked property rather than a comment somebody has to notice.
  ok("ids sharing their first eight characters DO collide, which is why the varying part must lead",
    runUniqueToken("rehearsal-a") === runUniqueToken("rehearsal-b"));
  const rehearse = readFileSync("ops/plan-rehearse.ts", "utf8");
  ok("  so the rehearsal builds its own token instead", !/runUniqueToken\(`rehearsal/.test(rehearse) && /vr-rh/.test(rehearse));
}

console.log("\n── the run writes what it will later look for ──");
{
  const token = runUniqueToken(RUN_A);
  const filled = applyRunUnique({ action: "fill", target: "Title", value: `Vraelis check ${UNIQUE_PLACEHOLDER}` }, token);
  const asserted = applyRunUnique({ action: "assert_text", target: "notes", expect: `Vraelis check ${UNIQUE_PLACEHOLDER}` }, token);
  ok("the typed value is bound to this run", filled.value === `Vraelis check ${token}`);
  ok("and the assertion looks for exactly that", asserted.expect === filled.value);
  ok("no placeholder survives into the browser", !containsPlaceholder(filled.value) && !containsPlaceholder(asserted.expect));
  // A flow usually clicks the thing it just created.
  const clicked = applyRunUnique({ action: "click", target: `Vraelis check ${UNIQUE_PLACEHOLDER}` }, token);
  ok("targets are substituted too, so a flow can open what it made", clicked.target === `Vraelis check ${token}`);
  // Untouched steps must come back byte-identical: substitution is not a rewrite of the approved plan.
  const plain = { action: "click", target: "Save" };
  ok("a step with no placeholder is returned unchanged", applyRunUnique(plain, token) === plain);
  ok("more than one placeholder in a value is fine", applyRunUnique({ action: "fill", value: `${UNIQUE_PLACEHOLDER}-${UNIQUE_PLACEHOLDER}` }, token).value === `${token}-${token}`);
}

console.log("\n── THE FAILURE, SIMULATED ──");
{
  // A fake application. `saves` is what a working product does; flipping it off is a product that has
  // stopped persisting, which is precisely what a verification must catch.
  const makeApp = (saves: boolean) => {
    const rows: string[] = [];
    return { rows, submit: (v: string) => { if (saves) rows.push(v); }, shows: (v: string) => rows.includes(v) };
  };
  // Play one plan against one app across two runs, the second with saving broken.
  const play = (planValue: string) => {
    const app = makeApp(true);
    const runOne = runUniqueToken(RUN_A);
    app.submit(applyRunUnique({ action: "fill", value: planValue }, runOne).value!);
    // Saving breaks between the runs. The row from run one is still there, which is the whole trap.
    (app as unknown as { submit: (v: string) => void }).submit = () => {};
    const runTwo = runUniqueToken(RUN_B);
    const typed = applyRunUnique({ action: "fill", value: planValue }, runTwo).value!;
    app.submit(typed);
    const expected = applyRunUnique({ action: "assert_text", expect: planValue }, runTwo).expect!;
    return { verdict: app.shows(expected), leftover: app.rows.length };
  };

  const fixed = play("Vraelis check");
  ok("a FIXED value passes against an app that saved nothing", fixed.verdict === true, "this is the false Verified");
  ok("  because the earlier run's row is still there", fixed.leftover === 1);

  const unique = play(`Vraelis check ${UNIQUE_PLACEHOLDER}`);
  ok("the same plan with a per-run value FAILS, correctly", unique.verdict === false);
  ok("  and it still passes when the app works", (() => {
    const app = makeApp(true);
    const t = runUniqueToken(RUN_B);
    app.submit(applyRunUnique({ action: "fill", value: `Vraelis check ${UNIQUE_PLACEHOLDER}` }, t).value!);
    return app.shows(applyRunUnique({ action: "assert_text", expect: `Vraelis check ${UNIQUE_PLACEHOLDER}` }, t).expect!);
  })());
}

console.log("\n── the risky shape is detectable ──");
{
  const risky = [
    { action: "fill", target: "Title", value: "Vraelis check" },
    { action: "click", target: "Save" },
    { action: "assert_text", target: "notes", expect: "Vraelis check" },
  ];
  ok("a fixed value asserted later is reported", fixedValueAssertions(risky).length === 1);
  // Guarded. Destructuring the first finding threw a TypeError when a mutation made the detector return
  // nothing, and a suite that CRASHES has not failed one assertion, it has skipped every assertion after
  // it. The run still went red, which is exactly what makes the habit dangerous: it looks like the guard
  // worked while the rest of the file never executed.
  ok("  naming the value and both step positions", (() => {
    const r = fixedValueAssertions(risky)[0];
    return !!r && r.value === "Vraelis check" && r.filledAt === 0 && r.assertedAt === 2;
  })());
  const safe = risky.map((s) => (s.value ? { ...s, value: `${s.value} ${UNIQUE_PLACEHOLDER}` } : s.expect ? { ...s, expect: `${s.expect} ${UNIQUE_PLACEHOLDER}` } : s));
  ok("the same flow with a placeholder is not", fixedValueAssertions(safe).length === 0);
  // An assertion BEFORE the fill is about something else entirely.
  ok("an assertion that precedes the fill is not reported",
    fixedValueAssertions([{ action: "assert_text", expect: "x" }, { action: "fill", value: "x" }]).length === 0);
  // Deliberately not a refusal on its own: `fill "Search" value="invoice"` then asserting "invoice" reads
  // data the run never claimed to create, and demanding uniqueness there would be wrong. The caller
  // decides, which is why this returns findings instead of throwing.
  ok("it reports rather than refuses", typeof fixedValueAssertions === "function" && Array.isArray(fixedValueAssertions([])));
}

console.log("\n── a plan using it is still a legal plan ──");
{
  // If the authoring validator rejected the placeholder, the synthesis would emit it and every flow that
  // used it would be DISCARDED — the guidance would silently delete the plans it was meant to improve.
  const v = validateSteps([
    { action: "navigate", target: "/notes" },
    { action: "fill", target: "Title", value: `Vraelis check ${UNIQUE_PLACEHOLDER}` },
    { action: "click", target: "Save" },
    { action: "assert_text", target: "notes", expect: `Vraelis check ${UNIQUE_PLACEHOLDER}` },
  ], { rolesAvailable: [] });
  ok("the flow validator accepts a placeholder", v.ok === true, v.ok ? "" : v.reason);
  ok("and stores it verbatim, unresolved", v.ok && v.steps[1].value === `Vraelis check ${UNIQUE_PLACEHOLDER}`);
}

console.log("\n── the rehearsal executes what the run will execute ──");
{
  // A rehearsal that runs the plan differently from the way a paid run will is not a rehearsal. It called
  // page.perform on the raw step, so the browser would have typed the literal "{{unique}}" into the
  // customer's application, and the assertion would have looked for that same literal and passed —
  // proving the placeholder works and nothing whatsoever about the product.
  const r = strip(readFileSync("ops/plan-rehearse.ts", "utf8"));
  ok("the rehearsal substitutes before performing", /applyRunUnique\(/.test(r));
  // THE CONDITION OF A RETURN, not merely a mention. Checking that the file contains
  // "fixedValueAssertions(" passes for a file that computes the risks and then ignores them, which is
  // exactly what a careless edit leaves behind. The same weakness let a mutation that gutted the guarantee
  // cap sail through until it was pinned to `if (await guaranteeCapReached(`.
  ok("and refuses a plan that could pass on an earlier run's leftovers",
    /fixedValueAssertions\(/.test(r) && /if \(risky\.length\)\s*\{[\s\S]{0,900}?\breturn\b/.test(r));
  ok("  telling the operator which steps, and what to write instead", /REFUSING/.test(r) && r.includes("UNIQUE_PLACEHOLDER"));
  // Before the browser opens: a session spent rehearsing a plan that will be refused anyway is waste, and
  // it would write the risky values into the customer's app on the way.
  ok("  before spending a browser session on it", r.indexOf("fixedValueAssertions(") < r.indexOf("chromium.launch("));
}

console.log("\n── the pieces are actually wired together ──");
{
  // The mechanism existing is worth nothing if execution never calls it or the synthesis never emits it.
  const exec = strip(readFileSync("worker/preflight/execute-run.ts", "utf8"));
  ok("execution substitutes before performing a step", /applyRunUnique\(/.test(exec) && /runUniqueToken\(runId\)/.test(exec));
  // Before the boundary gate, or policy would judge a string the browser never receives.
  ok("  and before the policy gate sees the step",
    exec.indexOf("applyRunUnique(") < exec.indexOf("evaluateBoundary("));
  // The token is minted ONCE per run, not per step: a token that changed between the fill and the assert
  // would make every flow fail.
  ok("  minting the token once for the whole run", (exec.match(/runUniqueToken\(/g) ?? []).length === 1);

  const synth = strip(readFileSync("lib/preflight/discover-synthesis.ts", "utf8"));
  ok("the synthesis contract requires it for values it asserts", synth.includes("UNIQUE_PLACEHOLDER") && /MUST contain/.test(synth));
  // Spelled from the constant, not typed out. A prompt saying {{uniq}} while the code substitutes
  // {{unique}} would leave the placeholder sitting in the browser as literal text, and the assertion would
  // look for it and fail on a working app.
  ok("  spelled from the shared constant, never retyped", !/\{\{unique\}\}/.test(synth));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
