// Tests for the CI gate: a deploy is authorized by the DECISION, never by the run state. The headline
// regression is that a completed FAILED verification cannot pass merely because its run finished (or because
// someone gates on a "ready"/"completed" run state). Pure; no DB, no network.
import { ciGate } from "../lib/preflight/ci-gate";
import { toPublicDecision } from "../app/api/v1/verifications/_shared";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── ciGate: decision -> exit code ─────────────────────────────────────────────────────────────────────────
ok("verified -> exit 0 (ship)", (() => { const g = ciGate("verified"); return g.action === "exit" && g.code === 0; })());
ok("failed -> exit 1 (stop)", (() => { const g = ciGate("failed"); return g.action === "exit" && g.code === 1; })());
ok("blocked -> exit 2 (stop)", (() => { const g = ciGate("blocked"); return g.action === "exit" && g.code === 2; })());
ok("null decision -> wait (keep polling)", ciGate(null).action === "wait");
ok("empty decision -> wait (keep polling)", ciGate("").action === "wait");
ok("undefined decision -> wait (keep polling)", ciGate(undefined).action === "wait");
ok("case/space tolerant: ' Verified ' -> exit 0", (() => { const g = ciGate("  Verified  "); return g.action === "exit" && g.code === 0; })());

// ── The headline regression: a run STATE must never pass the gate ─────────────────────────────────────────
// Someone who (wrongly) gates on the run state would feed "completed" or "ready" into the gate. Neither is a
// verdict, so neither may exit 0. They land in the unrecognized branch (exit 3), never a ship.
ok("run state 'completed' fed as decision -> NOT a pass (exit 3)", (() => { const g = ciGate("completed"); return g.action === "exit" && g.code === 3; })());
ok("run state 'ready' fed as decision -> NOT a pass (exit 3)", (() => { const g = ciGate("ready"); return g.action === "exit" && g.code === 3; })());
ok("only 'verified' ever yields exit 0", ["completed", "ready", "done", "ok", "success", "passed"].every((s) => { const g = ciGate(s); return !(g.action === "exit" && g.code === 0); }));

// ── Composition with the real translator: a completed-but-FAILED verification cannot pass ─────────────────
// toPublicDecision is the shipped mapping from (runState, internalDecision) to the public decision. A run
// that COMPLETED with the internal "blocked" decision is a FAILED verification; the gate must exit 1, not 0,
// even though the run state is terminal ("completed").
ok("completed run with internal 'blocked' -> public 'failed' -> exit 1 (NOT 0)", (() => {
  const pub = toPublicDecision("completed", "blocked");
  const g = ciGate(pub);
  return pub === "failed" && g.action === "exit" && g.code === 1;
})());
ok("completed run with internal 'ready' -> public 'verified' -> exit 0", (() => {
  const pub = toPublicDecision("completed", "ready");
  const g = ciGate(pub);
  return pub === "verified" && g.action === "exit" && g.code === 0;
})());
ok("completed run with internal 'needs_review' -> public 'blocked' -> exit 2 (never a false pass)", (() => {
  const pub = toPublicDecision("completed", "needs_review");
  const g = ciGate(pub);
  return pub === "blocked" && g.action === "exit" && g.code === 2;
})());
ok("a run that did NOT complete -> public null -> wait (a non-terminal run can never verify)", (() => {
  const pub = toPublicDecision("running", "ready");
  return pub === null && ciGate(pub).action === "wait";
})());
ok("a run whose STATE is 'failed' -> public 'blocked' -> exit 2, never 0", (() => {
  const pub = toPublicDecision("failed", "ready");
  const g = ciGate(pub);
  return pub === "blocked" && g.action === "exit" && g.code === 2;
})());

// ── The enumerated contract, stated directly (public decision -> exit code) ───────────────────────────────
ok("PUBLIC verified -> exit 0", (() => { const g = ciGate("verified"); return g.action === "exit" && g.code === 0; })());
ok("PUBLIC failed -> exit 1", (() => { const g = ciGate("failed"); return g.action === "exit" && g.code === 1; })());
ok("PUBLIC blocked -> exit 2", (() => { const g = ciGate("blocked"); return g.action === "exit" && g.code === 2; })());
ok("unknown decision -> exit 3", (() => { const g = ciGate("frobnicated"); return g.action === "exit" && g.code === 3; })());
ok("running with no decision -> continue polling", ciGate(null).action === "wait");

// A COMPLETED run with NO final decision must not slip through as a pass. toPublicDecision returns the honest
// third answer (blocked), and the gate exits 2 -- never 0. This is the "completed state without a final
// decision cannot exit 0" case, distinct from the ones where a decision string was fed in directly.
ok("completed run, NO internal decision -> public 'blocked' -> exit 2 (never 0)", (() => {
  const pub = toPublicDecision("completed", null);
  const g = ciGate(pub);
  return pub === "blocked" && g.action === "exit" && g.code === 2;
})());
ok("completed run, empty internal decision -> public 'blocked' -> exit 2", (() => {
  const pub = toPublicDecision("completed", "");
  const g = ciGate(pub);
  return pub === "blocked" && g.action === "exit" && g.code === 2;
})());

// The two "blocked" are different verdicts and MUST land on different exit codes. Internal 'blocked' is a
// confirmed failure (public failed, exit 1); public 'blocked' is "no verdict reached" (exit 2). The public
// contract only ever exposes the latter meaning of the word.
ok("internal 'blocked' (confirmed failure) and public 'blocked' (no verdict) do NOT share an exit code", (() => {
  const internalBlockedExit = ciGate(toPublicDecision("completed", "blocked")); // -> failed -> 1
  const publicBlockedExit = ciGate(toPublicDecision("completed", "needs_review")); // -> blocked -> 2
  return internalBlockedExit.action === "exit" && internalBlockedExit.code === 1
    && publicBlockedExit.action === "exit" && publicBlockedExit.code === 2;
})());
ok("needs_review -> public 'blocked' -> exit 2", (() => {
  const pub = toPublicDecision("completed", "needs_review");
  const g = ciGate(pub);
  return pub === "blocked" && g.action === "exit" && g.code === 2;
})());

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
