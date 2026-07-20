// Tests for the repair prompt (lib/preflight/repair-prompt.ts).
//
// This string is pasted straight into a coding agent that has write access to someone's codebase, so the
// invariants are: it states only what the run OBSERVED, it never presents a guess as a finding, and it
// tells the agent what Vraelis does not know so the agent does not chase a hallucinated cause.

import { buildRepairPrompt } from "../lib/preflight/repair-prompt";
import type { Issue } from "../lib/preflight/issues";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

const issue: Issue = {
  severity: "critical",
  category: "functional_failure",
  title: "Expected content was not visible after a refresh",
  requirement_refs: ["req-1"],
  expected: "Pay in test mode, then confirm the account actually gained the paid feature.",
  observed: "The plan still reads Free after checkout (at https://demo.test/dashboard)",
  repro: ["1. Open /pricing", "2. Click Upgrade", "3. Complete checkout with a test card", "4. Open /dashboard"],
  possible_explanation: "An entitlement update may not be applied after payment. This has not been confirmed.",
  evidence: {
    failed_step_index: 3,
    failed_action: "assert_text",
    console_errors: ["Uncaught TypeError: plan is undefined"],
    network_failures: [{ method: "POST", path: "/api/webhook/stripe", status: 500 }],
    current_url: "https://demo.test/dashboard",
  },
  status: "open",
};

const p = buildRepairPrompt(issue, { appName: "Notewell", deploymentUrl: "https://demo.test" });

// ── it carries what the agent needs ──
ok("names the app and the deployment", p.includes("Notewell") && p.includes("https://demo.test"));
ok("states what was expected", p.includes(issue.expected));
ok("states what happened instead", p.includes(issue.observed));
ok("includes every reproduction step", issue.repro.every((r) => p.includes(r)));
ok("names the failing step and action", /Step 4/.test(p) && p.includes("assert_text"));
ok("includes the console error verbatim", p.includes("Uncaught TypeError: plan is undefined"));
ok("includes the failed request with its status", p.includes("POST /api/webhook/stripe returned 500"));

// ── THE invariant: a guess is never dressed as a finding ──
ok("the explanation is fenced under an explicit guess heading",
  /ONE GUESS, UNCONFIRMED/.test(p));
ok("the guess is followed by an instruction to discard it if the code disagrees",
  /Ignore it if the code says otherwise/.test(p));
ok("the prompt states that the cause is NOT known",
  /I know the symptom and not the cause/i.test(p));
ok("it asks the agent to fix the cause, not the symptom",
  /fix the underlying cause rather than the symptom/i.test(p));

// A prompt with no explanation must not invent one, and must not leave a dangling empty section.
const noGuess = buildRepairPrompt({ ...issue, possible_explanation: null }, { deploymentUrl: "https://demo.test" });
ok("no explanation means no guess section at all", !/ONE GUESS/.test(noGuess));
ok("it still tells the agent the cause is unknown", /symptom and not the cause/i.test(noGuess));

// ── it must not fabricate structure when a run gave it little ──
const bare = buildRepairPrompt({
  ...issue, repro: [], possible_explanation: null,
  evidence: { failed_step_index: 0, failed_action: "click", console_errors: [], network_failures: [] },
}, {});
ok("a sparse issue produces no empty reproduction section", !/HOW TO REPRODUCE/.test(bare));
ok("a sparse issue produces no empty console section", !/BROWSER CONSOLE/.test(bare));
ok("a sparse issue produces no empty network section", !/FAILED NETWORK REQUESTS/.test(bare));
ok("a sparse issue still states expected and observed", bare.includes(issue.expected) && bare.includes(issue.observed));
ok("with no deployment url it does not print an empty target", !/ on \.$| on $/m.test(bare));

// ── bounded: a noisy run must not paste a thousand console lines into someone's editor ──
const noisy = buildRepairPrompt({
  ...issue,
  evidence: {
    ...issue.evidence,
    console_errors: Array.from({ length: 40 }, (_, i) => `error ${i}`),
    network_failures: Array.from({ length: 40 }, (_, i) => ({ method: "GET", path: `/x/${i}`, status: 500 })),
  },
}, {});
ok("console output is capped", (noisy.match(/^- error \d+$/gm) ?? []).length <= 5);
ok("network output is capped", (noisy.match(/returned 500/g) ?? []).length <= 5);
ok("the cap is disclosed rather than silently truncating", /\(35 more\)/.test(noisy));

// ── deterministic: same input, same prompt ──
ok("identical input produces an identical prompt",
  buildRepairPrompt(issue, { appName: "Notewell", deploymentUrl: "https://demo.test" }) === p);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
